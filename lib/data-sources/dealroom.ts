import axios from 'axios';
import { DataSource, Signal } from './types';

interface DealroomConfig {
  enabled?: boolean;
  /**
   * Dealroom API access is typically enterprise; this integration is optional.
   */
  apiKey?: string;
  /**
   * Base URL for Dealroom API (if you have access), or provide explicit endpoints below.
   */
  baseUrl?: string;
  endpoints?: Array<{
    name: string;
    url: string;
    tags?: string[];
    itemsPath?: string;
    titlePath?: string;
    summaryPath?: string;
    urlPath?: string;
    datePath?: string;
    idPath?: string;
  }>;
  timeoutMs?: number;
}

export class DealroomClient implements DataSource {
  name = 'dealroom';

  async fetchSignals(params: DealroomConfig): Promise<Signal[]> {
    const enabled = params?.enabled !== false;
    if (!enabled) return [];

    const apiKey = params.apiKey || process.env.DEALROOM_API_KEY;
    const baseUrl = params.baseUrl || process.env.DEALROOM_API_BASE_URL;
    const endpoints = params.endpoints || [];
    const timeoutMs = params.timeoutMs ?? 15000;

    if (!apiKey) {
      console.warn('[dealroom] Missing DEALROOM_API_KEY; skipping.');
      return [];
    }
    if (!baseUrl && endpoints.length === 0) {
      console.warn('[dealroom] Missing DEALROOM_API_BASE_URL and no endpoints provided; skipping.');
      return [];
    }

    const results: Signal[] = [];
    const urls = endpoints.length
      ? endpoints.map((e) => ({ name: e.name, url: e.url, tags: e.tags || [] }))
      : [{ name: 'root', url: baseUrl!, tags: ['dealroom'] }];

    for (const target of urls) {
      try {
        const resp = await axios.get(target.url, {
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'ShibuyaConsumerResearch/1.0',
            Authorization: `Bearer ${apiKey}`,
          },
        });

        const endpointConfig = endpoints.find((e) => e.url === target.url);
        const items = this.extractItems(resp.data, endpointConfig?.itemsPath);

        if (items && items.length > 0) {
          for (const item of items) {
            const mapped = this.mapItemToSignal(item, target, endpointConfig);
            if (mapped) results.push(mapped);
          }
        } else {
          results.push({
            source: 'dealroom',
            type: 'company_dataset',
            authorHandle: 'Dealroom',
            timestamp: new Date(),
            url: target.url,
            text: `Dealroom fetch: ${target.name}`.trim(),
            engagement: {},
            tags: ['dealroom', ...target.tags],
            metadata: {
              endpointName: target.name,
            },
            rawPayload: resp.data as unknown as Record<string, unknown>,
          });
        }
      } catch (err) {
        console.error(`[dealroom] Error fetching ${target.url}:`, err);
      }
    }

    return results;
  }

  private extractItems(payload: unknown, itemsPath?: string): unknown[] | null {
    if (!payload) return null;
    if (itemsPath) {
      const extracted = this.getByPath(payload, itemsPath);
      return Array.isArray(extracted) ? extracted : null;
    }
    if (Array.isArray(payload)) return payload;

    const candidates = ['items', 'data', 'entities', 'results'];
    for (const key of candidates) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
    return null;
  }

  private mapItemToSignal(
    item: unknown,
    target: { name: string; url: string; tags: string[] },
    mapping?: {
      titlePath?: string;
      summaryPath?: string;
      urlPath?: string;
      datePath?: string;
      idPath?: string;
    }
  ): Signal | null {
    if (!item || typeof item !== 'object') return null;
    const obj = item as Record<string, unknown>;

    const title =
      this.pickString(obj, mapping?.titlePath, ['name', 'title']) ||
      'Dealroom item';
    const summary =
      this.pickString(obj, mapping?.summaryPath, ['short_description', 'description', 'summary']) ||
      '';
    const url =
      this.pickString(obj, mapping?.urlPath, ['url', 'homepage_url', 'website']) ||
      target.url;
    const dateValue =
      this.pickString(obj, mapping?.datePath, ['updated_at', 'created_at', 'founded_on', 'announced_on']) ||
      '';

    const text = summary ? `${title}\n\n${summary}` : title;

    return {
      source: 'dealroom',
      type: 'company',
      authorHandle: 'Dealroom',
      timestamp: this.parseDate(dateValue),
      url,
      text,
      engagement: {},
      tags: ['dealroom', ...target.tags],
      metadata: {
        endpointName: target.name,
        itemId:
          this.pickString(obj, mapping?.idPath, ['uuid', 'id', 'permalink']) ||
          undefined,
      },
      rawPayload: obj as unknown as Record<string, unknown>,
    };
  }

  private getByPath(obj: unknown, path?: string): unknown {
    if (!path || !obj || typeof obj !== 'object') return undefined;
    return path.split('.').reduce((acc: unknown, key: string): unknown => {
      if (!acc || typeof acc !== 'object') return undefined;
      return (acc as Record<string, unknown>)[key];
    }, obj as Record<string, unknown>);
  }

  private pickString(
    obj: Record<string, unknown>,
    explicitPath: string | undefined,
    fallbackKeys: string[]
  ): string | undefined {
    if (explicitPath) {
      const value = this.getByPath(obj, explicitPath);
      return this.coerceString(value);
    }
    for (const key of fallbackKeys) {
      const value = obj[key];
      const coerced = this.coerceString(value);
      if (coerced) return coerced;
    }
    return undefined;
  }

  private coerceString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return undefined;
  }

  private parseDate(value: string): Date {
    if (!value) return new Date();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date();
  }
}
