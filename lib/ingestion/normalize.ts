import * as cheerio from 'cheerio';
import { Signal } from '@/lib/data-sources/types';

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_reader',
  'utm_viz_id',
  'utm_pubreferrer',
  'utm_swu',
  'gclid',
  'fbclid',
  'mc_cid',
  'mc_eid',
  'ref',
  'ref_src',
  'ref_url'
]);

function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtmlIfNeeded(input: string): string {
  if (!input) return '';
  if (!/<[a-z][\s\S]*>/i.test(input)) return input;
  const $ = cheerio.load(input);
  $('script, style, nav, footer, header, aside, noscript').remove();
  return $.text();
}

export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    for (const key of Array.from(url.searchParams.keys())) {
      const lower = key.toLowerCase();
      if (lower.startsWith('utm_') || TRACKING_PARAMS.has(lower)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  const cleaned = tags
    .map((tag) => tag.trim())
    .filter(Boolean);
  return Array.from(new Set(cleaned));
}

function normalizeEngagement(engagement?: Signal['engagement']): Signal['engagement'] {
  const normalized: Signal['engagement'] = {};
  if (!engagement) return normalized;
  for (const [key, value] of Object.entries(engagement)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      normalized[key as keyof Signal['engagement']] = value;
    }
  }
  return normalized;
}

function coerceDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export function normalizeSignal(signal: Signal): Signal | null {
  if (!signal || !signal.text) return null;

  const cleanedText = normalizeWhitespace(stripHtmlIfNeeded(signal.text));
  if (!cleanedText) return null;

  return {
    ...signal,
    source: signal.source?.trim().toLowerCase() || 'unknown',
    type: signal.type?.trim().toLowerCase() || 'unknown',
    text: cleanedText,
    url: signal.url ? normalizeUrl(signal.url) : undefined,
    timestamp: coerceDate(signal.timestamp),
    engagement: normalizeEngagement(signal.engagement),
    tags: normalizeTags(signal.tags),
    metadata: signal.metadata || {},
    rawPayload: signal.rawPayload || {},
    language: signal.language || 'en',
  };
}
