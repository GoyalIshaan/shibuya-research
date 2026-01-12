import axios from 'axios';
import * as cheerio from 'cheerio';
import { Signal, DataSource } from './types';

interface YcConfig {
  pages: string[];
  maxCompaniesPerRun?: number;
}

export class YcCompaniesClient implements DataSource {
  name = 'yc';

  async fetchSignals(params: YcConfig): Promise<Signal[]> {
    const pages = params.pages || ['https://www.ycombinator.com/companies'];
    const maxCompanies = params.maxCompaniesPerRun || 20;
    const results: Signal[] = [];

    console.log(`Fetching YC companies from ${pages.length} pages...`);

    for (const pageUrl of pages) {
      try {
        console.log(`Fetching YC page: ${pageUrl}`);
        const { data: html } = await axios.get(pageUrl, {
          headers: { 
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          }
        });

        const $ = cheerio.load(html);
        
        // Select company cards - selectors might need adjustment based on YC's current markup
        // As of early 2024, they use classes like '._company_86jzd_338' or similar dynamic ones
        // So we might need to look for common structures like links containing '/companies/'
        
        const companyLinks = $('a[href^="/companies/"]');
        
        // Dedupe links
        const seenHrefs = new Set<string>();
        
        for (const el of companyLinks) {
          if (results.length >= maxCompanies) break;

          const href = $(el).attr('href');
          if (!href || seenHrefs.has(href)) continue;
          seenHrefs.add(href);

          // Attempt to extract info from the card
          // Usually the link wraps the whole card
          const card = $(el);
          const name = card.find('.coName').text() || card.find('span.font-bold').first().text() || '';
          const description = card.find('.coDescription').text() || card.text(); // Fallback
          const location = card.find('.coLocation').text() || '';
          const batch = card.find('.pill').first().text() || ''; // rough guess

          if (!name) continue;

          const fullUrl = `https://www.ycombinator.com${href}`;
          
          results.push({
            source: 'yc',
            type: 'company_update',
            authorHandle: 'Y Combinator',
            timestamp: new Date(), // Current time as proxy for "detected at"
            url: fullUrl,
            text: `New YC Company Detected: ${name}\n\n${description}`.trim(),
            engagement: {},
            tags: ['startup', 'yc', batch].filter(Boolean),
            metadata: {
              companyName: name,
              ycCompanySlug: href.replace('/companies/', ''),
              batch,
              location
            },
            rawPayload: { href, name, description, batch }
          });
        }

      } catch (error) {
        console.error(`Error fetching YC page ${pageUrl}:`, error);
      }
    }

    return results;
  }
}
