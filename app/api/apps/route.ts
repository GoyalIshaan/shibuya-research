import { searchSignals } from '@/lib/api/signals';
import { errorResponse, successResponse } from '@/lib/api/responses';

export async function GET() {
  try {
    // Fetch app store signals sorted by timestamp
    const rawApps = await searchSignals({
      sources: ['appstore', 'playstore'],
      limit: 100,
      sort: 'newest',
    });

    // Deduplicate: Keep only the most recent entry for each app (based on URL or unique title)
    const uniqueAppsMap = new Map();

    for (const app of rawApps) {
      // Use URL as primary key, fallback to title logic if needed
      // For AppStore/PlayStore, URL should be stable and unique per app
      const key = app.url || app.text.split('\n')[0];

      if (!uniqueAppsMap.has(key)) {
        uniqueAppsMap.set(key, app);
      }
    }

    const apps = Array.from(uniqueAppsMap.values());

    return successResponse({ apps });
  } catch (error) {
    console.error('Error fetching top apps:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch apps';
    return errorResponse(message, 500);
  }
}
