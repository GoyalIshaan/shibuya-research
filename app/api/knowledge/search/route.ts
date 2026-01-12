import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { knowledgeChunks, knowledgeDocs } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/knowledge/embeddings';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, topK = 5 } = body;

    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    if (typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ error: 'Query must be a non-empty string' }, { status: 400 });
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);

    // Limit topK to reasonable range
    const limit = Math.min(Math.max(topK, 1), 50);

    // Perform vector similarity search using pgvector
    // Using cosine distance (<=> operator in pgvector)
    const results = await db
      .select({
        chunkId: knowledgeChunks.id,
        text: knowledgeChunks.text,
        docId: knowledgeDocs.id,
        docTitle: knowledgeDocs.title,
        docSource: knowledgeDocs.source,
        ingestedAt: knowledgeDocs.ingestedAt,
        distance: sql<number>`${knowledgeChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`,
      })
      .from(knowledgeChunks)
      .leftJoin(knowledgeDocs, eq(knowledgeChunks.docId, knowledgeDocs.id))
      .where(eq(knowledgeDocs.status, 'ready'))
      .orderBy(sql`${knowledgeChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
      .limit(limit);

    // Convert distance to similarity score (1 - distance for cosine distance)
    const formattedResults = results.map(r => ({
      chunkId: r.chunkId,
      text: r.text,
      docId: r.docId,
      docTitle: r.docTitle,
      docSource: r.docSource,
      ingestedAt: r.ingestedAt,
      score: 1 - r.distance, // Convert distance to similarity
    }));

    return NextResponse.json({ results: formattedResults });

  } catch (error) {
    console.error('Search error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
