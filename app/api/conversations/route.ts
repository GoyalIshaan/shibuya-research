import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { conversations, chatMessages } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { errorResponse } from '@/lib/api/responses';

export async function GET() {
  try {
    const allConversations = await db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt));

    return NextResponse.json(allConversations);
  } catch (error) {
    console.error('Failed to fetch conversations:', error);
    return errorResponse('Failed to fetch conversations', 500);
  }
}

export async function POST() {
  try {
    const [newConversation] = await db
      .insert(conversations)
      .values({
        title: 'New Chat',
      })
      .returning();

    return NextResponse.json(newConversation, { status: 201 });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to create conversation';
    return errorResponse(message, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, title } = body as { id?: string; title?: string };

    if (!id || typeof id !== 'string') {
      return errorResponse('Conversation ID is required', 400);
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return errorResponse('Title is required', 400);
    }

    const [updated] = await db
      .update(conversations)
      .set({ title: title.trim(), updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();

    if (!updated) {
      return errorResponse('Conversation not found', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to update conversation';
    return errorResponse(message, 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errorResponse('Conversation ID is required', 400);
    }

    // Delete associated chat messages first
    await db.delete(chatMessages).where(eq(chatMessages.conversationId, id));

    // Then delete the conversation
    const [deleted] = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();

    if (!deleted) {
      return errorResponse('Conversation not found', 404);
    }

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete conversation';
    return errorResponse(message, 500);
  }
}
