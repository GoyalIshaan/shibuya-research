import { Signal, DataSource } from './types';

export class PlayStoreClient implements DataSource {
  name = 'playstore';

  async fetchSignals(params: { categories?: string[]; collection?: string; maxResults?: number } = {}): Promise<Signal[]> {
    console.log('Fetching Play Store Top Charts...');
    const results: Signal[] = [];

    try {
      const gplay = await import('google-play-scraper');
      type PlayStoreApp = {
        developer?: string;
        url?: string;
        title?: string;
        summary?: string;
        scoreText?: string;
        price?: string;
        icon?: string;
      };
      type PlayStoreScraper = {
        category: Record<string, string>;
        collection: Record<string, string>;
        list: (options: { category: string; collection: string; num: number }) => Promise<PlayStoreApp[]>;
      };
      const scraper = gplay.default as unknown as PlayStoreScraper;
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

        for (const [index, app] of apps.entries()) {
          const rank = index + 1;
          
          results.push({
              source: 'playstore',
              type: 'ranking',
              authorHandle: app.developer,
              timestamp: new Date(),
              url: app.url,
              text: `Play Store Ranking #${rank}: ${app.title}\n\n${app.summary}`,
              engagement: {},
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
