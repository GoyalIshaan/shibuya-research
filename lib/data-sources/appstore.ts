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

      for (const app of entries) {
        results.push({
          source: 'appstore',
          type: 'ranking',
          authorHandle: app['im:artist']?.label,
          timestamp: new Date(), // Rankings are "current"
          url: app.link?.attributes?.href || app.id?.label,
          text: `App Store Ranking #${entries.indexOf(app) + 1}: ${app['im:name']?.label}\n\n${app.summary?.label || ''}`,
          engagement: {
             score: entries.indexOf(app) + 1 
          },
          tags: ['App', 'Mobile', app.category?.attributes?.label],
          rawPayload: app,
          metadata: {
            rank: entries.indexOf(app) + 1,
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
