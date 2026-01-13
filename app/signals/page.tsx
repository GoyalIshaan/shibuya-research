import { db } from '@/lib/db';
import { signals } from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import SignalsTable from './components/SignalsTable';
import SyncButton from '@/app/components/SyncButton';
import type { StoreSignal } from '@/lib/store/signals';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'all', label: 'All Signals' },
  { id: 'reddit', label: 'Reddit', sources: ['reddit'] },
  { id: 'hackernews', label: 'Hacker News', sources: ['hackernews'] },
  { id: 'producthunt', label: 'Product Hunt', sources: ['producthunt'] },
  { id: 'vc', label: 'VC & Blogs', sources: ['yc', 'vc_rss', 'gdelt'] },
  { id: 'appstore', label: 'App Store', sources: ['appstore'] },
  { id: 'playstore', label: 'Play Store', sources: ['playstore'] },
];

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTabId = tab || 'all';

  // Find the selected tab config
  const activeTabConfig = TABS.find(t => t.id === activeTabId) || TABS[0];

  const baseQuery = db
    .select()
    .from(signals)
    .orderBy(desc(signals.timestamp))
    .limit(200);

  const rawSignals =
    activeTabConfig.id !== 'all' && activeTabConfig.sources
      ? await db
          .select()
          .from(signals)
          .where(inArray(signals.source, activeTabConfig.sources))
          .orderBy(desc(signals.timestamp))
          .limit(200)
      : await baseQuery;

  // Cast to StoreSignal[] to satisfy type checker
  const signalsData: StoreSignal[] = rawSignals.map(s => ({
    ...s,
    metadata: s.metadata as Record<string, unknown> | null,
  }));

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold">Signals Feed</h1>
                <p className="text-gray-500 mt-2">Raw feed of data from monitored sources.</p>
            </div>
        </div>
        <SyncButton />
      </div>

      <SignalsTable initialSignals={signalsData} activeTab={activeTabId} />
    </div>
  );
}
