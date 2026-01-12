import Link from 'next/link';
import { MONITORING_CONFIG } from '@/lib/config';
import KnowledgePanel from './components/KnowledgePanel';

export default function Home() {
  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto bg-dot-pattern">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
           <h1 className="text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
             Shibuya Consumer Research
           </h1>
           <p className="text-gray-500 mt-2 text-xl font-light">Interactive consumer research + signal intelligence cockpit</p>
        </div>
        <div className="flex gap-3">
             <Link href="/signals" className="px-5 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
                Launch Cockpit
             </Link>
        </div>
      </div>
      
      {/* Hero / Main Actions */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
        
        {/* Featured: Research Chat - Spans 2 columns on medium screens */}
        <Link href="/research" className="md:col-span-8 group relative p-8 border rounded-3xl hover:shadow-2xl transition-all bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden hover:-translate-y-1">
            <div className="absolute top-0 right-0 p-32 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:opacity-10 transition-opacity"></div>
            
            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold mb-6">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                        </span>
                        AI ANALYST ACTIVE
                    </div>
                    <h2 className="text-4xl font-bold mb-4">Talk to your Data</h2>
                    <p className="text-blue-100 text-lg max-w-xl leading-relaxed">
                        Ask our AI agent to uncover viral trends, analyze sentiment, and find the next big app blowing up on Reddit and the App Store.
                    </p>
                </div>
                
                <div className="mt-8 flex items-center gap-3 font-semibold">
                    <span>Start Research Session</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </div>
            </div>
        </Link>

        {/* Signals Feed */}
        <Link href="/signals" className="md:col-span-4 group p-8 border rounded-3xl hover:shadow-xl transition-all bg-white hover:-translate-y-1 flex flex-col justify-between">
            <div>
                <div className="h-12 w-12 bg-orange-100 rounded-2xl flex items-center justify-center mb-6 text-orange-600 group-hover:scale-110 transition-transform">
                    📡
                </div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Live Signals</h3>
                <p className="text-gray-500 leading-relaxed">
                    Raw stream from Reddit, Product Hunt, and App Stores.
                </p>
            </div>
             <div className="mt-8 pt-6 border-t border-dashed flex justify-between items-center text-sm text-gray-500">
                <span>2.4k signals today</span>
                <span className="h-2 w-2 rounded-full bg-green-500"></span>
            </div>
        </Link>
      </div>

      {/* Secondary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Monitoring Config */}
        <section className="col-span-1 lg:col-span-2 p-8 border rounded-3xl bg-white/80 backdrop-blur-sm">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-3 text-gray-900">
            <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            Active Monitoring Scope
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Reddit Communities</h3>
                <div className="flex flex-wrap gap-2">
                    {MONITORING_CONFIG.reddit.subreddits.slice(0, 6).map(sub => (
                        <a key={sub} href={`https://reddit.com/r/${sub}`} target="_blank" className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:border-orange-500 hover:text-orange-600 transition-colors">
                            r/{sub}
                        </a>
                    ))}
                    {MONITORING_CONFIG.reddit.subreddits.length > 6 && (
                        <span className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-400">
                            +{MONITORING_CONFIG.reddit.subreddits.length - 6} more
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">App Ecosystem</h3>
                 <ul className="text-sm text-gray-600 space-y-3">
                    <li className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-900 font-bold"></span> 
                        <span>App Store Top Free</span>
                    </li>
                    <li className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-green-600 font-bold">▶</span> 
                        <span>Play Store Charts</span>
                    </li>
                </ul>
            </div>

            <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Launch & VC</h3>
                 <ul className="text-sm text-gray-600 space-y-3">
                    <li className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-orange-500 font-bold">P</span> 
                        <span>Product Hunt</span>
                    </li>
                    <li className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-orange-600 font-bold">Y</span> 
                        <span>Hacker News</span>
                    </li>
                    <li className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <span className="text-gray-900 font-bold">V</span> 
                        <span>VC Blogs (YC, a16z...)</span>
                    </li>
                </ul>
            </div>
          </div>
        </section>
        
        {/* System Status / Trends Link */}
        <div className="flex flex-col gap-6">
            <Link href="/trends" className="flex-1 p-8 border rounded-3xl bg-gray-900 text-white hover:bg-gray-800 transition-all hover:shadow-xl hover:-translate-y-1 group">
                <div className="flex justify-between items-start mb-4">
                    <div className="h-10 w-10 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400">
                        📈
                    </div>
                    <span className="text-xs font-mono text-gray-400">BETA</span>
                </div>
                <h3 className="text-xl font-bold mb-2 group-hover:text-purple-300 transition-colors">Trend Clusters</h3>
                <p className="text-gray-400 text-sm">View automated thematic clustering of signals.</p>
            </Link>

            <section className="p-6 border rounded-3xl bg-white">
                <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">System Health</h2>
                <ul className="space-y-3">
                    <li className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Ingestion Pipeline</span>
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium border border-green-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Healthy
                        </span>
                    </li>
                    <li className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Vector DB</span>
                        <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs font-medium border border-green-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Connected
                        </span>
                    </li>
                </ul>
                <div className="mt-6 pt-4 border-t">
                    <Link href="/api/trends/sync" className="w-full text-center block text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors">
                        Trigger Manual Sync via API
                    </Link>
                </div>
            </section>
        </div>

      </div>

      {/* Knowledge Base */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Internal Knowledge</h2>
        <p className="text-gray-600 mb-6">Upload your internal documents to power AI research with your organization's context</p>
        <KnowledgePanel />
      </div>
    </main>
  );
}
