import React, { useState, forwardRef, useRef, useEffect, useId } from 'react';
import { supabase, isSupabaseConfigured, SiteConfig } from '../services/supabase.ts';
import { PRICING_TIERS, BRAND_CONFIG } from '../constants.tsx';
import {
  CheckCircle2,
  ArrowRight,
  Sparkles,
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
  Box
} from 'lucide-react';
import { useClerk, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { WavyBackground } from './ui/wavy-background';
import TerminalWorkflow from './TerminalWorkflow';

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
  { q: "How does the AI normalization work?", a: "We use advanced large language models to parse raw text, identifying athlete names, jersey numbers, and positions. The engine then standardizes this data into hardware-safe formats compatible with broadcast character generators." },
  { q: "What is a 'Credit'?", a: "One credit equals one run of the AI Engine. A single run can process an entire roster text block (up to 8,000 tokens). Credits refresh monthly based on your subscription tier." },
  { q: "What is a multi-format output?", a: "RosterSync generates native files for different production systems from a single input—eliminating manual typing for Ross Xpression, Vizrt, and MAM systems simultaneously." },
  { q: "Can I export for Ross Xpression or Vizrt?", a: "Yes. Our Network tier includes direct exports for Ross DataLinq (XML/CSV) and Vizrt DataCenter, including automatic accent removal and case normalization." }
];


const FEATURES = [
  { icon: <Wand2 size={20} />, title: "AI Normalization", desc: "Instantly parses messy text from PDF scrapes, websites, and emails with 99.9% accuracy." },
  { icon: <ShieldCheck size={20} />, title: "Broadcast Safe", desc: "Automatically strips accents and sanitizes special characters for character generator compatibility." },
  { icon: <Palette size={20} />, title: "Smart Branding", desc: "Discovers official team hex codes, logos, and conference metadata automatically." },
  { icon: <Globe size={20} />, title: "Multi-Language", desc: "Generate phonetics and localized rosters in English, Spanish, and Mandarin instantly." },
  { icon: <Layers size={20} />, title: "Asset Management", desc: "Integrates with Iconik, CatDV, and other MAM systems via structured JSON metadata." },
  { icon: <Zap size={20} />, title: "Real-time Sync", desc: "Push updates directly to your production folders or cloud buckets in seconds." }
];

const BrandLogo: React.FC<{ siteConfig: SiteConfig; size?: 'sm' | 'md' }> = ({ siteConfig, size = 'md' }) => {
  const containerClasses = "w-7 h-7 rounded-lg shrink-0";
  return (
    <div className={`${containerClasses} primary-gradient flex items-center justify-center text-white shadow-lg shadow-[#5B5FFF]/20 overflow-hidden`}>
      {siteConfig.logo_url ? (
        <img src={siteConfig.logo_url} alt="Site Logo" className="w-full h-full object-cover" />
      ) : null}
    </div>
  );
};

const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp, darkMode, toggleDarkMode, siteConfig }) => {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [demoForm, setDemoForm] = useState({ name: '', email: '', organization: '', useCase: '' });
  const [demoStatus, setDemoStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDemoStatus('sending');
    try {
      const functionUrl = import.meta.env.VITE_RESEND_EMAIL_FUNCTION_URL;

      if (!functionUrl) {
        // Fallback for demo if env var is missing, though we expect it to be there
        console.warn("Missing VITE_RESEND_EMAIL_FUNCTION_URL");
        // Try direct insert as fallback or throw error? 
        // Given the user wants email, let's treat it as primary.
        throw new Error("Email service configuration missing.");
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          table: 'demo',
          record: {
            id: 'new', // Flag as new record
            name: demoForm.name,
            email: demoForm.email,
            user_email: demoForm.email,
            organization: demoForm.organization,
            use_case: demoForm.useCase || "Demo Request",
            message: `Organization: ${demoForm.organization || 'N/A'}\nUse Case: ${demoForm.useCase || 'General Inqiury'}` // Provide composed message for fallback
          }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send request");
      }

      setDemoStatus('success');
      setTimeout(() => {
        setShowDemoModal(false);
        setDemoStatus('idle');
        setDemoForm({ name: '', email: '', organization: '', useCase: '' });
      }, 2000);

    } catch (err: any) {
      console.error("Demo request failed:", err);
      setDemoStatus('error');
      alert(`Request failed: ${err.message}`);
    }
  };

  const CLERK_DOMAIN = 'https://winning-doe-44.accounts.dev';
  const clerk = useClerk();

  // Initialize with robust fallback for Safari/ITP blocking
  const [signInUrl, setSignInUrl] = useState(`${CLERK_DOMAIN}/sign-in?redirect_url=${encodeURIComponent(window.location.origin)}/`);
  const [signUpUrl, setSignUpUrl] = useState(`${CLERK_DOMAIN}/sign-up?redirect_url=${encodeURIComponent(window.location.origin)}/`);

  useEffect(() => {
    if (clerk?.loaded) {
      setSignInUrl(clerk.buildSignInUrl());
      setSignUpUrl(clerk.buildSignUpUrl());
    }
  }, [clerk?.loaded]);

  return (
    <div className={`min-h-screen font-sans selection:bg-[#5B5FFF]/30 ${darkMode ? 'dark' : ''} bg-[#FAFAFA] dark:bg-[#111827] text-gray-900 dark:text-gray-100 transition-colors duration-300`}>
      {/* Background Layer - Moved to root to avoid Safari Stacking Context issues */}
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
            <div className="w-8 h-8 rounded-lg primary-gradient text-white flex items-center justify-center shadow-lg shadow-[#5B5FFF]/20">
              {siteConfig?.logo_url ? <img src={siteConfig.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" /> : <Box size={18} />}
            </div>
            <span className="text-lg font-black tracking-tight text-gray-900 dark:text-white">{siteConfig?.site_name || 'rosterSync'}</span>
          </div>
          <div className="flex items-center gap-4 relative z-50">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-400 hover:text-[#5B5FFF] transition-colors rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <a href={signInUrl} className="hidden md:block text-xs font-bold text-gray-500 hover:text-[#5B5FFF] transition-colors cursor-pointer relative z-50">
              Sign In
            </a>
            <a href={signUpUrl} className="relative z-50 px-4 py-2 rounded-lg bg-[#1A1A1A] dark:bg-white text-white dark:text-[#1A1A1A] font-bold text-xs shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-64 md:pb-80 px-4 overflow-hidden z-10">
        <div className="max-w-7xl mx-auto text-center relative z-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5B5FFF]/5 border border-[#5B5FFF]/10 text-[#5B5FFF] text-[10px] font-black uppercase tracking-widest mb-2">
            <Sparkles size={12} /> New: Gemini 3 Integration
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter leading-[1.2] text-gray-900 dark:text-white">
            Athlete Rosters. <br />
            <span className="bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-purple-600 text-transparent bg-clip-text inline-block py-1">Simplified for Production.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Middleware transforming messy athlete data into production-ready metadata for MAM, DAM, and Broadcast systems.
          </p>
          <div className="pt-6 flex justify-center relative z-50">
            <button onClick={() => setShowDemoModal(true)} className="px-6 py-3.5 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-bold text-base hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">
              Book Demo
            </button>
          </div>
        </div>
      </section>

      {/* Terminal Workflow Demo Section */}
      <section className="pt-32 pb-20 px-6 bg-[#FAFAFA] dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-2">How It Works</h2>
            <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-purple-600 via-fuchsia-500 to-cyan-400 text-transparent bg-clip-text inline-block py-1">Paste. Parse. Export.</span>
            </h3>
            <p className="text-base text-gray-600 dark:text-gray-300 mt-3 max-w-xl mx-auto">
              Watch rosterSync transform messy roster data into broadcast-ready metadata in seconds.
            </p>
          </div>
          <TerminalWorkflow loop onExportComplete={(format) => console.log('Exported:', format)} />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-[#FAFAFA] dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-2">The Engine</h2>
            <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 text-transparent bg-clip-text inline-block py-1">Built for High-Stakes Broadcast</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="p-6 rounded-3xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all group">
                <div className="w-10 h-10 rounded-lg bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center mb-4 group-hover:bg-[#5B5FFF] group-hover:text-white transition-all">
                  {f.icon}
                </div>
                <h4 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">{f.title}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-6 relative overflow-hidden bg-white dark:bg-gray-900">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#5B5FFF]/5 rounded-full blur-[100px] -z-10"></div>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-2">Pricing</h2>
            <h3 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-indigo-500 to-purple-500 text-transparent bg-clip-text inline-block py-1">Scalable Workflows</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING_TIERS.map((tier) => (
              <div key={tier.id} className={`p-6 rounded-2xl bg-white dark:bg-gray-800 border-2 transition-all relative flex flex-col ${tier.id === 'PRO' ? 'border-[#5B5FFF] shadow-xl scale-105 z-10' : 'border-gray-100 dark:border-gray-700'}`}>
                {tier.id === 'PRO' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full primary-gradient text-white text-[9px] font-black uppercase tracking-widest">Most Popular</div>
                )}
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
                    <div key={i} className="flex items-start gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <SignUpButton mode="redirect">
                  <span
                    className={`relative z-50 block w-full py-3 rounded-lg font-bold text-sm transition-all text-center cursor-pointer ${tier.id === 'PRO' ? 'primary-gradient text-white shadow-lg' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200'}`}
                  >
                    Choose {tier.name}
                  </span>
                </SignUpButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-6 bg-[#FAFAFA] dark:bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5B5FFF] mb-2">FAQ</h2>
            <h3 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">Questions</h3>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openFaqIndex === i;
              return (
                <div key={i} className={cn(
                  "rounded-lg border transition-all duration-300 overflow-hidden",
                  isOpen
                    ? "border-[#5B5FFF]/30 bg-white dark:bg-gray-800 shadow-md"
                    : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800"
                )}>
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : i)}
                    className={cn(
                      "w-full px-5 py-4 flex items-center justify-between text-left transition-colors",
                      "hover:bg-gray-50 dark:hover:bg-gray-700/50",
                      isOpen && "bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/10"
                    )}
                  >
                    <span className={cn(
                      "font-bold text-sm transition-colors",
                      isOpen ? "text-[#5B5FFF]" : "text-gray-900 dark:text-white"
                    )}>{faq.q}</span>
                    {isOpen ? <Minus size={16} className="text-[#5B5FFF]" /> : <Plus size={16} className="text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 animate-in slide-in-from-top-2 duration-300">
                      <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed font-medium">{faq.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <BrandLogo siteConfig={siteConfig} />
            <span className="font-extrabold text-base tracking-tight font-mono text-gray-900 dark:text-white">{siteConfig.site_name}</span>
          </div>

          <div className="flex items-center gap-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <a href="#" className="hover:text-[#5B5FFF]">Privacy</a>
            <a href="#" className="hover:text-[#5B5FFF]">Terms</a>
            <a href="mailto:support@rostersync.io" className="hover:text-[#5B5FFF]">Support</a>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://x.com/rostersync" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-[#5B5FFF] transition-colors">
              <Twitter size={18} />
            </a>
            <span className="text-[9px] text-gray-300 dark:text-gray-600 font-bold uppercase tracking-[0.3em]">© 2026 {siteConfig.site_name}</span>
          </div>
        </div>
      </footer>

      {/* Demo Modal */}
      {showDemoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-2xl animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowDemoModal(false)} className="absolute top-5 right-5 p-1.5 text-gray-400 hover:bg-gray-100 rounded-full"><X size={18} /></button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-lg bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center mx-auto mb-3">
                <Calendar size={24} />
              </div>
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
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg text-center font-bold text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> Request Received!
                </div>
              ) : (
                <button type="submit" disabled={demoStatus === 'sending'} className="w-full py-3.5 rounded-lg primary-gradient text-white font-bold shadow-lg flex items-center justify-center gap-2 text-sm">
                  {demoStatus === 'sending' ? <Loader2 className="animate-spin" size={16} /> : <><Send size={16} /> Request Demo</>}
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
