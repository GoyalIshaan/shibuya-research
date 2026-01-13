import { MONITORING_CONFIG } from '@/lib/config';

export type IngestParams = Record<string, unknown>;

export const buildIngestParams = (source?: string): IngestParams => {
  if (!source) return {};

  return {
    reddit: { ...MONITORING_CONFIG.reddit, enabled: source === 'reddit' },
    producthunt: { ...MONITORING_CONFIG.productHunt, enabled: source === 'producthunt' },
    appstore: { ...MONITORING_CONFIG.appStore, enabled: source === 'appstore' },
    playstore: { ...MONITORING_CONFIG.playStore, enabled: source === 'playstore' },
    hackernews: { ...MONITORING_CONFIG.hackernews, enabled: source === 'hackernews' },
    rssFeeds: { ...MONITORING_CONFIG.rssFeeds, enabled: source === 'rssFeeds' },
    yc: { ...MONITORING_CONFIG.yc, enabled: source === 'yc' },
    gdelt: { ...MONITORING_CONFIG.gdelt, enabled: source === 'gdelt' },
  };
};
