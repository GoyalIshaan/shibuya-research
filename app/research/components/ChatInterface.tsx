'use client';

import { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSignalsStore } from '@/lib/store/signals';

function ToolCallBlock({ tool }: { tool: any }) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Normalize Vercel AI SDK tool invocation
    const isLoading = tool.state === 'call';
    const hasResult = tool.state === 'result';
    const result = hasResult ? tool.result : undefined;
    // Handle results being string (internal search) or array (signals)
    const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0);
    
    // Format tool name for display
    const displayName = tool.toolName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    
    return (
        <div className="p-3 text-xs">
            <button
                onClick={() => !isLoading && setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 w-full text-left ${isLoading ? 'cursor-wait' : 'cursor-pointer hover:bg-gray-100 rounded-md -m-1 p-1'}`}
                disabled={isLoading}
            >
                {isLoading ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                ) : (
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                )}
                
                <span className="font-medium text-gray-700">
                    {isLoading ? `Calling ${displayName}...` : `Used ${displayName}`}
                </span>
                
                {tool.args && typeof tool.args === 'object' && 'query' in tool.args && (
                    <span className="text-gray-400 truncate max-w-[200px]">
                        "{String(tool.args.query)}"
                    </span>
                )}
                
                {hasResult && (
                    <span className="ml-auto text-gray-400">
                        {resultCount} result{resultCount !== 1 ? 's' : ''}
                    </span>
                )}
                
                {!isLoading && (
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </button>
            
            {isExpanded && hasResult && (
                <div className="mt-3 pl-6 space-y-2 border-l-2 border-gray-200">
                    {Array.isArray(result) ? (
                        result.map((item: any, i: number) => (
                            <div key={i} className="p-2 bg-white rounded border border-gray-100 text-[11px]">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-gray-600 uppercase">{item.source || 'Signal'}</span>
                                    {item.timestamp && (
                                        <span className="text-gray-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                                    )}
                                </div>
                                <p className="text-gray-700 line-clamp-2">{item.text} {item.summary}</p>
                                {item.url && (
                                    <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline mt-1 inline-block">
                                        View source →
                                    </a>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="p-2 bg-white rounded border border-gray-100 text-[11px] whitespace-pre-wrap">
                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ChatInterface() {
    const [conversations, setConversations] = useState<any[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    
    const [messages, setMessages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const cachedSignals = useSignalsStore(state => state.signals);

    // Initial load of messages from props validation or effect elsewhere
    // But since we removed useChat, we need to handle history loading if not already done.
    // Assuming parent/page handles basic loading or we start fresh.
    
    const sendMessage = async (userMessage: { role: string, content: string }, options?: { body?: any }) => {
        setIsLoading(true);
        setError(undefined);
        
        // Optimistic update
        const newMessages = [
            ...messages, 
            { ...userMessage, id: crypto.randomUUID(), createdAt: new Date() }
        ];
        setMessages(newMessages);

        try {
            const signalSnapshot = cachedSignals.slice(0, 200).map((signal: any) => {
                const timestamp = new Date(signal.timestamp);
                const timestampIso = Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString();
                return {
                    source: signal.source,
                    type: signal.type,
                    authorHandle: signal.authorHandle,
                    timestamp: timestampIso,
                    url: signal.url,
                    text: signal.text,
                    engagement: signal.engagement,
                    metadata: signal.metadata
                };
            });

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    conversationId: options?.body?.conversationId || activeConversationId,
                    signalSnapshot
                })
            });

            if (!response.ok) throw new Error(response.statusText);
            
            const data = await response.json();
            if (data?.error) throw new Error(data.error);
            const assistantMessage = data?.message || {};
            const content = assistantMessage.content || '';
            setMessages(prev => [
                ...prev,
                { 
                    id: crypto.randomUUID(), 
                    role: 'assistant', 
                    content,
                    toolInvocations: assistantMessage.toolInvocations || [],
                    createdAt: new Date() 
                }
            ]);

        } catch (err: any) {
            console.error("Chat Error:", err);
            setError(err);
        } finally {
            setIsLoading(false);
            // Refresh logic if needed
            loadConversations();
        }
    };

    const [input, setInput] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Initial Load
    useEffect(() => {
        loadConversations();
    }, []);

    // Load messages when active conversation changes
    useEffect(() => {
        if (activeConversationId) {
            fetchHistory(activeConversationId);
        } else {
            setMessages([{ 
                id: 'welcome', 
                role: 'assistant', 
                content: 'Select a conversation or start a new one to begin research.' 
            }]);
        }
    }, [activeConversationId]);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const loadConversations = async () => {
        try {
            const res = await fetch('/api/conversations');
            if (res.ok) {
                const data = await res.json();
                setConversations(data);
                if (data.length > 0 && !activeConversationId) {
                    setActiveConversationId(data[0].id);
                } else if (data.length === 0) {
                     handleNewChat();
                }
            }
        } catch (e) {
            console.error("Failed to load conversations:", e);
        }
    };

    const fetchHistory = async (convId: string) => {
         try {
             setMessages([]); 
             const res = await fetch(`/api/chat/history?conversationId=${convId}`);
             if (res.ok) {
                 const data = await res.json();
                 if (data.messages && data.messages.length > 0) {
                     // Normalize stored messages for useChat
                     const history = data.messages.map((m: any) => ({
                         id: m.id,
                         role: m.role,
                         content: m.content,
                         // Note: Tool invocations from history aren't easily restored 
                         // unless we saved them as nice objects. 
                         // For now, we just restore text.
                     }));
                     setMessages(history);
                 } else {
                     setMessages([{ 
                        id: 'welcome', 
                        role: 'assistant', 
                        content: 'This is a new conversation. What would you like to research?' 
                    }]);
                 }
             }
         } catch (e) {
             console.error("Failed to load history:", e);
         }
    };

    const handleNewChat = async () => {
        try {
            const res = await fetch('/api/conversations', { method: 'POST' });
            if (res.ok) {
                const newConv = await res.json();
                setConversations(prev => [newConv, ...prev]);
                setActiveConversationId(newConv.id);
            }
        } catch (e) {
            console.error("Failed to create conversation:", e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !activeConversationId) return;
        
        const content = input;
        setInput('');
        
        try {
            await sendMessage({
                role: 'user',
                content: content
            }, {
                // Force body update per request
                body: { conversationId: activeConversationId }
            } as any);
        } catch (e) {
            console.error("Failed to send message:", e);
            setInput(content); // Restore input on error
        }
    };

    // Extract tool results for "Evidence" panel
    const evidence = messages
        .filter((m: any) => m.role === 'assistant' && (m as any).toolInvocations)
        .flatMap((m: any) => (m as any).toolInvocations?.filter((t: any) => t.state === 'result').map((t: any) => ({
            id: t.toolCallId,
            name: t.toolName,
            result: t.result
        })))
        .filter(Boolean);

    return (
        <div className="flex h-full text-sm">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 border-r flex flex-col">
                <div className="p-4 border-b">
                    <button 
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
                        New Research
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {conversations.map(conv => (
                        <button
                            key={conv.id}
                            onClick={() => setActiveConversationId(conv.id)}
                            className={`w-full text-left px-3 py-3 rounded-lg text-xs transition-colors flex flex-col gap-1 ${
                                activeConversationId === conv.id 
                                    ? 'bg-white shadow-sm border border-gray-200' 
                                    : 'hover:bg-gray-100 text-gray-600'
                            }`}
                        >
                            <span className="font-medium truncate text-gray-900">{conv.title}</span>
                            <span className="text-[10px] text-gray-400">
                                {new Date(conv.updatedAt).toLocaleDateString()}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col border-r bg-white">
                <div className="h-full flex flex-col">
                     <div className="flex-1 p-6 overflow-y-auto space-y-6">
                        {messages.map((m: any) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-xl shadow-sm ${
                                    m.role === 'user' 
                                        ? 'bg-blue-600 text-white rounded-br-none p-4' 
                                        : 'bg-gray-50 text-gray-800 rounded-bl-none border border-gray-100'
                                }`}>
                                    {/* Tool Call Display */}
                                    {m.role === 'assistant' && (m as any).toolInvocations && (m as any).toolInvocations.length > 0 && (
                                        <div className="border-b border-gray-200 mb-3">
                                            {(m as any).toolInvocations.map((tool: any, idx: number) => (
                                                <ToolCallBlock key={idx} tool={tool} />
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Message Content */}
                                    {m.content ? (
                                        <div className={`prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 dark:prose-invert ${m.role === 'assistant' ? 'p-4 pt-0' : ''}`}>
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code: ({inline, ...props}: any) => 
                                                        inline ? 
                                                            <code className="bg-gray-200 px-1 py-0.5 rounded text-xs" {...props} /> :
                                                            <code className="block bg-gray-200 p-2 rounded my-2 text-xs" {...props} />,
                                                }}
                                            >
                                                {m.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        m.role === 'assistant' && (m as any).toolInvocations && (m as any).toolInvocations.some((t: any) => t.state === 'call') && (
                                            <div className="text-xs text-gray-500 italic flex items-center gap-2 p-4">
                                                <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                                                <span>Running tool...</span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && messages[messages.length - 1]?.role === 'user' && (
                            <div className="flex justify-start">
                                 <div className="bg-gray-50 text-gray-500 p-4 rounded-xl rounded-bl-none border border-gray-100 text-xs italic animate-pulse">
                                    Thinking...
                                 </div>
                            </div>
                        )}
                        {error && (
                            <div className="flex justify-center p-4">
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg border border-red-200 text-xs">
                                    ⚠️ Error: {error.message}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <form onSubmit={handleSubmit} className="p-4 border-t bg-white">
                        <div className="relative">
                            <input 
                                className="w-full p-4 pr-12 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm bg-gray-50 focus:bg-white transition-all text-gray-900 placeholder:text-gray-400" 
                                placeholder="Ask about trends (e.g., 'What's blowing up on Reddit?')"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <button type="submit" disabled={isLoading} className="absolute right-3 top-3 p-2 text-blue-600 hover:text-blue-800 disabled:text-gray-300 transition-colors">
                               {isLoading ? (
                                   <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                               ) : (
                                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                               )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Evidence Panel (Right Side) */}
            <div className="w-96 bg-gray-50 p-6 overflow-y-auto border-l hidden md:block">
                <h3 className="font-bold text-gray-700 mb-6 uppercase text-xs tracking-wider flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Evidence & Citations
                </h3>
                
                {evidence.map((ev: any, i: number) => ev && (
                    <div key={i} className="mb-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-xs font-semibold text-gray-400 mb-3 pl-1 uppercase tracking-wide">
                            Used Tool: {ev.name}
                        </div>
                        <div className="space-y-3">
                            {Array.isArray(ev.result) && ev.result.length === 0 && (
                                <div className="text-xs text-gray-400 italic pl-2">No signals found matching criteria.</div>
                            )}
                            {Array.isArray(ev.result) ? ev.result.map((item: any, j: number) => (
                                <a key={j} href={item.url || '#'} target="_blank" rel="noreferrer" className="block p-3 bg-white border border-gray-200 rounded-lg text-sm shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">{item.source || 'EXT'}</span>
                                        {item.timestamp && <span className="text-xs text-gray-400">{new Date(item.timestamp).toISOString().split('T')[0]}</span>}
                                    </div>
                                    <div className="text-gray-700 text-xs leading-relaxed line-clamp-3 group-hover:text-gray-900">
                                        "{item.text || item.summary}"
                                    </div>
                                </a>
                            )) : (
                                <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm shadow-sm text-gray-700 leading-relaxed text-xs">
                                     {typeof ev.result === 'string' ? ev.result.substring(0, 300) + '...' : JSON.stringify(ev.result)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                
                {evidence.length === 0 && (
                    <div className="text-center text-gray-400 mt-20 text-sm">
                        <div className="mb-2 text-2xl opacity-20">🔎</div>
                        Ask a question to trigger<br/>a signal or knowledge search.
                    </div>
                )}
            </div>
        </div>
    );
}
