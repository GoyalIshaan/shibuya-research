import { NextRequest } from 'next/server';
import { searchKnowledgeBase } from '@/lib/knowledge/search';
import { validateNonEmpty, ValidationError } from '@/lib/api/validation';
import { errorResponse, successResponse } from '@/lib/api/responses';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, topK = 5 } = body;

    validateNonEmpty(query, 'query');

    const results = await searchKnowledgeBase(query, topK);

    return successResponse({ results });
  } catch (error) {
    console.error('Search error:', error);

    if (error instanceof ValidationError) {
      return errorResponse(error.message, 400);
    }

    const message = error instanceof Error ? error.message : String(error);
    return errorResponse(message, 500);
  }
}
