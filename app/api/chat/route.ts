import { FunctionCallingMode, GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { db } from "@/lib/db";
import {
  chatMessages,
  conversations,
  knowledgeChunks,
  knowledgeDocs,
  signals,
} from "@/lib/db/schema";
import { generateEmbedding } from "@/lib/knowledge/embeddings";
import { IngestService } from "@/lib/ingestion/ingest";
import { MONITORING_CONFIG } from "@/lib/config";
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

const apiKey =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(apiKey!);
// Using gemini-3-flash-preview as requested
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

type SignalSnapshot = {
  source: string;
  type: string;
  authorHandle?: string;
  timestamp?: string;
  url?: string;
  text: string;
  engagement?: Record<string, number | undefined>;
  metadata?: Record<string, unknown>;
};

type ToolInvocation = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: "result";
  result: unknown;
};

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
];

const toolConfig = {
  functionCallingConfig: {
    mode: FunctionCallingMode.AUTO,
  },
};

const engagementScoreSql = sql<number>`
  coalesce((${signals.engagement} ->> 'likes')::int, 0)
  + coalesce((${signals.engagement} ->> 'replies')::int, 0)
  + coalesce((${signals.engagement} ->> 'views')::int, 0)
  + coalesce((${signals.engagement} ->> 'upvotes')::int, 0)
  + coalesce((${signals.engagement} ->> 'score')::int, 0)
`;

const MAX_TOOL_LOOPS = 3;

const toDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const normalizeSignalRow = (row: {
  id: string | null;
  source: string | null;
  type: string | null;
  authorHandle: string | null;
  timestamp: Date | null;
  url: string | null;
  text: string | null;
  engagement: unknown;
  language: string | null;
  tags: unknown;
  metadata: unknown;
}) => ({
  id: row.id ?? undefined,
  source: row.source ?? undefined,
  type: row.type ?? undefined,
  authorHandle: row.authorHandle ?? undefined,
  timestamp: row.timestamp ? row.timestamp.toISOString() : undefined,
  url: row.url ?? undefined,
  text: row.text ?? "",
  engagement: (row.engagement as Record<string, number | undefined>) ?? {},
  language: row.language ?? undefined,
  tags: (row.tags as string[]) ?? [],
  metadata: (row.metadata as Record<string, unknown>) ?? {},
});

const buildSignalFilters = (args: Record<string, unknown>) => {
  const filters = [] as any[];
  const query = typeof args.query === "string" ? args.query.trim() : "";
  const sources = Array.isArray(args.sources)
    ? (args.sources.filter((item) => typeof item === "string") as string[])
    : [];
  const types = Array.isArray(args.types)
    ? (args.types.filter((item) => typeof item === "string") as string[])
    : [];

  if (query) {
    const tokens = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 1) {
      filters.push(ilike(signals.text, `%${tokens[0]}%`));
    } else {
      filters.push(or(...tokens.map((token) => ilike(signals.text, `%${token}%`))));
    }
  }

  if (sources.length > 0) {
    filters.push(inArray(signals.source, sources));
  }

  if (types.length > 0) {
    filters.push(inArray(signals.type, types));
  }

  const startDate = toDate(args.startDate as string | undefined);
  const endDate = toDate(args.endDate as string | undefined);
  const sinceDays = typeof args.sinceDays === "number" ? args.sinceDays : undefined;

  if (sinceDays && Number.isFinite(sinceDays)) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    filters.push(gte(signals.timestamp, since));
  }

  if (startDate) {
    filters.push(gte(signals.timestamp, startDate));
  }

  if (endDate) {
    filters.push(lte(signals.timestamp, endDate));
  }

  if (typeof args.minEngagement === "number") {
    filters.push(sql`${engagementScoreSql} >= ${args.minEngagement}`);
  }

  return filters;
};

const searchSignals = async (args: Record<string, unknown>) => {
  const filters = buildSignalFilters(args);
  const limitInput = typeof args.limit === "number" ? args.limit : undefined;
  const limit = Math.min(Math.max(limitInput ?? 20, 1), 100);
  const sort = typeof args.sort === "string" ? args.sort : "newest";

  let query = db
    .select({
      id: signals.id,
      source: signals.source,
      type: signals.type,
      authorHandle: signals.authorHandle,
      timestamp: signals.timestamp,
      url: signals.url,
      text: signals.text,
      engagement: signals.engagement,
      language: signals.language,
      tags: signals.tags,
      metadata: signals.metadata,
    })
    .from(signals);

  if (filters.length > 0) {
    query = query.where(and(...filters));
  }

  if (sort === "oldest") {
    query = query.orderBy(asc(signals.timestamp));
  } else if (sort === "engagement") {
    query = query.orderBy(desc(engagementScoreSql));
  } else {
    query = query.orderBy(desc(signals.timestamp));
  }

  const rows = await query.limit(limit);
  return rows.map(normalizeSignalRow);
};

const searchCachedSignals = (args: Record<string, unknown>, cache: SignalSnapshot[]) => {
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
  const sources = Array.isArray(args.sources)
    ? (args.sources.filter((item) => typeof item === "string") as string[])
    : [];
  const types = Array.isArray(args.types)
    ? (args.types.filter((item) => typeof item === "string") as string[])
    : [];
  const sinceDays = typeof args.sinceDays === "number" ? args.sinceDays : undefined;
  const limitInput = typeof args.limit === "number" ? args.limit : undefined;
  const limit = Math.min(Math.max(limitInput ?? 50, 1), 200);
  const sort = typeof args.sort === "string" ? args.sort : "newest";

  let filtered = cache.slice();

  if (query) {
    filtered = filtered.filter((item) =>
      item.text.toLowerCase().includes(query)
    );
  }

  if (sources.length > 0) {
    filtered = filtered.filter((item) => sources.includes(item.source));
  }

  if (types.length > 0) {
    filtered = filtered.filter((item) => types.includes(item.type));
  }

  if (sinceDays && Number.isFinite(sinceDays)) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    filtered = filtered.filter((item) => {
      const timestamp = item.timestamp ? new Date(item.timestamp) : undefined;
      return timestamp && !Number.isNaN(timestamp.getTime())
        ? timestamp >= since
        : false;
    });
  }

  if (typeof args.minEngagement === "number") {
    const minEngagement = args.minEngagement;
    filtered = filtered.filter((item) => {
      const engagement = item.engagement ?? {};
      const score =
        (engagement.likes ?? 0) +
        (engagement.replies ?? 0) +
        (engagement.views ?? 0) +
        (engagement.upvotes ?? 0) +
        (engagement.score ?? 0);
      return score >= minEngagement;
    });
  }

  const byEngagement = (item: SignalSnapshot) => {
    const engagement = item.engagement ?? {};
    return (
      (engagement.likes ?? 0) +
      (engagement.replies ?? 0) +
      (engagement.views ?? 0) +
      (engagement.upvotes ?? 0) +
      (engagement.score ?? 0)
    );
  };

  if (sort === "oldest") {
    filtered.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  } else if (sort === "engagement") {
    filtered.sort((a, b) => byEngagement(b) - byEngagement(a));
  } else {
    filtered.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }

  return filtered.slice(0, limit);
};

const searchKnowledge = async (query: string, topK: number) => {
  const queryEmbedding = await generateEmbedding(query);
  const limit = Math.min(Math.max(topK, 1), 20);

  const results = await db
    .select({
      chunkId: knowledgeChunks.id,
      text: knowledgeChunks.text,
      docId: knowledgeDocs.id,
      docTitle: knowledgeDocs.title,
      docSource: knowledgeDocs.source,
      ingestedAt: knowledgeDocs.ingestedAt,
      distance: sql<number>`${knowledgeChunks.embedding} <=> ${JSON.stringify(
        queryEmbedding
      )}::vector`,
    })
    .from(knowledgeChunks)
    .leftJoin(knowledgeDocs, eq(knowledgeChunks.docId, knowledgeDocs.id))
    .where(eq(knowledgeDocs.status, "ready"))
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${JSON.stringify(
      queryEmbedding
    )}::vector`)
    .limit(limit);

  return results.map((row) => ({
    chunkId: row.chunkId,
    text: row.text,
    docId: row.docId,
    docTitle: row.docTitle,
    docSource: row.docSource,
    ingestedAt: row.ingestedAt,
    score: 1 - row.distance,
  }));
};

const getSignalVolume = async (args: Record<string, unknown>) => {
  const filters = buildSignalFilters(args);
  const granularity = args.granularity === "week" ? "week" : "day";
  const bucket =
    granularity === "week"
      ? sql`date_trunc('week', ${signals.timestamp})`
      : sql`date_trunc('day', ${signals.timestamp})`;
  const groupBy = args.groupBy === "source" ? "source" : args.groupBy === "type" ? "type" : "none";

  const selectFields: Record<string, any> = {
    bucket,
    count: sql<number>`count(*)`,
  };

  if (groupBy === "source") {
    selectFields.source = signals.source;
  }

  if (groupBy === "type") {
    selectFields.type = signals.type;
  }

  let query = db.select(selectFields).from(signals);

  if (filters.length > 0) {
    query = query.where(and(...filters));
  }

  const groupByFields = [bucket];
  if (groupBy === "source") {
    groupByFields.push(signals.source);
  }
  if (groupBy === "type") {
    groupByFields.push(signals.type);
  }

  const rows = await query
    .groupBy(...groupByFields)
    .orderBy(bucket);

  return rows.map((row: any) => ({
    bucket: row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket,
    count: Number(row.count ?? 0),
    source: row.source,
    type: row.type,
  }));
};

const syncSignals = async (source?: string) => {
  const ingest = new IngestService();
  let params = {} as Record<string, unknown>;

  if (source) {
    params = {
      reddit: { ...MONITORING_CONFIG.reddit, enabled: source === "reddit" },
      producthunt: {
        ...MONITORING_CONFIG.productHunt,
        enabled: source === "producthunt",
      },
      appstore: {
        ...MONITORING_CONFIG.appStore,
        enabled: source === "appstore",
      },
      playstore: {
        ...MONITORING_CONFIG.playStore,
        enabled: source === "playstore",
      },
      hackernews: {
        ...MONITORING_CONFIG.hackernews,
        enabled: source === "hackernews",
      },
      rssFeeds: {
        ...MONITORING_CONFIG.rssFeeds,
        enabled: source === "rssFeeds",
      },
      yc: { ...MONITORING_CONFIG.yc, enabled: source === "yc" },
      gdelt: { ...MONITORING_CONFIG.gdelt, enabled: source === "gdelt" },
    };
  }

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
      return await searchKnowledge(query, topK);
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
      for (const item of invocation.result as any[]) {
        if (!item?.text) continue;
        sources.push({
          type: "internal",
          title: item.docTitle || "Internal doc",
          snippet: String(item.text).slice(0, 240),
        });
      }
    }

    if (
      invocation.toolName === "search_signals" ||
      invocation.toolName === "get_recent_signals" ||
      invocation.toolName === "search_cached_signals"
    ) {
      for (const item of invocation.result as any[]) {
        if (!item?.text) continue;
        sources.push({
          type: "external",
          title: item.source || "Signal",
          url: item.url,
          snippet: String(item.text).slice(0, 240),
        });
      }
    }
  }

  return sources.slice(0, 12);
};

export async function POST(req: Request) {
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing API Key" }), {
      status: 500,
    });
  }

  try {
    const { messages, conversationId, signalSnapshot } = await req.json();
    const signalCache = Array.isArray(signalSnapshot)
      ? (signalSnapshot as SignalSnapshot[])
      : [];

    const lastMessage = messages[messages.length - 1];
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

    const history = messages.slice(0, -1).map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
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
      const functionResponses = [] as any[];

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
  } catch (error: any) {
    console.error("Chat Route Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
