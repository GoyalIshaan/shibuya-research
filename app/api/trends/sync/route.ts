import { NextRequest } from 'next/server';
import { IngestService } from '@/lib/ingestion/ingest';
import { buildIngestParams } from '@/lib/ingestion/params';
import { errorResponse, successResponse } from '@/lib/api/responses';

export async function POST(request: NextRequest) {
  try {
    const ingest = new IngestService();

    // Check if 'source' query param is provided for granular sync
    // e.g. /api/trends/sync?source=reddit
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get('source') || undefined;
    const params = buildIngestParams(sourceParam);

    const ingestedSignals = await ingest.run(params);
    const count = ingestedSignals.length;

    return successResponse({
      count,
      signals: ingestedSignals,
      message: `Ingested ${count} new signals`,
    });
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(message, 500);
  }
}
