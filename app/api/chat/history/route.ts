import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatMessages } from '@/lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { errorResponse } from '@/lib/api/responses';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return errorResponse('Conversation ID required', 400);
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(asc(chatMessages.createdAt));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return errorResponse('Failed to fetch history', 500);
  }
}
