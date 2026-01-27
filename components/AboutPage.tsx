import React from 'react';
import { Twitter, Linkedin, X, ChevronLeft } from 'lucide-react';
import { SiteConfig } from '../services/supabase.ts';

interface AboutPageProps {
    onBack: () => void;
    siteConfig: SiteConfig;
    darkMode: boolean;
}

const AboutPage: React.FC<AboutPageProps> = ({ onBack, siteConfig, darkMode }) => {
    return (
        <div className={`min-h-screen flex flex-col ${darkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>

            {/* Minimal Header - No Links, just Logo/Back */}
            <header className="absolute top-0 left-0 w-full p-8 z-50 flex justify-between items-center bg-transparent">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 font-bold text-lg hover:opacity-70 transition-opacity"
                >
                    {siteConfig.logo_url ? (
                        <img src={siteConfig.logo_url} alt="Logo" className="w-8 h-8 rounded-lg" />
                    ) : (
                        <div className="w-8 h-8 rounded-lg bg-[#5B5FFF] flex items-center justify-center text-white font-mono text-xs">RS</div>
                    )}
                    <span className="font-mono tracking-tight">{siteConfig.site_name}</span>
                </button>

                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 font-bold text-sm transition-colors"
                >
                    <ChevronLeft size={16} />
                    <span>Back to Home</span>
                </button>
            </header>

            {/* Main Split Layout */}
            <div className="flex flex-1 flex-col md:flex-row h-full">

                {/* Left: Image / Visual */}
                <div className="w-full md:w-1/2 h-[50vh] md:h-auto relative overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {/* Abstract Gradient Background since we don't have a specific photo yet */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#5B5FFF] to-purple-900 opacity-90" />
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80')] bg-cover bg-center mix-blend-overlay opacity-50"></div>

                    {/* Decorative Elements */}
                    <div className="absolute bottom-12 left-12 right-12 text-white z-10 hidden md:block">
                        <div className="h-1 w-20 bg-white mb-6"></div>
                        <h3 className="text-3xl font-extrabold leading-tight">Empowering broadcast teams with automated precision.</h3>
                    </div>
                </div>

                {/* Right: Content */}
                <div className="w-full md:w-1/2 flex flex-col justify-center p-8 md:p-20 lg:p-32">

                    <div className="space-y-2 mb-8 animate-in slide-in-from-right-4 duration-500 delay-100">
                        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-gray-900 dark:text-white">About Me</h1>
                        <p className="text-[#5B5FFF] font-bold tracking-widest uppercase text-sm">RosterSync • Broadcast Automation</p>
                    </div>

                    <div className="prose dark:prose-invert max-w-lg space-y-6 animate-in slide-in-from-right-4 duration-500 delay-200">
                        <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                            I started RosterSync with a simple mission: to eliminate the chaos of manual data entry in live broadcast environments.
                        </p>
                        <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
                            Every weekend, thousands of production teams scramble to type athlete names, jersey numbers, and stats into their graphics systems. One typo can ruin a graphic. I believed there had to be a better way.
                        </p>
                        <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed">
                            Today, the AI-driven engine processes thousands of messy roster PDFs and websites instantly, converting them into broadcast-ready data for Ross Xpression, Vizrt, and more. RosterSync handles the data, so you can focus on the show.
                        </p>
                    </div>

                    <div className="flex items-center gap-6 mt-12 animate-in slide-in-from-right-4 duration-500 delay-300">
                        <a href="https://twitter.com/rostersync" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#5B5FFF] transition-colors"><Twitter size={24} /></a>
                        <a href="https://linkedin.com/company/rostersync" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-[#5B5FFF] transition-colors"><Linkedin size={24} /></a>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default AboutPage;
