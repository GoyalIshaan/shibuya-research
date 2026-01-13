import axios from 'axios';
import { Signal, DataSource } from './types';
import { MONITORING_CONFIG } from '@/lib/config';

export class AppStoreClient implements DataSource {
  name = 'appstore';

  async fetchSignals(params: { feedUrl?: string } = {}): Promise<Signal[]> {
    console.log('Fetching App Store Top Charts...');
    const results: Signal[] = [];
    const feedUrl = params.feedUrl || MONITORING_CONFIG.appStore.feedUrl;

    try {
      const response = await axios.get(feedUrl);
      const feed = response.data?.feed;
      const entries = feed?.entry || [];

      console.log(`App Store: Found ${entries.length} entries`);

      for (const [index, app] of entries.entries()) {
        const rank = index + 1;
        results.push({
          source: 'appstore',
          type: 'ranking',
          authorHandle: app['im:artist']?.label,
          timestamp: new Date(), // Rankings are "current"
          url: app.link?.attributes?.href || app.id?.label,
          text: `App Store Ranking #${rank}: ${app['im:name']?.label}\n\n${app.summary?.label || ''}`,
          engagement: {},
          tags: ['App', 'Mobile', app.category?.attributes?.label],
          rawPayload: app,
          metadata: {
            rank: rank,
            category: app.category?.attributes?.label,
            price: app['im:price']?.label
          }
        });
      }
    } catch (error) {
        console.error('Error fetching App Store:', error);
    }

    return results;
  }
}
