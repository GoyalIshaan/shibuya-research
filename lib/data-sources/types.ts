export interface Signal {
  source: string; // reddit, producthunt, appstore, twitter, youtube
  type: string; // post, comment, review, launch
  authorHandle?: string;
  timestamp: Date;
  url?: string;
  text: string;
  engagement: {
    likes?: number;
    replies?: number;
    views?: number;
    upvotes?: number;
    score?: number;
  };
  language?: string;
  tags?: string[];
  rawPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>; // Extra source-specific fields
}

export interface DataSource {
  name: string;
  fetchSignals(params: unknown): Promise<Signal[]>;
}
