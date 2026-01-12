import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { knowledgeDocs, knowledgeChunks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

    if (!docId) {
      return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
    }

    // Check if document exists
    const doc = await db
      .select()
      .from(knowledgeDocs)
      .where(eq(knowledgeDocs.id, docId))
      .limit(1);

    if (doc.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Delete chunks first (foreign key constraint)
    const deletedChunks = await db
      .delete(knowledgeChunks)
      .where(eq(knowledgeChunks.docId, docId))
      .returning({ id: knowledgeChunks.id });

    // Delete document
    await db
      .delete(knowledgeDocs)
      .where(eq(knowledgeDocs.id, docId));

    return NextResponse.json({
      success: true,
      deletedChunks: deletedChunks.length,
    });

  } catch (error) {
    console.error('Delete error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;

    if (!docId) {
      return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
    }

    // Get document with chunk count
    const doc = await db
      .select()
      .from(knowledgeDocs)
      .where(eq(knowledgeDocs.id, docId))
      .limit(1);

    if (doc.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const chunks = await db
      .select({ id: knowledgeChunks.id })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.docId, docId));

    return NextResponse.json({
      ...doc[0],
      chunkCount: chunks.length,
    });

  } catch (error) {
    console.error('Get error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
