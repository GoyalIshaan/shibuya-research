import { db } from "@/lib/db";
import { chatMessages } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return new Response(JSON.stringify({ error: "Conversation ID required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(asc(chatMessages.createdAt));

    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch history" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
