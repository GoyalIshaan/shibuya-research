import { searchSignals } from '@/lib/api/signals';
import { errorResponse, successResponse } from '@/lib/api/responses';

export async function GET() {
  try {
    const recentSignals = await searchSignals({ limit: 20, sort: 'newest' });

    return successResponse({ signals: recentSignals });
  } catch (error) {
    console.error('Error fetching recent signals:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch recent signals';
    return errorResponse(message, 500);
  }
}
