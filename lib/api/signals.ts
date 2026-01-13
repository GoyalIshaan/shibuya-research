import { db } from '@/lib/db';
import { signals } from '@/lib/db/schema';
import { and, asc, desc, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { engagementScoreSQL, calculateEngagement } from '@/lib/signals/engagement';

export type SignalSnapshot = {
  id?: string;
  source: string;
  type: string;
  authorHandle?: string;
  timestamp?: string;
  url?: string;
  text: string;
  engagement?: Record<string, number | undefined>;
  language?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
};

/**
 * Parse a date string to Date object, returns undefined if invalid
 */
function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Normalize a database signal row to a clean SignalSnapshot object
 */
export function normalizeSignalRow(row: {
  id: string | null;
  source: string | null;
  type: string | null;
  authorHandle: string | null;
  timestamp: Date | null;
  url: string | null;
  text: string | null;
  engagement: unknown;
  language: string | null;
  tags: unknown;
  metadata: unknown;
}): SignalSnapshot {
  return {
    id: row.id ?? undefined,
    source: row.source ?? '',
    type: row.type ?? '',
    authorHandle: row.authorHandle ?? undefined,
    timestamp: row.timestamp ? row.timestamp.toISOString() : undefined,
    url: row.url ?? undefined,
    text: row.text ?? '',
    engagement: (row.engagement as Record<string, number | undefined>) ?? {},
    language: row.language ?? undefined,
    tags: (row.tags as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

/**
 * Build SQL filters from search arguments
 */
export function buildSignalFilters(args: Record<string, unknown>) {
  const filters = [];
  const query = typeof args.query === 'string' ? args.query.trim() : '';
  const sources = Array.isArray(args.sources)
    ? (args.sources.filter((item) => typeof item === 'string') as string[])
    : [];
  const types = Array.isArray(args.types)
    ? (args.types.filter((item) => typeof item === 'string') as string[])
    : [];

  if (query) {
    const tokens = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 1) {
      filters.push(ilike(signals.text, `%${tokens[0]}%`));
    } else {
      filters.push(or(...tokens.map((token) => ilike(signals.text, `%${token}%`))));
    }
  }

  if (sources.length > 0) {
    filters.push(inArray(signals.source, sources));
  }

  if (types.length > 0) {
    filters.push(inArray(signals.type, types));
  }

  const startDate = toDate(args.startDate as string | undefined);
  const endDate = toDate(args.endDate as string | undefined);
  const sinceDays = typeof args.sinceDays === 'number' ? args.sinceDays : undefined;

  if (sinceDays && Number.isFinite(sinceDays)) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    filters.push(gte(signals.timestamp, since));
  }

  if (startDate) {
    filters.push(gte(signals.timestamp, startDate));
  }

  if (endDate) {
    filters.push(lte(signals.timestamp, endDate));
  }

  if (typeof args.minEngagement === 'number') {
    filters.push(sql`${engagementScoreSQL} >= ${args.minEngagement}`);
  }

  return filters;
}

/**
 * Search signals in the database with filters and sorting
 */
export async function searchSignals(args: Record<string, unknown>): Promise<SignalSnapshot[]> {
  const filters = buildSignalFilters(args);
  const limitInput = typeof args.limit === 'number' ? args.limit : undefined;
  const limit = Math.min(Math.max(limitInput ?? 20, 1), 100);
  const sort = typeof args.sort === 'string' ? args.sort : 'newest';

  const orderByColumn =
    sort === 'oldest'
      ? asc(signals.timestamp)
      : sort === 'engagement'
        ? desc(engagementScoreSQL)
        : desc(signals.timestamp);

  const baseQuery = db
    .select({
      id: signals.id,
      source: signals.source,
      type: signals.type,
      authorHandle: signals.authorHandle,
      timestamp: signals.timestamp,
      url: signals.url,
      text: signals.text,
      engagement: signals.engagement,
      language: signals.language,
      tags: signals.tags,
      metadata: signals.metadata,
    })
    .from(signals);

  const rows =
    filters.length > 0
      ? await baseQuery.where(and(...filters)).orderBy(orderByColumn).limit(limit)
      : await baseQuery.orderBy(orderByColumn).limit(limit);

  return rows.map(normalizeSignalRow);
}

/**
 * Search signals in a cached array (in-memory filtering)
 */
export function searchCachedSignals(
  args: Record<string, unknown>,
  cache: SignalSnapshot[]
): SignalSnapshot[] {
  const query = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
  const sources = Array.isArray(args.sources)
    ? (args.sources.filter((item) => typeof item === 'string') as string[])
    : [];
  const types = Array.isArray(args.types)
    ? (args.types.filter((item) => typeof item === 'string') as string[])
    : [];
  const sinceDays = typeof args.sinceDays === 'number' ? args.sinceDays : undefined;
  const limitInput = typeof args.limit === 'number' ? args.limit : undefined;
  const limit = Math.min(Math.max(limitInput ?? 50, 1), 200);
  const sort = typeof args.sort === 'string' ? args.sort : 'newest';

  let filtered = cache.slice();

  if (query) {
    filtered = filtered.filter((item) => item.text.toLowerCase().includes(query));
  }

  if (sources.length > 0) {
    filtered = filtered.filter((item) => sources.includes(item.source));
  }

  if (types.length > 0) {
    filtered = filtered.filter((item) => types.includes(item.type));
  }

  if (sinceDays && Number.isFinite(sinceDays)) {
    const since = new Date();
    since.setDate(since.getDate() - sinceDays);
    filtered = filtered.filter((item) => {
      const timestamp = item.timestamp ? new Date(item.timestamp) : undefined;
      return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp >= since : false;
    });
  }

  if (typeof args.minEngagement === 'number') {
    const minEngagement = args.minEngagement;
    filtered = filtered.filter((item) => {
      const engagement = item.engagement ?? {};
      const score = calculateEngagement(engagement);
      return score >= minEngagement;
    });
  }

  if (sort === 'oldest') {
    filtered.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB;
    });
  } else if (sort === 'engagement') {
    filtered.sort((a, b) => calculateEngagement(b.engagement ?? {}) - calculateEngagement(a.engagement ?? {}));
  } else {
    filtered.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }

  return filtered.slice(0, limit);
}
