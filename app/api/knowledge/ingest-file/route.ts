import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { knowledgeDocs, knowledgeChunks } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';
import { chunkText, estimateTokens } from '@/lib/knowledge/chunking';
import { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '@/lib/knowledge/embeddings';
import pdf from 'pdf-parse';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string || file?.name || 'Untitled';
    const source = formData.get('source') as string || 'pdf-upload';

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Extract text from PDF
    let extractedText: string;
    try {
      const pdfData = await pdf(buffer);
      extractedText = pdfData.text;

      if (!extractedText || extractedText.trim().length === 0) {
        return NextResponse.json(
          { error: 'No text could be extracted from PDF. It may be scanned or image-based.' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('PDF parsing error:', error);
      return NextResponse.json(
        { error: 'Failed to parse PDF file' },
        { status: 400 }
      );
    }

    // Compute content hash
    const contentSha256 = createHash('sha256').update(extractedText).digest('hex');

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
      const [newDoc] = await db
        .insert(knowledgeDocs)
        .values({
          title,
          source,
          metadata: {
            filename: file.name,
            fileSize: file.size,
            mimeType: file.type,
          },
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
      // Chunk the extracted text
      const chunks = chunkText(extractedText, 1000, 200);

      if (chunks.length === 0) {
        throw new Error('No chunks generated from extracted text');
      }

      console.log(`Processing ${chunks.length} chunks from PDF ${file.name}`);

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

      console.log(`Successfully ingested PDF ${file.name} as document ${docId}`);

      return NextResponse.json({
        success: true,
        docId: docId,
        chunks: chunks.length,
        extractedTextLength: extractedText.length,
      });

    } catch (error) {
      console.error('Error processing PDF:', error);
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
