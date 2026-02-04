import React from 'react';
import SupportCard from './SupportCard';
import ChatSupport from './ChatSupport';
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

            {/* AI Agent Chat */}
            <ChatSupport />
        </div>
    );
};

export default SupportPage;
