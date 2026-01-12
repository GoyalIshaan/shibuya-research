'use client';

import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import TopApps from './components/TopApps';

export default function ResearchPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'apps'>('chat');

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="px-6 py-4 border-b bg-white shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-8">
            <div>
                <h1 className="text-xl font-bold text-gray-900">Research Cockpit</h1>
                <p className="text-xs text-gray-500">Internal Knowledge + External Signals</p>
            </div>
            
            {/* Main Navigation Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg">
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                        activeTab === 'chat' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Chat & Analysis
                </button>
                <button 
                    onClick={() => setActiveTab('apps')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                        activeTab === 'apps' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Top 250 Apps
                </button>
            </div>
        </div>
        <div className="flex gap-2 text-sm">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Internal Docs: Connected</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">Web Search: Idle</span>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <ChatInterface />
        ) : (
          <TopApps />
        )}
      </div>
    </div>
  );
}
