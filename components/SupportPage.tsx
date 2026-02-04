import React from 'react';
import SupportCard from './SupportCard';
import { MessageSquare, Bot } from 'lucide-react';

interface SupportPageProps {
    darkMode?: boolean;
}

const SupportPage: React.FC<SupportPageProps> = ({ darkMode }) => {
    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-2">Support Center</h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">Get help with your roster workflows and technical questions.</p>
            </div>

            {/* Main Support Card */}
            <SupportCard darkMode={darkMode} />

            {/* AI Agent Placeholder */}
            <div className="w-full max-w-4xl mx-auto mt-8 relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl opacity-10 blur-xl group-hover:opacity-20 transition-opacity"></div>
                <div className="relative bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 flex items-center gap-8 overflow-hidden">

                    {/* Background Pattern */}
                    <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-gray-50 dark:from-gray-800/50 to-transparent skew-x-12 opacity-50"></div>

                    <div className="hidden md:flex w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl items-center justify-center shadow-inner shrink-0">
                        <Bot size={40} className="text-indigo-600 dark:text-indigo-400" />
                    </div>

                    <div className="flex-1 relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-lg">Coming Soon</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Support Agent</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-lg">
                            Instant answers for your roster questions. Our new AI agent will be able to help you troubleshoot imports, explain errors, and guide you through complex workflows in real-time.
                        </p>
                    </div>

                    <div className="hidden md:block opacity-30 grayscale saturate-0">
                        <MessageSquare size={64} className="text-gray-300 dark:text-gray-700" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupportPage;
