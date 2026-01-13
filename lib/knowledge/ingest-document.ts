import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { knowledgeDocs, knowledgeChunks } from '@/lib/db/schema';
import { chunkText, estimateTokens } from '@/lib/knowledge/chunking';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, generateEmbedding } from '@/lib/knowledge/embeddings';

export class KnowledgeIngestError extends Error {
  status: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.status = status;
  }
}

type IngestDocumentInput = {
  title: string;
  text: string;
  source?: string;
  metadata?: Record<string, unknown>;
  logLabel?: string;
};

type IngestDocumentResult = {
  docId: string;
  chunks?: number;
  cached?: boolean;
};

export const ingestDocumentText = async ({
  title,
  text,
  source = 'manual',
  metadata = {},
  logLabel = 'document',
}: IngestDocumentInput): Promise<IngestDocumentResult> => {
  const contentSha256 = createHash('sha256').update(text).digest('hex');

  const existing = await db
    .select()
    .from(knowledgeDocs)
    .where(eq(knowledgeDocs.contentSha256, contentSha256))
    .limit(1);

  if (existing.length > 0) {
    const doc = existing[0];
    if (doc.status === 'ready') {
      return { docId: doc.id, cached: true };
    }
    if (doc.status === 'processing') {
      throw new KnowledgeIngestError('Document is currently processing', 409);
    }
  }

  let docId: string;

  if (existing.length > 0 && existing[0].status === 'failed') {
    docId = existing[0].id;
    await db
      .update(knowledgeDocs)
      .set({
        title,
        source,
        metadata,
        status: 'processing',
        ingestedAt: new Date(),
        error: null,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDim: EMBEDDING_DIMENSIONS,
      })
      .where(eq(knowledgeDocs.id, docId));
  } else {
    const [newDoc] = await db
      .insert(knowledgeDocs)
      .values({
        title,
        source,
        metadata,
        contentSha256,
        status: 'processing',
        ingestedAt: new Date(),
        embeddingModel: EMBEDDING_MODEL,
        embeddingDim: EMBEDDING_DIMENSIONS,
      })
      .returning();
    docId = newDoc.id;
  }

  try {
    const chunks = chunkText(text, 1000, 200);

    if (chunks.length === 0) {
      throw new KnowledgeIngestError('No chunks generated from text', 400);
    }

    console.log(`Processing ${chunks.length} chunks for ${logLabel} ${docId}`);

    for (const chunk of chunks) {
      const chunkSha256 = createHash('sha256').update(chunk.text).digest('hex');
      const embedding = await generateEmbedding(chunk.text);

      await db.insert(knowledgeChunks).values({
        docId: docId,
        text: chunk.text,
        chunkIndex: chunk.index,
        chunkSha256,
        embedding,
        tokenCount: estimateTokens(chunk.text),
        indexedAt: new Date(),
      });
    }

    await db
      .update(knowledgeDocs)
      .set({ status: 'ready' })
      .where(eq(knowledgeDocs.id, docId));

    return { docId, chunks: chunks.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${logLabel}:`, error);

    await db
      .update(knowledgeDocs)
      .set({ status: 'failed', error: errorMessage })
      .where(eq(knowledgeDocs.id, docId));

    if (error instanceof KnowledgeIngestError) {
      throw error;
    }

    throw new KnowledgeIngestError(errorMessage, 500);
  }
};
