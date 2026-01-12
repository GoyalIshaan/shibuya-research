
import { db } from "@/lib/db";
import { conversations } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));

    return new Response(JSON.stringify(allConversations), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch conversations" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function POST() {
  try {
    const [newConversation] = await db
      .insert(conversations)
      .values({
        title: "New Chat",
      })
      .returning();

    return new Response(JSON.stringify(newConversation), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to create conversation:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create conversation", details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
