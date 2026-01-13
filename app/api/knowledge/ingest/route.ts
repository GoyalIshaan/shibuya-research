import { NextRequest } from 'next/server';
import { KnowledgeIngestError, ingestDocumentText } from '@/lib/knowledge/ingest-document';
import { validateRequired, validateNonEmpty, ValidationError } from '@/lib/api/validation';
import { errorResponse, successResponse } from '@/lib/api/responses';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, text, source = 'manual', metadata = {} } = body;

    validateRequired(title, 'title');
    validateRequired(text, 'text');
    validateNonEmpty(text, 'text');

    const result = await ingestDocumentText({
      title,
      source,
      text,
      metadata,
      logLabel: 'document',
    });

    if (result.cached) {
      return successResponse({
        docId: result.docId,
        message: 'Document already exists',
        cached: true,
      });
    }

    return successResponse({
      docId: result.docId,
      chunks: result.chunks,
    });
  } catch (error) {
    if (error instanceof KnowledgeIngestError) {
      return errorResponse(error.message, error.status);
    }
    if (error instanceof ValidationError) {
      return errorResponse(error.message, 400);
    }
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(message, 500);
  }
}
