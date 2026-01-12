import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { knowledgeDocs, knowledgeChunks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { chunkText, estimateTokens } from '@/lib/knowledge/chunking';
import { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '@/lib/knowledge/embeddings';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, text, source = 'manual', metadata = {} } = body;

    // Validate input
    if (!title || !text) {
      return NextResponse.json(
        { error: 'Missing title or text' },
        { status: 400 }
      );
    }

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text must be a non-empty string' },
        { status: 400 }
      );
    }

    // Compute content hash for deduplication
    const contentSha256 = createHash('sha256').update(text).digest('hex');

    // Check if document already exists
    const existing = await db
      .select()
      .from(knowledgeDocs)
      .where(eq(knowledgeDocs.contentSha256, contentSha256))
      .limit(1);

    if (existing.length > 0) {
      const doc = existing[0];
      if (doc.status === 'ready') {
        return NextResponse.json({
          success: true,
          docId: doc.id,
          message: 'Document already exists',
          cached: true,
        });
      }
      if (doc.status === 'processing') {
        return NextResponse.json(
          { error: 'Document is currently processing' },
          { status: 409 }
        );
      }
    }

    // Create or update document record
    let docId: string;

    if (existing.length > 0 && existing[0].status === 'failed') {
      // Retry failed document
      docId = existing[0].id;
      await db
        .update(knowledgeDocs)
        .set({
          status: 'processing',
          ingestedAt: new Date(),
          error: null,
          embeddingModel: EMBEDDING_MODEL,
          embeddingDim: EMBEDDING_DIMENSIONS,
        })
        .where(eq(knowledgeDocs.id, docId));
    } else {
      // Create new document
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
      // Chunk the text
      const chunks = chunkText(text, 1000, 200);

      if (chunks.length === 0) {
        throw new Error('No chunks generated from text');
      }

      console.log(`Processing ${chunks.length} chunks for document ${docId}`);

      // Process each chunk
      for (const chunk of chunks) {
        const chunkSha256 = createHash('sha256').update(chunk.text).digest('hex');

        // Generate embedding
        const embedding = await generateEmbedding(chunk.text);

        // Insert chunk with embedding
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

      // Mark document as ready
      await db
        .update(knowledgeDocs)
        .set({ status: 'ready' })
        .where(eq(knowledgeDocs.id, docId));

      console.log(`Successfully ingested document ${docId} with ${chunks.length} chunks`);

      return NextResponse.json({
        success: true,
        docId: docId,
        chunks: chunks.length,
      });

    } catch (error) {
      console.error('Error processing document:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Mark document as failed
      await db
        .update(knowledgeDocs)
        .set({ status: 'failed', error: errorMessage })
        .where(eq(knowledgeDocs.id, docId));

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
