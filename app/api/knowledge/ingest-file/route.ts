import { NextRequest } from 'next/server';
import { KnowledgeIngestError, ingestDocumentText } from '@/lib/knowledge/ingest-document';
import { errorResponse, successResponse } from '@/lib/api/responses';
import pdf from 'pdf-parse';

export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const title = (formData.get('title') as string) || file?.name || 'Untitled';
    const source = (formData.get('source') as string) || 'pdf-upload';

    // Validate file
    if (!file) {
      return errorResponse('No file provided', 400);
    }

    if (file.type !== 'application/pdf') {
      return errorResponse('Only PDF files are supported', 400);
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
        return errorResponse('No text could be extracted from PDF. It may be scanned or image-based.', 400);
      }
    } catch (error) {
      console.error('PDF parsing error:', error);
      return errorResponse('Failed to parse PDF file', 400);
    }

    const result = await ingestDocumentText({
      title,
      source,
      text: extractedText,
      metadata: {
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      logLabel: `PDF ${file.name}`,
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
      extractedTextLength: extractedText.length,
    });
  } catch (error) {
    if (error instanceof KnowledgeIngestError) {
      return errorResponse(error.message, error.status);
    }
    console.error('API Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(message, 500);
  }
}
