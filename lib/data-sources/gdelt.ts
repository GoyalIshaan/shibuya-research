import axios from 'axios';
import { DataSource, Signal } from './types';

interface GdeltConfig {
  enabled?: boolean;
  maxRecords?: number;
  timespan?: string;
  sourcelang?: string[];
  timeoutMs?: number;
  queries?: Array<{
    name: string;
    query: string;
    tags?: string[];
  }>;
}

type GdeltArticle = {
  url?: string;
  title?: string;
  seendate?: string;
  sourcecountry?: string;
  domain?: string;
  language?: string;
  source?: string;
  socialimage?: string;
  description?: string;
  snippet?: string;
};

export class GdeltClient implements DataSource {
  name = 'gdelt';

  private baseUrl = 'https://api.gdeltproject.org/api/v2/doc/doc';

  async fetchSignals(params: GdeltConfig): Promise<Signal[]> {
    const enabled = params?.enabled !== false;
    if (!enabled) return [];

    const queries = params?.queries || [];
    if (queries.length === 0) {
      console.warn('[gdelt] No queries configured; skipping.');
      return [];
    }

    const maxRecords = params.maxRecords ?? 25;
    const timeoutMs = params.timeoutMs ?? 15000;
    const results: Signal[] = [];

    for (const query of queries) {
      const url = new URL(this.baseUrl);
      url.searchParams.set('query', query.query);
      url.searchParams.set('mode', 'ArtList');
      url.searchParams.set('format', 'json');
      url.searchParams.set('maxrecords', String(maxRecords));
      if (params.timespan) url.searchParams.set('timespan', params.timespan);
      if (params.sourcelang && params.sourcelang.length > 0) {
        url.searchParams.set('sourcelang', params.sourcelang.join(','));
      }

      try {
        const response = await axios.get(url.toString(), {
          timeout: timeoutMs,
          headers: { 'User-Agent': 'ShibuyaConsumerResearch/1.0' },
        });

        const articles: GdeltArticle[] = Array.isArray(response.data?.articles)
          ? response.data.articles
          : [];

        for (const article of articles) {
          const title = article.title || 'GDELT article';
          const description = article.description || article.snippet || '';
          const combinedText = `${title}\n\n${description}`.trim();

          results.push({
            source: 'gdelt',
            type: 'news',
            authorHandle: article.source || article.domain,
            timestamp: this.parseDate(article.seendate),
            url: article.url,
            text: combinedText,
            engagement: {},
            tags: ['news', ...(query.tags || [])],
            metadata: {
              queryName: query.name,
              sourceCountry: article.sourcecountry,
              domain: article.domain,
              language: article.language,
              source: article.source,
              socialImage: article.socialimage,
            },
            rawPayload: article as unknown as Record<string, unknown>,
          });
        }
      } catch (error) {
        console.error(`[gdelt] Error fetching query "${query.name}":`, error);
      }
    }

    return results;
  }

  private parseDate(value?: string): Date {
    if (!value) return new Date();
    if (/^\d{14}$/.test(value)) {
      const year = Number(value.slice(0, 4));
      const month = Number(value.slice(4, 6)) - 1;
      const day = Number(value.slice(6, 8));
      const hour = Number(value.slice(8, 10));
      const minute = Number(value.slice(10, 12));
      const second = Number(value.slice(12, 14));
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date();
  }
}
