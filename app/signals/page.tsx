import { db } from '@/lib/db';
import { signals } from '@/lib/db/schema';
import { desc, inArray, eq } from 'drizzle-orm';
import SignalsTable from './components/SignalsTable';
import SyncButton from '@/app/components/SyncButton';
import SignalsAutoSync from './components/SignalsAutoSync';

export const dynamic = 'force-dynamic';

const TABS = [
  { id: 'all', label: 'All Signals' },
  { id: 'reddit', label: 'Reddit', sources: ['reddit'] },
  { id: 'hackernews', label: 'Hacker News', sources: ['hackernews'] },
  { id: 'producthunt', label: 'Product Hunt', sources: ['producthunt'] },
  { id: 'vc', label: 'VC & Blogs', sources: ['yc', 'vc_rss', 'gdelt'] },
  { id: 'appstore', label: 'App Stores', sources: ['appstore', 'playstore'] },
  { id: 'playstore', label: 'Play Store', sources: ['playstore'] },
];

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const activeTabId = params.tab || 'all';

  // Find the selected tab config
  const activeTabConfig = TABS.find(t => t.id === activeTabId) || TABS[0];

  // Construct query
  let query = db.select().from(signals).orderBy(desc(signals.timestamp)).limit(200);

  // Apply source filter if not "all"
  if (activeTabConfig.id !== 'all' && activeTabConfig.sources) {
    // @ts-expect-error - dynamic where clause
    query = db.select()
      .from(signals)
      .where(inArray(signals.source, activeTabConfig.sources))
      .orderBy(desc(signals.timestamp))
      .limit(200);
  }

  const signalsData = await query;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <SignalsAutoSync />
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
