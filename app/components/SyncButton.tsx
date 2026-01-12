'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Signal } from '@/lib/data-sources/types';
import { useSignalsStore } from '@/lib/store/signals';

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    message: string;
    signals?: Signal[];
    error?: string;
  } | null>(null);
  const router = useRouter();
  const existingSignals = useSignalsStore(state => state.signals);
  const setSignals = useSignalsStore(state => state.setSignals);

  const mergeSignals = (existing: Signal[], incoming: Signal[]) => {
    const merged: Signal[] = [];
    const seen = new Set<string>();

    const makeKey = (signal: Signal) => {
      if (signal.url) return `url:${signal.url}`;
      const time = new Date(signal.timestamp);
      const timeKey = Number.isNaN(time.getTime()) ? 'unknown' : time.toISOString();
      return `fallback:${signal.source}|${timeKey}|${signal.text.slice(0, 120)}`;
    };

    const addSignal = (signal: Signal) => {
      const key = makeKey(signal);
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(signal);
    };

    incoming.forEach(addSignal);
    existing.forEach(addSignal);

    merged.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    return merged;
  };

  const handleSync = async () => {
    setLoading(true);
    setResult(null);
    
    let totalSignals: Signal[] = [];

    try {
      const res = await fetch('/api/trends/sync', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Unknown error');
      }

      totalSignals = data.signals || [];
      const mergedSignals = mergeSignals(existingSignals, totalSignals);
      setSignals(mergedSignals);
      router.refresh();

      setResult({
        success: true,
        count: totalSignals.length,
        message: `Synced all sources. Found ${totalSignals.length} new signals.`,
        signals: totalSignals
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      setResult({
        success: false,
        count: 0,
        message: 'Sync failed.',
        error: err?.message || 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded shadow bg-white">
      <div className="flex justify-between items-center mb-4">
        <div>
            <h2 className="text-xl font-bold">Data Sync</h2>
            {loading && <p className="text-xs text-gray-500 mt-1">Syncing all sources...</p>}
        </div>
        <button
          onClick={handleSync}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
        >
          {loading ? 'Syncing...' : 'Sync Trends Now'}
        </button>
      </div>

      {result?.error && !result.success && (
        <div className="p-3 bg-red-50 text-red-700 rounded mb-4 text-sm">
          Error: {result.error}
        </div>
      )}

      {result?.success && (
        <div className={`mb-4 text-sm font-medium ${result.message.includes('errors') ? 'text-orange-700' : 'text-green-700'}`}>
          {result.message}
        </div>
      )}

      {/* Only show result list if successful */}
      {result?.signals && result.signals.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="font-semibold text-lg border-b pb-2">
            Ingested Signals ({result.count})
          </h3>
          <div className="grid gap-4 max-h-[600px] overflow-y-auto pr-2">
            {result.signals.map((signal: Signal, idx: number) => (
              <div 
                key={`${signal.source}-${idx}`} 
                className="p-4 border rounded-lg bg-gray-50 hover:bg-white hover:shadow-md transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-200 text-gray-700">
                      {String(signal.metadata?.publisher || signal.metadata?.queryName || signal.source)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                        {signal.type}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    {new Date(signal.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="mb-3">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {signal.text.length > 300 
                            ? `${signal.text.substring(0, 300)}...` 
                            : signal.text}
                    </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
