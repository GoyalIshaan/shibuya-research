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
        results.push({
          source: 'producthunt',
          type: 'launch',
          authorHandle: post.author?.name || 'Unknown',
          timestamp: new Date(post.updated || post.published || new Date()),
          url: post.link?.['@_href'] || post.id,
          text: `${post.title}\n\n${post.content || post.summary || ''}`,
          engagement: {
            score: 0 
          },
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
