import { FunctionCallingMode, GoogleGenerativeAI, SchemaType, type Tool } from "@google/generative-ai";
import { db } from "@/lib/db";
import {
  chatMessages,
  conversations,
  knowledgeChunks,
  knowledgeDocs,
  signals,
} from "@/lib/db/schema";
import { searchKnowledgeBase } from "@/lib/knowledge/search";
import { IngestService } from "@/lib/ingestion/ingest";
import { buildIngestParams } from "@/lib/ingestion/params";
import {
  buildSignalFilters,
  searchSignals,
  searchCachedSignals,
  type SignalSnapshot,
} from "@/lib/api/signals";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

export const maxDuration = 60;

const getModel = () => {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
};

type ToolInvocation = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "result";
  result: unknown;
};

type ChatMessageInput = {
  role?: string;
  content?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const systemInstruction = `You are a research analyst for consumer and market signals.
You have tools that can search internal knowledge, query external signals, and compute trend volumes.

Rules:
- Always use tools when a question needs evidence from signals or internal docs.
- Prefer internal knowledge first if the question references company strategy or docs.
- Use signals tools for market trends, recent chatter, and competitive moves.
- Cite evidence clearly by source and date when you reference data.
- Be concise but thorough: state findings, evidence, and your judgment.
- If evidence is thin, say so and propose the next best query to run.

When using tools, you can call multiple tools in sequence to triangulate:
- search_internal_knowledge for org context
- search_signals or search_cached_signals for external signals
- get_signal_volume for trend movement over time
- sync_signals if ingestion is required
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: "search_internal_knowledge",
        description:
          "Semantic search across internal docs and knowledge chunks. Returns relevant snippets with document metadata.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "What to search for in internal docs.",
            },
            topK: {
              type: SchemaType.INTEGER,
              description: "Number of results to return (1-20).",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "search_signals",
        description:
          "Search stored external signals with metadata filters. Use this for external trends, chatter, and competitive info.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "Text query to match against signal text.",
            },
            sources: {
              type: SchemaType.ARRAY,
              description: "Filter by signal sources (e.g., reddit, producthunt, appstore).",
              items: { type: SchemaType.STRING },
            },
            types: {
              type: SchemaType.ARRAY,
              description: "Filter by signal types (post, comment, review, launch).",
              items: { type: SchemaType.STRING },
            },
            startDate: {
              type: SchemaType.STRING,
              description: "Start of date range (ISO).",
            },
            endDate: {
              type: SchemaType.STRING,
              description: "End of date range (ISO).",
            },
            sinceDays: {
              type: SchemaType.INTEGER,
              description: "Look back N days from now.",
            },
            minEngagement: {
              type: SchemaType.INTEGER,
              description: "Minimum engagement score across likes/upvotes/replies.",
            },
            limit: {
              type: SchemaType.INTEGER,
              description: "Max results to return (1-100).",
            },
            sort: {
              type: SchemaType.STRING,
              description: "Sort order: newest, oldest, or engagement.",
            },
          },
        },
      },
      {
        name: "search_cached_signals",
        description:
          "Search the client-side cached signals (Zustand store snapshot) when data was just synced and may not be in DB yet.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description: "Text query to match against signal text.",
            },
            sources: {
              type: SchemaType.ARRAY,
              description: "Filter by signal sources.",
              items: { type: SchemaType.STRING },
            },
            types: {
              type: SchemaType.ARRAY,
              description: "Filter by signal types.",
              items: { type: SchemaType.STRING },
            },
            sinceDays: {
              type: SchemaType.INTEGER,
              description: "Look back N days from now.",
            },
            minEngagement: {
              type: SchemaType.INTEGER,
              description: "Minimum engagement score across likes/upvotes/replies.",
            },
            limit: {
              type: SchemaType.INTEGER,
              description: "Max results to return (1-200).",
            },
            sort: {
              type: SchemaType.STRING,
              description: "Sort order: newest, oldest, or engagement.",
            },
          },
        },
      },
      {
        name: "get_recent_signals",
        description: "Fetch the most recent signals, optionally filtered by source.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            sources: {
              type: SchemaType.ARRAY,
              description: "Filter by signal sources.",
              items: { type: SchemaType.STRING },
            },
            limit: {
              type: SchemaType.INTEGER,
              description: "Max results to return (1-50).",
            },
          },
        },
      },
      {
        name: "get_signal_volume",
        description:
          "Return counts of signals over time for trend analysis. Use this to detect momentum changes.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            granularity: {
              type: SchemaType.STRING,
              description: "Bucket size: day or week.",
            },
            startDate: {
              type: SchemaType.STRING,
              description: "Start of date range (ISO).",
            },
            endDate: {
              type: SchemaType.STRING,
              description: "End of date range (ISO).",
            },
            sinceDays: {
              type: SchemaType.INTEGER,
              description: "Look back N days from now.",
            },
            sources: {
              type: SchemaType.ARRAY,
              description: "Filter by signal sources.",
              items: { type: SchemaType.STRING },
            },
            types: {
              type: SchemaType.ARRAY,
              description: "Filter by signal types.",
              items: { type: SchemaType.STRING },
            },
            groupBy: {
              type: SchemaType.STRING,
              description: "Optional grouping: source, type, or none.",
            },
          },
        },
      },
      {
        name: "sync_signals",
        description:
          "Trigger signal ingestion for all sources or a single source. Use sparingly.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            source: {
              type: SchemaType.STRING,
              description:
                "Optional source to sync (reddit, producthunt, appstore, playstore, hackernews, rssFeeds, yc, gdelt).",
            },
          },
        },
      },
    ],
  },
] as Tool[];

const toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingMode.AUTO,
  },
};

const MAX_TOOL_LOOPS = 3;

const getSignalVolume = async (args: Record<string, unknown>) => {
  const filters = buildSignalFilters(args);
  const granularity = args.granularity === "week" ? "week" : "day";
  const bucket =
    granularity === "week"
      ? sql<Date>`date_trunc('week', ${signals.timestamp})`
      : sql<Date>`date_trunc('day', ${signals.timestamp})`;
  const groupByArg = args.groupBy === "source" ? "source" : args.groupBy === "type" ? "type" : "none";

  // Build separate queries based on groupBy to satisfy TypeScript
  const whereClause = filters.length > 0 ? and(...filters) : undefined;

  if (groupByArg === "source") {
    const baseQuery = db
      .select({
        bucket,
        count: sql<number>`count(*)`,
        source: signals.source,
      })
      .from(signals);

    const query = whereClause ? baseQuery.where(whereClause) : baseQuery;
    const rows = await query.groupBy(bucket, signals.source).orderBy(bucket);

    return rows.map((row) => ({
      bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
      count: Number(row.count ?? 0),
      source: row.source,
      type: undefined as string | undefined,
    }));
  }

  if (groupByArg === "type") {
    const baseQuery = db
      .select({
        bucket,
        count: sql<number>`count(*)`,
        type: signals.type,
      })
      .from(signals);

    const query = whereClause ? baseQuery.where(whereClause) : baseQuery;
    const rows = await query.groupBy(bucket, signals.type).orderBy(bucket);

    return rows.map((row) => ({
      bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
      count: Number(row.count ?? 0),
      source: undefined as string | undefined,
      type: row.type,
    }));
  }

  // No groupBy
  const baseQuery = db
    .select({
      bucket,
      count: sql<number>`count(*)`,
    })
    .from(signals);

  const query = whereClause ? baseQuery.where(whereClause) : baseQuery;
  const rows = await query.groupBy(bucket).orderBy(bucket);

  return rows.map((row) => ({
    bucket: row.bucket instanceof Date ? row.bucket.toISOString() : String(row.bucket),
    count: Number(row.count ?? 0),
    source: undefined as string | undefined,
    type: undefined as string | undefined,
  }));
};

const syncSignals = async (source?: string) => {
  const ingest = new IngestService();
  const params = buildIngestParams(source);

  const ingestedSignals = await ingest.run(params);
  return {
    count: ingestedSignals.length,
    signals: ingestedSignals.slice(0, 25),
  };
};

const runTool = async (
  name: string,
  args: Record<string, unknown>,
  signalSnapshot: SignalSnapshot[]
) => {
  switch (name) {
    case "search_internal_knowledge": {
      const query = typeof args.query === "string" ? args.query : "";
      const topK = typeof args.topK === "number" ? args.topK : 5;
      if (!query) return { error: "Missing query" };
      return await searchKnowledgeBase(query, topK);
    }
    case "search_signals": {
      return await searchSignals(args);
    }
    case "search_cached_signals": {
      if (!signalSnapshot.length) {
        return { warning: "No cached signals provided" };
      }
      return searchCachedSignals(args, signalSnapshot);
    }
    case "get_recent_signals": {
      const sources = Array.isArray(args.sources) ? args.sources : [];
      const limit = typeof args.limit === "number" ? args.limit : 20;
      return await searchSignals({ sources, limit, sort: "newest" });
    }
    case "get_signal_volume": {
      return await getSignalVolume(args);
    }
    case "sync_signals": {
      const source = typeof args.source === "string" ? args.source : undefined;
      return await syncSignals(source);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
};

const buildSources = (toolInvocations: ToolInvocation[]) => {
  const sources = [] as {
    type: "internal" | "external" | "web";
    title: string;
    url?: string;
    snippet: string;
  }[];

  for (const invocation of toolInvocations) {
    if (!Array.isArray(invocation.result)) continue;

    if (invocation.toolName === "search_internal_knowledge") {
      for (const item of invocation.result as unknown[]) {
        if (!isRecord(item) || typeof item.text !== "string") continue;
        sources.push({
          type: "internal",
          title: typeof item.docTitle === "string" ? item.docTitle : "Internal doc",
          snippet: item.text.slice(0, 240),
        });
      }
    }

    if (
      invocation.toolName === "search_signals" ||
      invocation.toolName === "get_recent_signals" ||
      invocation.toolName === "search_cached_signals"
    ) {
      for (const item of invocation.result as unknown[]) {
        if (!isRecord(item) || typeof item.text !== "string") continue;
        sources.push({
          type: "external",
          title: typeof item.source === "string" ? item.source : "Signal",
          url: typeof item.url === "string" ? item.url : undefined,
          snippet: item.text.slice(0, 240),
        });
      }
    }
  }

  return sources.slice(0, 12);
};

export async function POST(req: Request) {
  const model = getModel();
  if (!model) {
    return new Response(JSON.stringify({ error: "Missing API Key" }), {
      status: 500,
    });
  }

  try {
    const { messages, conversationId, signalSnapshot } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const signalCache = Array.isArray(signalSnapshot)
      ? (signalSnapshot as SignalSnapshot[])
      : [];

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || typeof lastMessage.content !== "string") {
      return new Response(JSON.stringify({ error: "Last message is invalid" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (conversationId && lastMessage?.role === "user") {
      await db
        .insert(chatMessages)
        .values({
          conversationId,
          role: "user",
          content: lastMessage.content,
        })
        .catch((e) => console.error("Error saving user message:", e));

      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversationId))
        .catch((e) => console.error("Error updating conversation:", e));
    }

    const history = messages.slice(0, -1).map((m: ChatMessageInput) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    }));

    while (history.length > 0 && history[0].role === "model") {
      history.shift();
    }

    const chat = model.startChat({
      history,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }],
      },
      tools,
      toolConfig,
    });

    let response = await chat.sendMessage(lastMessage.content);
    let functionCalls = response.response.functionCalls() || [];
    const toolInvocations: ToolInvocation[] = [];
    let loops = 0;

    while (functionCalls.length > 0 && loops < MAX_TOOL_LOOPS) {
      const functionResponses: Array<{
        functionResponse: { name: string; response: { result: unknown } };
      }> = [];

      for (const call of functionCalls) {
        const result = await runTool(
          call.name,
          (call.args || {}) as Record<string, unknown>,
          signalCache
        ).catch((error) => ({
          error: error instanceof Error ? error.message : String(error),
        }));

        toolInvocations.push({
          toolCallId: crypto.randomUUID(),
          toolName: call.name,
          args: (call.args || {}) as Record<string, unknown>,
          state: "result",
          result,
        });

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result },
          },
        });
      }

      response = await chat.sendMessage(functionResponses);
      functionCalls = response.response.functionCalls() || [];
      loops += 1;
    }

    const finalText = response.response.text();

    if (conversationId && finalText) {
      const sources = buildSources(toolInvocations);
      await db
        .insert(chatMessages)
        .values({
          conversationId,
          role: "assistant",
          content: finalText,
          sources,
        })
        .catch((e) => console.error("DB Save Error:", e));
    }

    return new Response(
      JSON.stringify({
        message: {
          role: "assistant",
          content: finalText,
          toolInvocations,
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Chat Route Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
    });
  }
}
