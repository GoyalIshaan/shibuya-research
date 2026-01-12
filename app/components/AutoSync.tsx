'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type AutoSyncProps = {
  /**
   * API endpoint to call. Defaults to running full ingestion.
   * Example: /api/trends/sync or /api/trends/sync?source=rssFeeds
   */
  endpoint?: string;
  method?: 'POST' | 'GET';
  /**
   * Minimum time between sync attempts per browser (ms).
   */
  cooldownMs?: number;
  /**
   * If true, refresh the current route after a successful sync so server components re-fetch.
   */
  refreshOnSuccess?: boolean;
  /**
   * Disable autosync entirely.
   */
  enabled?: boolean;
};

const DEFAULT_ENDPOINT = '/api/trends/sync';
const DEFAULT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function storageKey(endpoint: string) {
  return `shibuya:autoSync:lastRunAt:${endpoint}`;
}

export default function AutoSync({
  endpoint = DEFAULT_ENDPOINT,
  method = 'POST',
  cooldownMs = DEFAULT_COOLDOWN_MS,
  refreshOnSuccess = true,
  enabled = true,
}: AutoSyncProps) {
  const router = useRouter();
  const hasRunRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'skipped' | 'running' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!enabled) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    // Rate-limit per browser
    try {
      const last = Number(localStorage.getItem(storageKey(endpoint)) || '0');
      if (Number.isFinite(last) && last > 0 && Date.now() - last < cooldownMs) {
        setStatus('skipped');
        return;
      }
    } catch {
      // ignore localStorage failures (e.g. privacy mode)
    }

    const run = async () => {
      setStatus('running');
      try {
        const res = await fetch(endpoint, { method });
        const data = await res.json().catch(() => null);
        if (!res.ok || (data && data.success === false)) {
          throw new Error((data && data.error) || `HTTP ${res.status}`);
        }

        try {
          localStorage.setItem(storageKey(endpoint), String(Date.now()));
        } catch {
          // ignore
        }

        setStatus('success');
        if (refreshOnSuccess) router.refresh();
      } catch (e) {
        console.error('[AutoSync] failed:', e);
        setStatus('error');
      }
    };

    void run();
  }, [cooldownMs, enabled, endpoint, method, refreshOnSuccess, router]);

  // Intentionally render nothing; this is a "behavior" component.
  // If you want a visible indicator later, we can expose status and display it.
  return (
    <div className="sr-only" aria-hidden="true" data-autosync-status={status}>
      AutoSync: {status}
    </div>
  );
}

