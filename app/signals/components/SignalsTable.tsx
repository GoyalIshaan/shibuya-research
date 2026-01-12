'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSignalsStore } from '@/lib/store/signals';

const TABS = [
  { id: 'all', label: 'All Signals' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'hackernews', label: 'Hacker News' },
  { id: 'producthunt', label: 'Product Hunt' },
  { id: 'vc', label: 'VC & Blogs' },
  { id: 'appstore', label: 'App Stores' },
  { id: 'playstore', label: 'Play Store' },
];

interface SignalsTableProps {
  initialSignals: any[];
  activeTab?: string;
}

export default function SignalsTable({ initialSignals, activeTab = 'all' }: SignalsTableProps) {
  const [filter, setFilter] = useState('');
  const setSignals = useSignalsStore(state => state.setSignals);

  // Hydrate global store
  useEffect(() => {
    if (initialSignals && initialSignals.length > 0) {
      setSignals(initialSignals);
    }
  }, [initialSignals, setSignals]);

  // Server has already filtered by source/tab, so we only filter by text search here
  const filtered = initialSignals.filter(s => {
    if (filter) {
        const searchLower = filter.toLowerCase();
        return (
            s.text.toLowerCase().includes(searchLower) || 
            s.source.toLowerCase().includes(searchLower) ||
            String(s.metadata?.publisher || '').toLowerCase().includes(searchLower) ||
            String(s.metadata?.queryName || '').toLowerCase().includes(searchLower)
        );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tabs - Now using Links for Server-Side Filtering */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={`/signals?tab=${tab.id}`}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Search & Stats */}
      <div className="flex gap-4 items-center bg-gray-50 p-3 rounded-lg">
        <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">🔍</span>
            </div>
            <input 
                type="text" 
                placeholder={`Search ${filtered.length} signals in ${activeTab === 'all' ? 'all sources' : activeTab}...`}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-blue-300 focus:ring focus:ring-blue-200 sm:text-sm"
                value={filter}
                onChange={e => setFilter(e.target.value)}
            />
        </div>
        <div className="text-sm text-gray-500 font-medium">
            Showing {filtered.length} results
        </div>
      </div>
      
      {/* Table */}
      <div className="border rounded-lg overflow-hidden shadow-sm ring-1 ring-black ring-opacity-5">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Engagement</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filtered.length > 0 ? (
                filtered.map((signal) => {
                  const sourceLabel = String(
                    signal.metadata?.publisher || signal.metadata?.queryName || signal.source
                  );
                  return (
                  <tr key={signal.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top">
                        <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                ${signal.source === 'reddit' ? 'bg-orange-100 text-orange-800' : 
                                  signal.source === 'hackernews' ? 'bg-orange-100 text-orange-800' :
                                  signal.source === 'producthunt' ? 'bg-orange-100 text-orange-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                                {sourceLabel.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-400 capitalize px-1">{signal.type}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xl align-top">
                        <a href={signal.url || '#'} target="_blank" rel="noreferrer" className="block group">
                            <div className="font-medium text-gray-900 group-hover:text-blue-600 group-hover:underline mb-1 line-clamp-2">
                                {signal.text.split('\n')[0]} {/* Title first line */}
                            </div>
                            <div className="text-xs text-gray-400 line-clamp-2">
                                {signal.text.split('\n').slice(1).join(' ')}
                            </div>
                        </a>
                        {signal.tags && signal.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {signal.tags.map((tag: string) => (
                                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-100">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                        <div className="flex flex-col gap-1 text-xs">
                           {signal.engagement?.upvotes !== undefined && <span>⬆️ {signal.engagement.upvotes}</span>}
                           {signal.engagement?.replies !== undefined && <span>💬 {signal.engagement.replies}</span>}
                           {signal.engagement?.score !== undefined && <span>🔥 {signal.engagement.score}</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-top">
                        <div className="flex flex-col">
                            <span>{new Date(signal.timestamp).toLocaleDateString()}</span>
                            <span className="text-xs text-gray-400">{new Date(signal.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </td>
                </tr>
                  );
                })
            ) : (
                <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        No signals found for this filter.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
