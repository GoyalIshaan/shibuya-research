import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { Signal, DataSource } from './types';
import * as cheerio from 'cheerio';

interface RssConfig {
  enabled?: boolean;
  /**
   * Optional global include/exclude keyword filtering. If includeKeywords is set,
   * an item must match at least one include keyword.
   */
  includeKeywords?: string[];
  excludeKeywords?: string[];
  maxItemsPerFeed?: number;
  fetchFullText?: boolean;
  minFullTextLength?: number;
  requestTimeoutMs?: number;
  feeds: Array<{
    publisher: string;
    url: string;
    source?: string;
    publisherUrl?: string;
    format?: 'rss' | 'sitemap';
    tags?: string[];
    includeKeywords?: string[];
    excludeKeywords?: string[];
    maxItems?: number;
    fetchFullText?: boolean;
    minFullTextLength?: number;
    includePaths?: string[];
    excludePaths?: string[];
  }>;
}

interface RssItem {
  title?: string;
  link?: string;
  pubDate?: string;
  updated?: string; // Atom
  description?: string;
  content?: string; // Atom or Content encoded
  'content:encoded'?: string;
  guid?: string;
  id?: string; // Atom
  author?: string;
  category?: string | string[];
}

interface SitemapEntry {
  loc?: string;
  lastmod?: string;
}

export class RssFeedsClient implements DataSource {
  name = 'rssFeeds';
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
  }

  private normalizeWhitespace(input: string): string {
    return input
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private stripHtmlToText(input: string): string {
    if (!input) return '';
    const $ = cheerio.load(input);
    $('script, style, nav, footer, header, aside, noscript').remove();
    return this.normalizeWhitespace($.text());
  }

  private extractReadableText(html: string): string {
    if (!html) return '';
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, noscript').remove();

    const article = $('article');
    let text = article.length ? article.text() : '';

    if (!text || text.length < 200) {
      const main = $('main');
      if (main.length) text = main.text();
    }

    if (!text || text.length < 200) {
      text = $('body').text();
    }

    return this.normalizeWhitespace(text);
  }

  private async fetchPageContent(url: string, timeoutMs: number): Promise<{ title: string; description: string; text: string }> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'ShibuyaConsumerResearch/1.0' },
        timeout: timeoutMs
      });
      const html = response.data;
      const $ = cheerio.load(html);
      const title =
        this.stripHtmlToText($('meta[property="og:title"]').attr('content') || '') ||
        this.stripHtmlToText($('title').first().text() || '') ||
        '';
      const description =
        this.stripHtmlToText($('meta[property="og:description"]').attr('content') || '') ||
        this.stripHtmlToText($('meta[name="description"]').attr('content') || '') ||
        '';
      const text = this.extractReadableText(html);
      return { title, description, text };
    } catch (error) {
      console.error(`Error fetching page content for ${url}:`, error);
      return { title: '', description: '', text: '' };
    }
  }

  private async fetchArticleText(url: string, timeoutMs: number): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'ShibuyaConsumerResearch/1.0' },
        timeout: timeoutMs
      });
      return this.extractReadableText(response.data);
    } catch (error) {
      console.error(`Error fetching full text for ${url}:`, error);
      return '';
    }
  }

  private parseSitemap(xmlData: any): SitemapEntry[] {
    const urls = xmlData?.urlset?.url;
    if (!urls) return [];
    return Array.isArray(urls) ? urls : [urls];
  }

  private matchesPath(url: string, includePaths?: string[], excludePaths?: string[]): boolean {
    const include = includePaths || [];
    const exclude = excludePaths || [];
    let path = url;
    try {
      path = new URL(url).pathname || url;
    } catch {
      // keep raw url
    }

    if (exclude.length > 0 && exclude.some((fragment) => fragment && path.includes(fragment))) {
      return false;
    }
    if (include.length > 0) {
      return include.some((fragment) => fragment && path.includes(fragment));
    }
    return true;
  }

  private matchesKeywords(text: string, include: string[] | undefined, exclude: string[] | undefined): boolean {
    const haystack = (text || '').toLowerCase();
    if (exclude?.length) {
      for (const kw of exclude) {
        const needle = kw.toLowerCase().trim();
        if (needle && haystack.includes(needle)) return false;
      }
    }
    if (include?.length) {
      for (const kw of include) {
        const needle = kw.toLowerCase().trim();
        if (needle && haystack.includes(needle)) return true;
      }
      return false;
    }
    return true;
  }

  async fetchSignals(params: RssConfig): Promise<Signal[]> {
    const feeds = params.feeds || [];
    const results: Signal[] = [];
    const globalInclude = params.includeKeywords || [];
    const globalExclude = params.excludeKeywords || [];
    const globalMax = typeof params.maxItemsPerFeed === 'number' ? params.maxItemsPerFeed : undefined;
    const globalFetchFullText = params.fetchFullText ?? false;
    const globalMinFullTextLength = params.minFullTextLength ?? 280;
    const requestTimeoutMs = params.requestTimeoutMs ?? 15000;

    console.log(`Fetching ${feeds.length} RSS feeds...`);

    for (const feed of feeds) {
      try {
        console.log(`Fetching RSS: ${feed.publisher}`);
        const response = await axios.get(feed.url, {
          headers: { 'User-Agent': 'ShibuyaConsumerResearch/1.0' },
          timeout: requestTimeoutMs
        });

        const xmlData = this.parser.parse(response.data);
        const format = feed.format || 'rss';

        if (format === 'sitemap') {
          const urls = this.parseSitemap(xmlData);
          const maxItems = typeof feed.maxItems === 'number' ? feed.maxItems : globalMax;
          const includePaths = feed.includePaths || [];
          const excludePaths = feed.excludePaths || [];
          const slicedItems = urls
            .filter((entry) => entry?.loc && this.matchesPath(String(entry.loc), includePaths, excludePaths))
            .sort((a, b) => {
              const aTime = a?.lastmod ? new Date(a.lastmod).getTime() : 0;
              const bTime = b?.lastmod ? new Date(b.lastmod).getTime() : 0;
              return bTime - aTime;
            })
            .slice(0, typeof maxItems === 'number' ? maxItems : urls.length);

          for (const entry of slicedItems) {
            const urlString = entry.loc ? String(entry.loc) : '';
            if (!urlString) continue;

            const { title, description, text } = await this.fetchPageContent(urlString, requestTimeoutMs);
            const bodyText = text || description;
            const combinedText = `${title || urlString}\n\n${bodyText}`.trim();

            // Keyword filtering (feed-specific overrides + global)
            const include = feed.includeKeywords ?? globalInclude;
            const exclude = feed.excludeKeywords ?? globalExclude;
            if (!this.matchesKeywords(combinedText, include, exclude)) continue;

            const source = feed.source || 'vc_rss';
            const publisherSlug = feed.publisher
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '');

            results.push({
              source,
              type: 'post',
              authorHandle: feed.publisher,
              timestamp: entry.lastmod ? new Date(entry.lastmod) : new Date(),
              url: urlString,
              text: combinedText,
              engagement: {},
              tags: feed.tags || [],
              metadata: {
                publisher: feed.publisher,
                publisherSlug,
                publisherUrl: feed.publisherUrl,
                lastmod: entry.lastmod,
                title,
                summary: description,
                format: 'sitemap'
              },
              rawPayload: entry as unknown as Record<string, unknown>
            });
          }
        } else {
          // Handle RSS 2.0 vs Atom
          let items: RssItem[] = [];
          if (xmlData.rss?.channel?.item) {
            items = Array.isArray(xmlData.rss.channel.item) 
              ? xmlData.rss.channel.item 
              : [xmlData.rss.channel.item];
          } else if (xmlData.feed?.entry) {
            items = Array.isArray(xmlData.feed.entry)
              ? xmlData.feed.entry
              : [xmlData.feed.entry];
          }

          const maxItems = typeof feed.maxItems === 'number' ? feed.maxItems : globalMax;
          const slicedItems = typeof maxItems === 'number' ? items.slice(0, maxItems) : items;

          for (const item of slicedItems) {
            // Date parsing fallback
            const dateStr = item.pubDate || item.updated;
            const timestamp = dateStr ? new Date(dateStr) : new Date();
            
            // Link fallback
            let url = item.link;
            if (typeof url !== 'string' && url && typeof url === 'object') {
               // Atom link often is { @href: '...' }
               url = (url as any)['@_href'] || (url as any).href; 
            }
            if (Array.isArray(item.link)) {
               // Atom might have multiple links
               const alt = item.link.find((l: any) => l['@_rel'] === 'alternate');
               url = alt ? alt['@_href'] : item.link[0];
            }

            if (!url) continue;
            const urlString = typeof url === 'string' ? url : String(url);

            // Text content (prefer the richest field)
            const htmlOrText =
              item['content:encoded'] ||
              item.content ||
              item.description ||
              '';
            const cleanedBody = this.stripHtmlToText(htmlOrText);
            const cleanedTitle = this.stripHtmlToText(item.title || '');

            let bodyText = cleanedBody;
            const shouldFetchFullText = feed.fetchFullText ?? globalFetchFullText;
            const minFullTextLength = feed.minFullTextLength ?? globalMinFullTextLength;

            if (shouldFetchFullText && bodyText.length < minFullTextLength && urlString) {
              const fullText = await this.fetchArticleText(urlString, requestTimeoutMs);
              if (fullText && fullText.length > bodyText.length) {
                bodyText = fullText;
              }
            }

            const combinedText = `${cleanedTitle}\n\n${bodyText}`.trim();

            // Keyword filtering (feed-specific overrides + global)
            const include = feed.includeKeywords ?? globalInclude;
            const exclude = feed.excludeKeywords ?? globalExclude;
            if (!this.matchesKeywords(combinedText, include, exclude)) continue;
            
            const source = feed.source || 'vc_rss';
            const publisherSlug = feed.publisher
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '');

            results.push({
              source,
              type: 'post',
              authorHandle: feed.publisher, // Use publisher as handle for now
              timestamp,
              url: urlString,
              text: combinedText,
              engagement: {}, // RSS doesn't give engagement stats
              tags: feed.tags || [],
              metadata: {
                publisher: feed.publisher,
                publisherSlug,
                publisherUrl: feed.publisherUrl,
                guid: item.guid || item.id,
                categories: item.category,
                title: cleanedTitle,
                summary: cleanedBody
              },
              rawPayload: item as unknown as Record<string, unknown>
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching RSS feed ${feed.publisher}:`, error);
      }
    }

    return results;
  }
}
