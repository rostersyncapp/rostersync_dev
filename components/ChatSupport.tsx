import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../services/supabase.ts';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    createdAt: Date;
}

const ChatSupport: React.FC = () => {
    const { user } = useUser();
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! I'm your AI Support Agent. I can help you with questions about importing rosters, fixing errors, or using the dashboard. What can I do for you today?",
            createdAt: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: input.trim(),
            createdAt: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        try {
            // Temporary: Simulate AI response until backend is connected
            // await new Promise(resolve => setTimeout(resolve, 1500));
            // const aiMessage: Message = {
            //   id: crypto.randomUUID(),
            //   role: 'assistant',
            //   content: "I'm currently being connected to my brain. Check back soon for real answers!",
            //   createdAt: new Date()
            // };
            // setMessages(prev => [...prev, aiMessage]);

            const { data, error } = await supabase.functions.invoke('gemini-chat', {
                body: {
                    messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
                    userId: user?.id
                }
            });

            if (error) throw error;

            const aiMessage: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data.reply || "I'm having trouble thinking right now. Please try again.",
                createdAt: new Date()
            };
            setMessages(prev => [...prev, aiMessage]);

        } catch (err: any) {
            console.error("Chat error:", err);
            setError("Failed to connect to AI service. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full h-[380px] bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-md">
                    <Bot size={20} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">AI Support Agent</h3>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Online</span>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-dots-pattern" ref={scrollRef}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} className="text-indigo-600 dark:text-indigo-400" />}
                        </div>

                        <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                            <div className={`p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-tr-none'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'
                                }`}>
                                {msg.content}
                            </div>
                            <span className="text-[10px] text-gray-400 font-medium px-1">
                                {msg.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 shrink-0 flex items-center justify-center">
                            <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-tl-none flex items-center gap-2 text-gray-500 text-sm">
                            <Sparkles size={14} className="animate-pulse" /> Thinking...
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mx-auto max-w-sm p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg flex items-center gap-2 justify-center">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question about Rostersync..."
                        className="w-full pl-6 pr-14 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all placeholder:text-gray-400"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:grayscale disabled:pointer-events-none hover:scale-105 active:scale-95"
                    >
                        <Send size={18} />
                    </button>
                </form>
                <div className="text-center mt-3">
                    <p className="text-[10px] text-gray-400 font-medium">
                        AI can make mistakes. Please double check implementation details.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatSupport;
