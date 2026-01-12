'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

type AppData = {
    source: string;
    text: string;
    timestamp: string;
    url: string;
    metadata: {
        rank: number;
        icon?: string;
        price?: string;
        category?: string;
    };
    authorHandle?: string; // Developer
};

export default function TopApps() {
    const [apps, setApps] = useState<AppData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'appstore' | 'playstore'>('appstore');

    useEffect(() => {
        const fetchApps = async () => {
            try {
                const response = await fetch('/api/apps');
                const data = await response.json();
                if (data.success) {
                    setApps(data.apps);
                }
            } catch (error) {
                console.error('Failed to fetch apps:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchApps();
    }, []);

    const filteredApps = apps
        .filter(app => app.source === activeTab)
        .sort((a, b) => (a.metadata?.rank || 999) - (b.metadata?.rank || 999));

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header Tabs */}
            <div className="flex border-b bg-white px-6 pt-4">
                <button
                    onClick={() => setActiveTab('appstore')}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'appstore'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    App Store (Top 200)
                </button>
                <button
                    onClick={() => setActiveTab('playstore')}
                    className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === 'playstore'
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Play Store (Top 200)
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredApps.map((app, index) => (
                            <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-4 hover:shadow-md transition-shadow">
                                <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold text-gray-400">
                                    {app.metadata?.icon ? (
                                        <img src={app.metadata.icon} alt="" className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        <span>#{app.metadata?.rank}</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 truncate">
                                        {app.text.split('\n')[0].replace(/^(App|Play) Store Ranking #\d+: /, '')}
                                    </h3>
                                    <p className="text-sm text-gray-500 truncate">{app.authorHandle}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                                            #{app.metadata?.rank}
                                        </span>
                                        {app.metadata?.price && (
                                            <span className="text-xs text-gray-400">{app.metadata.price}</span>
                                        )}
                                        <a 
                                            href={app.url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="ml-auto text-xs text-blue-600 hover:underline"
                                        >
                                            View Store
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
