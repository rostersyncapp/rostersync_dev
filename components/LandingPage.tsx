import React, { useState, useEffect } from 'react';
import { SiteConfig } from '../services/supabase.ts';
import { PRICING_TIERS } from '../constants.tsx';
import {
  CheckCircle2,
  Plus,
  Minus,
  X,
  Send,
  Loader2,
  Sun,
  Moon,
  Wand2,
  ShieldCheck,
  Palette,
  Globe,
  Layers,
  Calendar,
  Zap,
  Twitter,
  Linkedin,
  Sparkles,
  Terminal as TerminalIcon,
  Check
} from 'lucide-react';
import { useClerk, SignUpButton } from '@clerk/clerk-react';
import { WavyBackground } from './ui/wavy-background';
import TerminalWorkflow from './TerminalWorkflow';
import { Logos3 } from './blocks/logos3';

// --- Utility for Tailwind classes ---
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

// --- Landing Page Content ---

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  siteConfig: SiteConfig;
}

const FAQS = [
  { q: "Why upgrade from Free to Starter?", a: "Upgrade to Starter when you need more than the trial limit, want simple phonetic guides, or require historical data (1-year archive) for your creation workflow." },
  { q: "What does the Pro tier offer for MAM workflows?", a: "The Pro tier ($149) is designed for professional broadcasters and media managers. It includes direct sync with Iconik and CatDV, 5-year historical archives, and support for all broadcast delivery formats." },
  { q: "When should I choose the Enterprise tier?", a: "Choose Enterprise for national broadcasts or large organizations. It adds support for IPA-grade phonetics, Spanish/Chinese localized exports, a full 25-year historical archive, and custom export formats." },
  { q: "Can I manage multiple projects?", a: "Yes. Starter includes up to 5 projects, while Pro and Enterprise offer unlimited project folders to help you organize rosters across different leagues and clients." },
  { q: "What hardware systems do you support?", a: "We support nearly every major broadcast system. Pro and Enterprise tiers provide data for Ross Xpression, Vizrt, Chyron Prime, and specialized formats like Ross DataLinq XML." }
];

const FEATURES = [
  { icon: <Wand2 size={20} />, title: "AI Normalization", desc: "Instantly parses messy text from PDF scrapes, websites, and emails with high accuracy." },
  { icon: <ShieldCheck size={20} />, title: "Broadcast Safe", desc: "Automatically strips accents and sanitizes special characters for character generator compatibility." },
  { icon: <Palette size={20} />, title: "Smart Branding", desc: "Discovers official team hex codes, logos, and conference metadata automatically." },
  { icon: <Globe size={20} />, title: "Multi-Language", desc: "Generate phonetics and localized rosters in English, Spanish, and Mandarin (Network Tier)." },
  { icon: <Layers size={20} />, title: "Asset Management", desc: "Integrates with Iconik, CatDV, and other MAM systems via live sync (Pro Tier and above)." },
  { icon: <Zap size={20} />, title: "Real-time Sync", desc: "Push updates directly to your production folders or cloud buckets in seconds." }
];

const PRICING_MATRIX = [
  { feature: "Monthly Price", free: "$0", starter: "$49", pro: "$149", enterprise: "$199" },
  { feature: "AI Credits", free: "50 (Trial)", starter: "150", pro: "500", enterprise: "1000" },
  { feature: "Rosters/month", free: "~5", starter: "~15", pro: "~50", enterprise: "~100" },
  { feature: "Export formats", free: "CSV (Flat)", starter: "CSV, JSON", pro: "All Broadcast Formats", enterprise: "Custom Formats" },
  { feature: "Team members", free: "1", starter: "1", pro: "3", enterprise: "10+" },
  { feature: "Phonetic guides", free: false, starter: "✅ Simple", pro: "✅ Simple", enterprise: "✅ Simple + IPA" },
  { feature: "Multi-language", free: false, starter: false, pro: false, enterprise: "✅ ES + ZH" },
  { feature: "Historical Data", free: "Current only", starter: "1 Year", pro: "5 Years", enterprise: "25+ Years" },
  { feature: "Colors", free: false, starter: "HEX", pro: "RGB/CMYK", enterprise: "All Formats" },
  { feature: "MAM live sync", free: false, starter: false, pro: true, enterprise: true },
  { feature: "Support", free: "Community", starter: "Email", pro: "Email", enterprise: "Email + Quarterly" },
];


const MatrixCell: React.FC<{ value: any }> = ({ value }) => {
  if (value === true) return <div className="flex justify-center"><Check size={16} className="text-emerald-500 font-bold" strokeWidth={3} /></div>;
  if (value === false) return null;
  return <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{value}</span>;
};

const BrandLogo: React.FC<{ siteConfig: SiteConfig; size?: 'sm' | 'md' }> = ({ siteConfig, size = 'md' }) => {
  const containerClasses = size === 'md' ? "w-8 h-8 rounded-lg shrink-0" : "w-7 h-7 rounded-lg shrink-0";
  if (!siteConfig.logo_url) return null;
  return (
    <div className={`${containerClasses} flex items-center justify-center overflow-hidden`}>
      <img src={siteConfig.logo_url} alt="Site Logo" className="w-full h-full object-cover" />
    </div>
  );
};

import AboutPage from './AboutPage.tsx';
import RosterDirectory from './RosterDirectory.tsx';

const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp, darkMode, toggleDarkMode, siteConfig }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: '', email: '', organization: '', useCase: '' });
  const [demoStatus, setDemoStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [currentPage, setCurrentPage] = useState<'home' | 'about' | 'directory'>('home');

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoStatus('sending');
    try {
      const functionUrl = import.meta.env.VITE_RESEND_EMAIL_FUNCTION_URL;
      if (!functionUrl) throw new Error("Email service configuration missing.");
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          table: 'demo',
          record: {
            id: 'new',
            name: demoForm.name,
            email: demoForm.email,
            user_email: demoForm.email,
            organization: demoForm.organization,
            use_case: demoForm.useCase || "Demo Request",
            message: `Organization: ${demoForm.organization || 'N/A'}\nUse Case: ${demoForm.useCase || 'General Inqiury'}`
          }
        })
      });

      if (!response.ok) throw new Error("Failed to send request");
      setDemoStatus('success');
      setTimeout(() => {
        setShowDemoModal(false);
        setDemoStatus('idle');
        setDemoForm({ name: '', email: '', organization: '', useCase: '' });
      }, 2000);
    } catch (err: any) {
      console.error("Demo request failed:", err);
      setDemoStatus('error');
    }
  };

  const CLERK_DOMAIN = 'https://winning-doe-44.accounts.dev';
  const clerk = useClerk();
  const [signInUrl, setSignInUrl] = useState(`${CLERK_DOMAIN}/sign-in?redirect_url=${encodeURIComponent(window.location.origin)}/`);
  const [signUpUrl, setSignUpUrl] = useState(`${CLERK_DOMAIN}/sign-up?redirect_url=${encodeURIComponent(window.location.origin)}/`);

  useEffect(() => {
    if (clerk?.loaded) {
      setSignInUrl(clerk.buildSignInUrl());
      setSignUpUrl(clerk.buildSignUpUrl());
    }
  }, [clerk?.loaded]);

  if (currentPage === 'about') {
    return <AboutPage onBack={() => setCurrentPage('home')} siteConfig={siteConfig} darkMode={darkMode} />;
  }

  if (currentPage === 'directory') {
    return (
      <div className={`min-h-screen ${darkMode ? 'dark' : ''} bg-[#FAFAFA] dark:bg-[#111827]`}>
        <nav className="fixed top-0 w-full px-4 md:px-8 py-6 z-50 bg-white/50 dark:bg-[#111827]/50 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button onClick={() => setCurrentPage('home')} className="flex items-center gap-2 relative z-50 transition-transform hover:scale-105 active:scale-95">
              <BrandLogo siteConfig={siteConfig} size="md" />
              <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white underline decoration-[#5B5FFF]/30 decoration-2 underline-offset-4">{siteConfig?.site_name || 'rosterSync'}</span>
            </button>
            <div className="flex items-center gap-3 relative z-50">
              <button onClick={toggleDarkMode} className="p-2 text-gray-400 hover:text-[#5B5FFF] transition-colors rounded-full">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <a href={signInUrl} className="px-4 py-2 rounded-lg bg-[#5B5FFF] text-white font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all">Sign In</a>
            </div>
          </div>
        </nav>
        <div className="pt-24">
          <RosterDirectory />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans selection:bg-[#5B5FFF]/30 ${darkMode ? 'dark' : ''} bg-[#FAFAFA] dark:bg-[#111827] text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
      <div className="absolute top-0 left-0 w-full h-[800px] z-0 pointer-events-none overflow-hidden">
        <WavyBackground
          className="w-full h-full pb-0"
          backgroundFill={darkMode ? "#111827" : "#FAFAFA"}
          waveOpacity={darkMode ? 0.5 : 0.3}
          containerClassName="h-full"
          speed="slow"
          waveWidth={50}
          colors={['#5B5FFF', '#5BC5FF', '#8B5CF6']}
        />
      </div>

      <nav className="fixed top-0 w-full px-4 md:px-8 py-6 z-50 transition-all duration-300 bg-white/50 dark:bg-[#111827]/50 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 relative z-50">
            <BrandLogo siteConfig={siteConfig} size="md" />
            <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white">{siteConfig?.site_name || 'rosterSync'}</span>
          </div>
          <div className="flex items-center gap-3 relative z-50">
            <button onClick={toggleDarkMode} className="p-2 text-gray-400 hover:text-[#5B5FFF] transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <a href={signInUrl} className="hidden md:block text-xs font-bold text-gray-500 hover:text-[#5B5FFF] transition-colors cursor-pointer relative z-50">Sign In</a>
            <button onClick={() => setShowDemoModal(true)} className="hidden md:block relative z-50 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 text-gray-600 dark:text-gray-300 font-bold text-xs shadow-sm hover:scale-105 active:scale-95 transition-all">
              Book Demo
            </button>
            <a href={signUpUrl} className="relative z-50 px-4 py-2 rounded-lg bg-[#5B5FFF] text-white font-bold text-xs shadow-md shadow-[#5B5FFF]/20 hover:scale-105 active:scale-95 transition-all cursor-pointer">Get Started</a>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-64 md:pb-80 px-4 overflow-hidden z-10">
        <div className="max-w-7xl mx-auto text-center relative z-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5B5FFF]/5 border border-[#5B5FFF]/10 text-[#5B5FFF] text-[10px] font-black uppercase tracking-widest mb-6">
            <Sparkles size={12} /> New: Gemini 2.0 Integration
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter leading-[1.2] text-gray-900 dark:text-white mb-8">
            Every Roster. Every Season. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-600 text-transparent bg-clip-text inline-block py-1">Back to 2000.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed mb-12">
            AI-powered roster processing from current seasons to historical archives. Export to all broadcast formats with direct MAM/DAM integration.
          </p>
          <div className="mt-8 -mb-12">
            <Logos3 onSeeList={() => setCurrentPage('directory')} />
          </div>
        </div>
      </section>

      <section className="relative z-20 pt-32 pb-24 px-6 bg-[#FAFAFA] dark:bg-gray-900">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          <div className="text-left">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-3">How It Works</h2>
            <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-cyan-400 text-transparent bg-clip-text inline-block py-1">Paste. Parse. Export.</span>
            </h3>
            <p className="text-base text-gray-600 dark:text-gray-300 font-medium leading-relaxed max-w-md mb-8">
              Watch rosterSync transform messy roster data into broadcast-ready metadata in seconds.
            </p>
            <ol className="space-y-4 max-w-md">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Paste</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Copy raw roster data from any PDF, website, or spreadsheet.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Parse</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Our engine instantly identifies athletes, position, jersey number, and teams.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Export</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Download cleaned JSON, CSV, or XML ready for broadcast, MAM and DAM.</p>
                </div>
              </li>
            </ol>
          </div>
          <div><TerminalWorkflow loop onExportComplete={(format) => console.log('Exported:', format)} /></div>
        </div>
      </section>

      <section className="relative z-20 pt-32 pb-24 px-6 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-gray-900">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-start">
          <div className="order-last lg:order-first relative">
            <div className="aspect-video rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl flex items-center justify-center overflow-hidden group">
              <div className="absolute inset-0 bg-[#5B5FFF]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex flex-col items-center gap-4 text-center p-8">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-gray-800 shadow-xl flex items-center justify-center text-[#5B5FFF]">
                  <Calendar size={32} />
                </div>
                <div>
                  <h4 className="font-black text-gray-900 dark:text-white uppercase tracking-widest text-xs mb-1">Data Explorer</h4>
                  <p className="text-xs text-gray-400 font-medium">Browse 25 years of sports history</p>
                </div>
              </div>
            </div>
            {/* Decorative dots or elements */}
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-[#5B5FFF]/10 rounded-full blur-xl" />
            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl" />
          </div>
          <div className="text-left">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-3">Historical Archive</h2>
            <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 text-transparent bg-clip-text inline-block py-1">Search. Save. Sync.</span>
            </h3>
            <p className="text-base text-gray-600 dark:text-gray-300 font-medium leading-relaxed max-w-md mb-8">
              Access 25 years of team history with our deep-data archive. Verified, corrected, and ready for production.
            </p>
            <ol className="space-y-4 max-w-md">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center font-bold text-sm">1</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Find</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Browse the Roster Directory to find historical teams from 2000 to present.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center font-bold text-sm">2</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Save</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Add historical rosters directly to your shared project library with one click.</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center font-bold text-sm">3</span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Export</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Instantly sync archived data to your broadcast graphics or MAM system.</p>
                </div>
              </li>
            </ol>
            <button
              onClick={() => setCurrentPage('directory')}
              className="mt-8 px-6 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:scale-105 transition-all shadow-lg active:scale-95 flex items-center gap-2 group"
            >
              Open Directory
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-[#FAFAFA] dark:bg-gray-900">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-24 items-start">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 order-last lg:order-first">
            {FEATURES.map((f, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center mb-4 group-hover:bg-[#5B5FFF] group-hover:text-white transition-all">{f.icon}</div>
                <h4 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{f.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="lg:col-span-1 text-left order-first lg:order-last">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-3">AI Scout</h2>
            <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 text-transparent bg-clip-text inline-block py-1">Built for <br /> High-Stakes Broadcast</span>
            </h3>
            <p className="text-base text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
              Reliability is our core feature. From local production to national networks, RosterSync delivers data you can trust when the red light is on.
            </p>
          </div>
        </div>
      </section>


      <section className="py-16 px-6 relative overflow-hidden bg-white dark:bg-gray-900">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5B5FFF]/5 rounded-full blur-[100px] -z-10"></div>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-2">Pricing</h2>
            <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 text-transparent bg-clip-text inline-block py-1">Scalable Workflows</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.id} className={`p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 transition-all relative flex flex-col ${tier.id === 'PRO' ? 'border-[#5B5FFF] shadow-xl lg:scale-105 z-10' : 'border-gray-100 dark:border-gray-700'}`}>
                {tier.id === 'PRO' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full primary-gradient text-white text-[9px] font-black uppercase tracking-widest">Most Popular</div>}
                <div className="mb-6">
                  <h4 className="text-base font-extrabold text-gray-900 dark:text-white mb-1">{tier.name}</h4>
                  <div className="flex items-end gap-1 mb-3">
                    <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{tier.price}</span>
                    <span className="text-xs text-gray-400 font-bold mb-1">/mo</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">{tier.description}</p>
                </div>
                <div className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <SignUpButton mode="redirect">
                  <span className={`relative z-50 block w-full py-3 rounded-lg font-bold text-sm transition-all text-center cursor-pointer ${tier.id === 'PRO' ? 'primary-gradient text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200'}`}>
                    Choose {tier.name}
                  </span>
                </SignUpButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-24 px-6 bg-white dark:bg-gray-900 border-t border-gray-50 dark:border-gray-800/50 pt-24">
        <div className="max-w-6xl mx-auto">
          <div className="space-y-8">
            <div className="text-center">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#5B5FFF] mb-2">Capabilities</h4>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Feature Breakdown</h3>
              <p className="text-[11px] text-gray-500 font-medium mt-1">Detailed comparison of tier-specific entitlements.</p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl bg-white dark:bg-[#0C0C0C]">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-black text-gray-500 dark:text-gray-400">
                  <TerminalIcon size={12} />
                  <span>matrix.entitlements — cat</span>
                </div>
                <div className="w-12" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-gray-50/30 dark:bg-gray-800/20">
                      <th className="p-4 text-left text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800/50">Feature</th>
                      <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800/50">Free</th>
                      <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800/50">Starter</th>
                      <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-[#5B5FFF] border-b border-[#5B5FFF]/20 bg-[#5B5FFF]/5">Pro</th>
                      <th className="p-4 text-center text-[9px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 dark:border-gray-800/50">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800/10">
                    {PRICING_MATRIX.map((row, i) => (
                      <tr key={i} className={`group transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-gray-100/40 dark:bg-gray-800/30'} hover:bg-gray-100/60 dark:hover:bg-gray-800/50`}>
                        <td className="p-4 text-xs font-bold text-gray-800 dark:text-gray-200 border-r border-gray-200 dark:border-gray-800/30 whitespace-nowrap">
                          <span className="text-[#5B5FFF] dark:text-emerald-500 opacity-0 group-hover:opacity-100 mr-2">→</span>
                          {row.feature}
                        </td>
                        <td className="p-4 text-center"><MatrixCell value={row.free} /></td>
                        <td className="p-4 text-center"><MatrixCell value={row.starter} /></td>
                        <td className="p-4 text-center bg-[#5B5FFF]/5 dark:bg-emerald-500/5 border-x border-gray-100/50 dark:border-gray-800/50"><MatrixCell value={row.pro} /></td>
                        <td className="p-4 text-center"><MatrixCell value={row.enterprise} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-2 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800 flex items-center gap-4 text-[9px] text-gray-400">
                <span>Total records: {PRICING_MATRIX.length}</span>
                <span>|</span>
                <span>Status: READY</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-[#FAFAFA] dark:bg-gray-900">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="text-left">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-3">FAQ</h2>
            <h3 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-6">
              <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-600 text-transparent bg-clip-text inline-block py-1">Frequently Asked <br /> Questions</span>
            </h3>
            <p className="text-base text-gray-500 dark:text-gray-400 font-medium mb-8 max-w-md leading-relaxed">Everything you need to know about the product and billing.</p>
            <a href="mailto:support@rostersync.io" className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-[#5B5FFF] text-white font-bold text-sm hover:opacity-90 shadow-lg shadow-[#5B5FFF]/10 transition-all">Contact Support</a>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <div key={i} className={cn("rounded-xl border transition-all duration-300 overflow-hidden", openFaqIndex === i ? "border-[#5B5FFF]/30 bg-white dark:bg-gray-800 shadow-lg shadow-[#5B5FFF]/5" : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800/50")}>
                <button onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)} className={cn("w-full px-6 py-5 flex items-center justify-between text-left transition-colors", "hover:bg-gray-50 dark:hover:bg-gray-700/30", openFaqIndex === i && "bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/10")}>
                  <span className={cn("font-bold text-base transition-colors", openFaqIndex === i ? "text-[#5B5FFF]" : "text-gray-900 dark:text-white")}>{faq.q}</span>
                  {openFaqIndex === i ? <Minus size={18} className="text-[#5B5FFF]" /> : <Plus size={18} className="text-gray-400" />}
                </button>
                {openFaqIndex === i && <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-1 duration-200"><p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed font-medium">{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="py-16 px-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <BrandLogo siteConfig={siteConfig} />
              <span className="font-extrabold text-lg tracking-tight font-mono text-gray-900 dark:text-white">{siteConfig.site_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <a href="https://x.com/rostersync" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Twitter size={20} /></a>
              <a href="https://linkedin.com/company/rostersync" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Linkedin size={20} /></a>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-10 gap-8 pt-8 border-t border-gray-100 dark:border-gray-800">
            <div className="md:col-span-3"><p className="text-sm font-medium text-gray-500 dark:text-gray-400">© 2026 {siteConfig.site_name}. All rights reserved.</p></div>
            <div className="md:col-span-7 flex flex-wrap gap-8 md:justify-end">
              <button onClick={() => setCurrentPage('about')} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">About</button>
              <a href="mailto:support@rostersync.io" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Contact</a>
              <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      {showDemoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowDemoModal(false)} className="absolute top-5 right-5 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"><X size={18} /></button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-lg bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center mx-auto mb-3"><Calendar size={24} /></div>
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Technical Demo</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">See how RosterSync fits your stack.</p>
            </div>
            <form onSubmit={handleDemoSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <input type="text" required value={demoForm.name} onChange={(e) => setDemoForm({ ...demoForm, name: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium text-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Work Email</label>
                <input type="email" required value={demoForm.email} onChange={(e) => setDemoForm({ ...demoForm, email: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium text-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Organization</label>
                <input type="text" value={demoForm.organization} onChange={(e) => setDemoForm({ ...demoForm, organization: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium text-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest ml-1">Broadcast Use Case</label>
                <textarea rows={2} value={demoForm.useCase} onChange={(e) => setDemoForm({ ...demoForm, useCase: e.target.value })} className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-none rounded-lg text-sm font-medium text-gray-900 dark:text-white resize-none" />
              </div>
              {demoStatus === 'success' ? (
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-2"><CheckCircle2 size={16} /> Request Received!</div>
              ) : (
                <button type="submit" disabled={demoStatus === 'sending'} className="w-full py-3.5 rounded-lg primary-gradient text-white font-bold shadow-lg flex items-center justify-center gap-2 text-sm">{demoStatus === 'sending' ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> Request Demo</>}</button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
