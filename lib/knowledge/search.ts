import { db } from '@/lib/db';
import { knowledgeChunks, knowledgeDocs } from '@/lib/db/schema';
import { generateEmbedding } from '@/lib/knowledge/embeddings';
import { eq, sql } from 'drizzle-orm';

export type KnowledgeSearchResult = {
  chunkId: string;
  text: string;
  docId: string | null;
  docTitle: string | null;
  docSource: string | null;
  ingestedAt: Date | null;
  score: number;
};

/**
 * Search the knowledge base using semantic vector search
 * @param query - The search query text
 * @param topK - Number of results to return (1-20, default: 5)
 * @returns Array of search results sorted by relevance
 */
export async function searchKnowledgeBase(
  query: string,
  topK: number = 5
): Promise<KnowledgeSearchResult[]> {
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
    .where(eq(knowledgeDocs.status, 'ready'))
    .orderBy(
      sql`${knowledgeChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`
    )
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
}
