import { sql } from 'drizzle-orm';
import { signals } from '@/lib/db/schema';

/**
 * SQL expression for calculating engagement score in database queries
 * Sums likes + replies + views + upvotes + score from the engagement JSONB column
 */
export const engagementScoreSQL = sql<number>`
  coalesce((${signals.engagement} ->> 'likes')::int, 0)
  + coalesce((${signals.engagement} ->> 'replies')::int, 0)
  + coalesce((${signals.engagement} ->> 'views')::int, 0)
  + coalesce((${signals.engagement} ->> 'upvotes')::int, 0)
  + coalesce((${signals.engagement} ->> 'score')::int, 0)
`;

/**
 * Calculate engagement score from an engagement object
 * Used for in-memory sorting and filtering
 */
export function calculateEngagement(engagement: Record<string, number | undefined> = {}): number {
  return (
    (engagement.likes ?? 0) +
    (engagement.replies ?? 0) +
    (engagement.views ?? 0) +
    (engagement.upvotes ?? 0) +
    (engagement.score ?? 0)
  );
}
