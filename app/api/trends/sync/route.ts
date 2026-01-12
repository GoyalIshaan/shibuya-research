import { NextResponse, NextRequest } from 'next/server';
import { IngestService } from '@/lib/ingestion/ingest';
import { MONITORING_CONFIG } from '@/lib/config';

async function handleSync(request: NextRequest) {
  try {
    const ingest = new IngestService();
    
    // Check if 'source' query param is provided for granular sync
    // e.g. /api/trends/sync?source=reddit
    const { searchParams } = new URL(request.url);
    const sourceParam = searchParams.get('source');

    let params = {};
    
    // Correct logic: Default everything to disabled if sourceParam exists
    // But preserve the CONFIG for the enabled one.
    if (sourceParam) {
        params = {
            reddit: { ...MONITORING_CONFIG.reddit, enabled: sourceParam === 'reddit' },
            producthunt: { ...MONITORING_CONFIG.productHunt, enabled: sourceParam === 'producthunt' },
            appstore: { ...MONITORING_CONFIG.appStore, enabled: sourceParam === 'appstore' },
            playstore: { ...MONITORING_CONFIG.playStore, enabled: sourceParam === 'playstore' },
            hackernews: { ...MONITORING_CONFIG.hackernews, enabled: sourceParam === 'hackernews' },
            rssFeeds: { ...MONITORING_CONFIG.rssFeeds, enabled: sourceParam === 'rssFeeds' },
            yc: { ...MONITORING_CONFIG.yc, enabled: sourceParam === 'yc' },
            gdelt: { ...MONITORING_CONFIG.gdelt, enabled: sourceParam === 'gdelt' },
        };
    } else {
        // Run all (default behavior)
        params = {}; 
    }

    const ingestedSignals = await ingest.run(params);
    const count = ingestedSignals.length;

    return NextResponse.json({ 
      success: true, 
      count,
      signals: ingestedSignals,
      message: `Ingested ${count} new signals`
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}
