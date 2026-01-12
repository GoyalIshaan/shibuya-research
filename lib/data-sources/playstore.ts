import { Signal, DataSource } from './types';
// import { MONITORING_CONFIG } from '@/lib/config';

export class PlayStoreClient implements DataSource {
  name = 'playstore';

  async fetchSignals(params: { categories?: string[]; collection?: string; maxResults?: number } = {}): Promise<Signal[]> {
    console.log('Fetching Play Store Top Charts...');
    const results: Signal[] = [];

    try {
      const gplay = await import('google-play-scraper');
      // Cast to any to avoid type issues with the library import
      const scraper = gplay.default as any;
      const categories = params.categories?.length
        ? params.categories
        : ['MUSIC_AND_AUDIO'];
      const collection = params.collection || 'TOP_FREE';
      const maxResults = params.maxResults ?? 200;

      for (const categoryName of categories) {
        const category = scraper.category[categoryName];
        if (!category) continue;

        const apps = await scraper.list({
          category,
          collection: scraper.collection[collection] || scraper.collection.TOP_FREE,
          num: maxResults
        });

        console.log(`Play Store: Found ${apps.length} apps for ${categoryName}`);

        for (const app of apps) {
          const rank = apps.indexOf(app) + 1;
          
          results.push({
              source: 'playstore',
              type: 'ranking',
              authorHandle: app.developer,
              timestamp: new Date(),
              url: app.url, 
              text: `Play Store Ranking #${rank}: ${app.title}\n\n${app.summary}`,
              engagement: { score: rank },
              tags: ['App', 'Android', categoryName, ...(app.scoreText ? [app.scoreText] : [])],
              rawPayload: app, 
              metadata: { 
                  rank: rank,
                  price: app.price || 'Free',
                  icon: app.icon,
                  category: categoryName,
                  collection
              }
          });
        }
      }
    } catch (error) {
        console.error('Error fetching Play Store:', error);
    }

    return results;
  }
}
