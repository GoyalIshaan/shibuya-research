'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSignalsStore } from '@/lib/store/signals';

type ToolInvocation = {
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
    state: 'call' | 'result';
    result?: unknown;
};

type ChatMessage = {
    id: string;
    role: 'user' | 'assistant';
    content?: string;
    toolInvocations?: ToolInvocation[];
    createdAt?: Date | string;
};

type Conversation = {
    id: string;
    title: string;
    updatedAt: string;
};

type ClientSignal = {
    source: string;
    type: string;
    authorHandle?: string;
    timestamp: string | Date;
    url?: string;
    text: string;
    engagement?: Record<string, number | undefined>;
    metadata?: Record<string, unknown>;
};

type ToolResultItem = {
    text?: string;
    summary?: string;
    source?: string;
    url?: string;
    timestamp?: string;
};

type EvidenceItem = {
    id: string;
    name: string;
    result: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

function ToolCallBlock({ tool }: { tool: ToolInvocation }) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Normalize Vercel AI SDK tool invocation
    const isLoading = tool.state === 'call';
    const hasResult = tool.state === 'result';
    const result = hasResult ? tool.result : undefined;
    // Handle results being string (internal search) or array (signals)
    const resultCount = Array.isArray(result) ? result.length : (result ? 1 : 0);
    
    // Format tool name for display
    const displayName = tool.toolName.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    const queryValue = tool.args && isRecord(tool.args) ? tool.args.query : undefined;
    const queryLabel = typeof queryValue === 'string' ? queryValue : undefined;
    
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
                
                {queryLabel && (
                    <span className="text-gray-400 truncate max-w-[200px]">
                        &quot;{queryLabel}&quot;
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
                        result.map((item, i) => {
                            if (!isRecord(item)) return null;
                            const typed = item as ToolResultItem;
                            return (
                                <div key={i} className="p-2 bg-white rounded border border-gray-100 text-[11px]">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-600 uppercase">{typed.source || 'Signal'}</span>
                                        {typed.timestamp && (
                                            <span className="text-gray-400">{new Date(typed.timestamp).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                    <p className="text-gray-700 line-clamp-2">
                                        {typed.text} {typed.summary}
                                    </p>
                                    {typed.url && (
                                        <a href={typed.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline mt-1 inline-block">
                                            View source →
                                        </a>
                                    )}
                                </div>
                            );
                        })
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
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [error, setError] = useState<Error | undefined>(undefined);
    const cachedSignals = useSignalsStore(state => state.signals) as ClientSignal[];

    // Initial load of messages from props validation or effect elsewhere
    // But since we removed useChat, we need to handle history loading if not already done.
    // Assuming parent/page handles basic loading or we start fresh.
    
    const sendMessage = async (
        userMessage: { role: 'user'; content: string },
        options?: { body?: { conversationId?: string } }
    ) => {
        setIsLoading(true);
        setError(undefined);
        
        // Optimistic update
        const newMessages: ChatMessage[] = [
            ...messages,
            { ...userMessage, id: crypto.randomUUID(), createdAt: new Date() }
        ];
        setMessages(newMessages);

        try {
            const signalSnapshot = cachedSignals.slice(0, 200).map((signal) => {
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
            const content = typeof assistantMessage.content === 'string' ? assistantMessage.content : '';
            const toolInvocations = Array.isArray(assistantMessage.toolInvocations)
                ? (assistantMessage.toolInvocations as ToolInvocation[])
                : [];
            setMessages(prev => [
                ...prev,
                { 
                    id: crypto.randomUUID(), 
                    role: 'assistant', 
                    content,
                    toolInvocations: toolInvocations,
                    createdAt: new Date() 
                }
            ]);

        } catch (err: unknown) {
            console.error("Chat Error:", err);
            const errorInstance = err instanceof Error ? err : new Error(String(err));
            setError(errorInstance);
        } finally {
            setIsLoading(false);
            // Refresh logic if needed
            loadConversations();
        }
    };

    const [input, setInput] = useState('');
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleNewChat = useCallback(async () => {
        try {
            const res = await fetch('/api/conversations', { method: 'POST' });
            if (res.ok) {
                const newConv = (await res.json()) as Conversation;
                setConversations(prev => [newConv, ...prev]);
                setActiveConversationId(newConv.id);
            }
        } catch (e) {
            console.error("Failed to create conversation:", e);
        }
    }, []);

    const loadConversations = useCallback(async () => {
        setIsLoadingConversations(true);
        try {
            const res = await fetch('/api/conversations');
            if (res.ok) {
                const data = (await res.json()) as Conversation[];
                setConversations(data);
                if (data.length > 0 && !activeConversationId) {
                    setActiveConversationId(data[0].id);
                } else if (data.length === 0) {
                     handleNewChat();
                }
            }
        } catch (e) {
            console.error("Failed to load conversations:", e);
        } finally {
            setIsLoadingConversations(false);
        }
    }, [activeConversationId, handleNewChat]);

    const isSubmittingRename = useRef(false);

    const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
        if (!newTitle.trim() || isSubmittingRename.current) {
            setEditingConversationId(null);
            setEditingTitle('');
            return;
        }
        isSubmittingRename.current = true;
        try {
            const res = await fetch('/api/conversations', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, title: newTitle.trim() })
            });
            if (res.ok) {
                const updated = (await res.json()) as Conversation;
                setConversations(prev => 
                    prev.map(c => c.id === id ? updated : c)
                );
            } else {
                const data = await res.json().catch(() => ({}));
                console.error("Rename failed:", data.error || res.statusText);
            }
        } catch (e) {
            console.error("Failed to rename conversation:", e);
        } finally {
            setEditingConversationId(null);
            setEditingTitle('');
            isSubmittingRename.current = false;
        }
    }, []);

    const handleDeleteConversation = useCallback(async (id: string) => {
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        try {
            const res = await fetch(`/api/conversations?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setConversations(prev => prev.filter(c => c.id !== id));
                if (activeConversationId === id) {
                    const remaining = conversations.filter(c => c.id !== id);
                    setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
                }
            }
        } catch (e) {
            console.error("Failed to delete conversation:", e);
        } finally {
            setMenuOpenId(null);
        }
    }, [activeConversationId, conversations]);

    // Initial Load
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setMenuOpenId(null);
        if (menuOpenId) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [menuOpenId]);

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

    const fetchHistory = async (convId: string) => {
         setIsLoadingMessages(true);
         try {
             setMessages([]); 
             const res = await fetch(`/api/chat/history?conversationId=${convId}`);
             if (res.ok) {
                 const data = (await res.json()) as { messages?: Array<{ id: string; role: 'user' | 'assistant'; content: string }> };
                 if (data.messages && data.messages.length > 0) {
                     const history = data.messages.map((m) => ({
                         id: m.id,
                         role: m.role,
                         content: m.content,
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
         } finally {
             setIsLoadingMessages(false);
         }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !activeConversationId) return;
        
        const content = input;
        setInput('');
        
        try {
            await sendMessage(
                {
                    role: 'user',
                    content: content
                },
                {
                    // Force body update per request
                    body: { conversationId: activeConversationId }
                }
            );
        } catch (e) {
            console.error("Failed to send message:", e);
            setInput(content); // Restore input on error
        }
    };

    // Extract tool results for "Evidence" panel
    const evidence: EvidenceItem[] = messages
        .filter((m) => m.role === 'assistant' && m.toolInvocations && m.toolInvocations.length > 0)
        .flatMap((m) =>
            (m.toolInvocations || [])
                .filter((t) => t.state === 'result')
                .map((t) => ({
                    id: t.toolCallId,
                    name: t.toolName,
                    result: t.result
                }))
        )
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
                    {isLoadingConversations ? (
                        // Skeleton loaders for conversations
                        <>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="px-3 py-3 rounded-lg animate-pulse">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-100 rounded w-1/3"></div>
                                </div>
                            ))}
                        </>
                    ) : conversations.length === 0 ? (
                        <div className="text-center text-gray-400 py-8 text-xs">
                            No conversations yet.<br/>Click &quot;New Research&quot; to start.
                        </div>
                    ) : (
                        <>
                            {conversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className={`relative group w-full text-left px-3 py-3 rounded-lg text-xs transition-colors ${
                                        activeConversationId === conv.id 
                                            ? 'bg-white shadow-sm border border-gray-200' 
                                            : 'hover:bg-gray-100 text-gray-600'
                                    }`}
                                >
                                    {editingConversationId === conv.id ? (
                                        // Inline rename input
                                        <form 
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                handleRenameConversation(conv.id, editingTitle);
                                            }}
                                            className="flex flex-col gap-1"
                                        >
                                            <input
                                                type="text"
                                                value={editingTitle}
                                                onChange={(e) => setEditingTitle(e.target.value)}
                                                onBlur={() => handleRenameConversation(conv.id, editingTitle)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Escape') {
                                                        setEditingConversationId(null);
                                                        setEditingTitle('');
                                                    }
                                                }}
                                                className="w-full px-2 py-1 text-xs border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                                                autoFocus
                                            />
                                            <span className="text-[10px] text-gray-400">
                                                Press Enter to save, Esc to cancel
                                            </span>
                                        </form>
                                    ) : (
                                        // Normal conversation display
                                        <>
                                            <button
                                                onClick={() => setActiveConversationId(conv.id)}
                                                className="w-full text-left flex flex-col gap-1"
                                            >
                                                <span className="font-medium truncate text-gray-900 pr-6">{conv.title}</span>
                                                <span className="text-[10px] text-gray-400">
                                                    {new Date(conv.updatedAt).toLocaleDateString()}
                                                </span>
                                            </button>
                                            
                                            {/* Actions menu button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMenuOpenId(menuOpenId === conv.id ? null : conv.id);
                                                }}
                                                className="absolute right-2 top-2 p-1 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="More options"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="1"></circle>
                                                    <circle cx="12" cy="5" r="1"></circle>
                                                    <circle cx="12" cy="19" r="1"></circle>
                                                </svg>
                                            </button>

                                            {/* Dropdown menu */}
                                            {menuOpenId === conv.id && (
                                                <div className="absolute right-0 top-8 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingConversationId(conv.id);
                                                            setEditingTitle(conv.title);
                                                            setMenuOpenId(null);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2 text-gray-700"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                                        </svg>
                                                        Rename
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteConversation(conv.id);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 flex items-center gap-2 text-red-600"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        </svg>
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col border-r bg-white">
                <div className="h-full flex flex-col">
                     <div className="flex-1 p-6 overflow-y-auto space-y-6">
                        {isLoadingMessages ? (
                            // Skeleton loaders for messages
                            <>
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] rounded-xl rounded-bl-none bg-gray-50 border border-gray-100 p-4 animate-pulse">
                                        <div className="h-4 bg-gray-200 rounded w-64 mb-2"></div>
                                        <div className="h-4 bg-gray-200 rounded w-48 mb-2"></div>
                                        <div className="h-4 bg-gray-100 rounded w-32"></div>
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <div className="max-w-[60%] rounded-xl rounded-br-none bg-blue-100 p-4 animate-pulse">
                                        <div className="h-4 bg-blue-200 rounded w-40"></div>
                                    </div>
                                </div>
                                <div className="flex justify-start">
                                    <div className="max-w-[85%] rounded-xl rounded-bl-none bg-gray-50 border border-gray-100 p-4 animate-pulse">
                                        <div className="h-4 bg-gray-200 rounded w-56 mb-2"></div>
                                        <div className="h-4 bg-gray-200 rounded w-72 mb-2"></div>
                                        <div className="h-4 bg-gray-100 rounded w-44"></div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {messages.map((m) => (
                                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-xl shadow-sm ${
                                            m.role === 'user' 
                                                ? 'bg-blue-600 text-white rounded-br-none p-4' 
                                                : 'bg-gray-50 text-gray-800 rounded-bl-none border border-gray-100'
                                        }`}>
                                            {/* Tool Call Display */}
                                            {m.role === 'assistant' && m.toolInvocations && m.toolInvocations.length > 0 && (
                                                <div className="border-b border-gray-200 mb-3">
                                                    {m.toolInvocations.map((tool, idx) => (
                                                        <ToolCallBlock key={tool.toolCallId || `${m.id}-${idx}`} tool={tool} />
                                                    ))}
                                                </div>
                                            )}
                                            
                                            {/* Message Content */}
                                            {m.content ? (
                                                <div className={`prose prose-sm max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-1 dark:prose-invert ${m.role === 'assistant' ? 'p-4 pt-0' : ''}`}>
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            code: ({inline, ...props}: ComponentProps<'code'> & { inline?: boolean }) => 
                                                                inline ? 
                                                                    <code className="bg-gray-200 px-1 py-0.5 rounded text-xs" {...props} /> :
                                                                    <code className="block bg-gray-200 p-2 rounded my-2 text-xs" {...props} />,
                                                        }}
                                                    >
                                                        {m.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                m.role === 'assistant' && m.toolInvocations && m.toolInvocations.some((t) => t.state === 'call') && (
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
                            </>
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
                
                {evidence.map((ev, i) => ev && (
                    <div key={i} className="mb-8 animate-in fade-in slide-in-from-right-4 duration-500">
                        <div className="text-xs font-semibold text-gray-400 mb-3 pl-1 uppercase tracking-wide">
                            Used Tool: {ev.name}
                        </div>
                        <div className="space-y-3">
                            {Array.isArray(ev.result) && ev.result.length === 0 && (
                                <div className="text-xs text-gray-400 italic pl-2">No signals found matching criteria.</div>
                            )}
                            {Array.isArray(ev.result) ? ev.result.map((item, j) => {
                                if (!isRecord(item)) return null;
                                const typed = item as ToolResultItem;
                                const href = typed.url || '#';
                                return (
                                    <a key={j} href={href} target="_blank" rel="noreferrer" className="block p-3 bg-white border border-gray-200 rounded-lg text-sm shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded uppercase">{typed.source || 'EXT'}</span>
                                            {typed.timestamp && <span className="text-xs text-gray-400">{new Date(typed.timestamp).toISOString().split('T')[0]}</span>}
                                        </div>
                                        <div className="text-gray-700 text-xs leading-relaxed line-clamp-3 group-hover:text-gray-900">
                                            &quot;{typed.text || typed.summary}&quot;
                                        </div>
                                    </a>
                                );
                            }) : (
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
