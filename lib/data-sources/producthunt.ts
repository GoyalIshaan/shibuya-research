import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { Signal, DataSource } from './types';
import { MONITORING_CONFIG } from '@/lib/config';

export class ProductHuntClient implements DataSource {
  name = 'producthunt';
  
  async fetchSignals(params: { feedUrl?: string } = {}): Promise<Signal[]> {
    console.log('Fetching Product Hunt RSS feed...');
    const results: Signal[] = [];
    const parser = new XMLParser({ ignoreAttributes: false });
    const feedUrl = params.feedUrl || MONITORING_CONFIG.productHunt.feedUrl;

    try {
      const response = await axios.get(feedUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
          }
      });
      
      const feed = parser.parse(response.data);
      const entries = feed.feed?.entry || [];
      
      // Handle single entry case (XML parser quirk)
      const posts = Array.isArray(entries) ? entries : [entries];

      console.log(`Product Hunt: Found ${posts.length} entries`);

      for (const post of posts) {
        // Extract text content from potentially nested XML objects
        const getTextContent = (field: any): string => {
          if (!field) return '';
          if (typeof field === 'string') return field;

          // Handle nested text nodes
          if (field['#text']) {
            const textContent = field['#text'];
            // Recursively extract if #text is still an object
            return typeof textContent === 'string' ? textContent : getTextContent(textContent);
          }

          if (field['#cdata-section']) {
            const cdataContent = field['#cdata-section'];
            return typeof cdataContent === 'string' ? cdataContent : getTextContent(cdataContent);
          }

          // If field is an array, join the text contents
          if (Array.isArray(field)) {
            return field.map(getTextContent).join(' ');
          }

          // If none of the above, check if it's an object with text-like properties
          if (typeof field === 'object') {
            // Try to find any text-like property
            const textProp = Object.keys(field).find(k =>
              k.toLowerCase().includes('text') ||
              k.toLowerCase().includes('content') ||
              k.toLowerCase().includes('value')
            );
            if (textProp && field[textProp]) {
              return getTextContent(field[textProp]);
            }
          }

          return '';
        };

        const content = getTextContent(post.content) || getTextContent(post.summary) || '';
        const title = getTextContent(post.title) || 'Untitled';

        // Validate that we extracted text properly
        if (content.includes('[object Object]') || title.includes('[object Object]')) {
          console.warn('Product Hunt: Failed to extract text properly for post:', {
            title: post.title,
            content: post.content,
            summary: post.summary,
            extractedTitle: title,
            extractedContent: content
          });
          // Skip this entry rather than storing broken data
          continue;
        }

        // Note: Product Hunt's public RSS feed does not include engagement metrics
        // (votes, comments, etc.). To get engagement data, you would need to use
        // the Product Hunt API or scrape the website.

        results.push({
          source: 'producthunt',
          type: 'launch',
          authorHandle: post.author?.name || 'Unknown',
          timestamp: new Date(post.updated || post.published || new Date()),
          url: post.link?.['@_href'] || post.id,
          text: `${title}\n\n${content}`,
          engagement: {},
          tags: ['Tech', 'Launch'],
          rawPayload: post,
          metadata: {
             id: post.id
          }
        });
      }
    } catch (error) {
      console.error('Error fetching Product Hunt:', error);
    }

    return results;
  }
}
