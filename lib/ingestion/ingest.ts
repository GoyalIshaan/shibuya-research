import { db } from '@/lib/db';
import { signals } from '@/lib/db/schema';
import { Signal, DataSource } from '@/lib/data-sources/types';
import { RedditClient } from '@/lib/data-sources/reddit';
import { ProductHuntClient } from '@/lib/data-sources/producthunt';
import { AppStoreClient } from '@/lib/data-sources/appstore';
import { PlayStoreClient } from '@/lib/data-sources/playstore';
import { HackerNewsClient } from '@/lib/data-sources/hackernews';
import { RssFeedsClient } from '@/lib/data-sources/rss-feeds';
import { YcCompaniesClient } from '@/lib/data-sources/yc-companies';
import { GdeltClient } from '@/lib/data-sources/gdelt';
import { eq, and, gt } from 'drizzle-orm';
import { MONITORING_CONFIG } from '@/lib/config';
import { normalizeSignal } from '@/lib/ingestion/normalize';

export class IngestService {
  private sources: DataSource[];

  constructor() {
    this.sources = [
      new RedditClient(),
      new ProductHuntClient(),
      new AppStoreClient(),
      new PlayStoreClient(),
      new HackerNewsClient(),
      new RssFeedsClient(),
      new YcCompaniesClient(),
      new GdeltClient(),
    ];
  }

  async run(params: Record<string, unknown> = {}) {
    console.log('Starting ingestion run...');
    const ingestedSignals: Signal[] = [];
    const seenUrls = new Set<string>();

    // Use default config if params not provided
    const config: Record<string, unknown> = {
      reddit: params.reddit || MONITORING_CONFIG.reddit,
      producthunt: params.producthunt || MONITORING_CONFIG.productHunt,
      appstore: params.appstore || MONITORING_CONFIG.appStore,
      playstore: params.playstore || MONITORING_CONFIG.playStore,
      hackernews: params.hackernews || MONITORING_CONFIG.hackernews,
      rssFeeds: params.rssFeeds || MONITORING_CONFIG.rssFeeds,
      yc: params.yc || MONITORING_CONFIG.yc,
      gdelt: params.gdelt || MONITORING_CONFIG.gdelt,
    };

    const promises = this.sources.map(async (source) => {
      const sourceParams = (config[source.name] || {}) as { enabled?: boolean };
      
      // Basic enabled check if param exists
      if (sourceParams.enabled === false) {
          console.log(`Skipping ${source.name} (disabled)`);
          return;
      }

      console.log(`Fetching from ${source.name}...`);
      try {
        const fetchedSignals = await source.fetchSignals(sourceParams);
        console.log(`Fetched ${fetchedSignals.length} signals from ${source.name}`);

        for (const sig of fetchedSignals) {
           const normalized = normalizeSignal(sig);
           if (!normalized) continue;

           if (normalized.url) {
             if (seenUrls.has(normalized.url)) continue;
             seenUrls.add(normalized.url);
           }

           const saved = await this.saveSignal(normalized);
           if (saved) ingestedSignals.push(saved);
        }
      } catch (err) {
        console.error(`Error ingesting from ${source.name}:`, err);
      }
    });

    await Promise.allSettled(promises);

    console.log(`Ingestion complete. New signals: ${ingestedSignals.length}`);
    return ingestedSignals;
  }

  async saveSignal(sig: Signal): Promise<Signal | null> {
    if (sig.url) {
      // For rankings, we check if we already have this URL *for this specific batch/timestamp*
      // (Simplified: if we have it within the last 20 hours, skip it. If older, save it as new snapshot)
      const oneDayAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);
      
      const existing = await db.select()
        .from(signals)
        .where(
            and(
                eq(signals.url, sig.url),
                gt(signals.createdAt, oneDayAgo)
            )
        )
        .limit(1);

      if (existing.length > 0) {
        return null;
      }
    }

    try {
      await db.insert(signals).values({
          source: sig.source,
          type: sig.type,
          authorHandle: sig.authorHandle,
          timestamp: sig.timestamp,
          url: sig.url,
          text: sig.text,
          engagement: sig.engagement,
          language: sig.language,
          tags: sig.tags,
          rawPayload: sig.rawPayload,
          metadata: sig.metadata,
      });
      return sig;
    } catch (e) {
      console.error('Failed to save signal:', e);
      return null;
    }
  }
}
