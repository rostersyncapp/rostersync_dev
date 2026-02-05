
import React from 'react';
import {
  LayoutDashboard,
  Cpu,
  Settings,
  LogOut,
  ChevronRight,
  Download,
  CheckCircle2,
  AlertCircle,
  FileJson,
  FileCode,
  Table,
  Upload,
  User,
  Plus,
  Disc,
  Video,
  Bot
} from 'lucide-react';

export const COLORS = {
  primary: '#5B5FFF',
  background: '#FAFAFA',
  text: '#1A1A1A',
};

/**
 * BRAND CONFIGURATION
 * Site-wide branding is now primarily driven by the 'site_config' database table.
 * Code fallbacks are kept minimal here.
 */
export const BRAND_CONFIG = {
  name: "rosterSync",
  // logoUrl is now managed via the database site_config table.
  icon: <Disc size={20} className="animate-spin-slow" />,
  abbreviation: "RS"
};

export const PRICING_TIERS = [
  {
    name: 'Free',
    id: 'BASIC',
    price: '$0',
    monthlyCredits: 20,
    description: 'For students, clubs, and freelancers.',
    features: ['20 AI Credits / Month', 'CSV_FLAT Export Only', '1 Project Maximum', 'Basic Normalization', 'Community Support'],
    polarCheckoutUrl: '#'
  },
  {
    name: 'Pro',
    id: 'PRO',
    price: '$79',
    monthlyCredits: 150,
    description: 'For freelance motion designers.',
    features: ['150 AI Credits / Month', 'Premiere, Iconik & CatDV', 'Logo & Color Discovery', 'Simplified Phonetics', 'Email Support'],
    polarCheckoutUrl: 'https://polar.sh/rostersync/products/pro-tier'
  },
  {
    name: 'Studio',
    id: 'STUDIO',
    price: '$149',
    monthlyCredits: 500,
    description: 'For RSNs and production teams.',
    features: ['500 AI Credits / Month', 'Ross, Vizrt, Tagboard', '3 Team Members', 'All Color Formats (RGB/PMS)', 'White-label Exports'],
    polarCheckoutUrl: 'https://polar.sh/rostersync/products/studio-tier'
  },
  {
    name: 'Network',
    id: 'NETWORK',
    price: '$249',
    monthlyCredits: 800,
    description: 'For national broadcasters.',
    features: ['800 AI Credits / Month', 'Full XML Suite (Ross/Viz/ODF)', '5 Team Members', 'Multi-Language (ES/ZH)', 'IPA Phonetics + API Access'],
    polarCheckoutUrl: 'https://polar.sh/rostersync/products/network-tier'
  }
];

export const getTierLimit = (tierId: string) => {
  const tier = PRICING_TIERS.find(t => t.id === tierId);
  return tier ? tier.monthlyCredits : 10;
};

export const NAV_ITEMS = [
  { name: 'Dashboard', icon: <LayoutDashboard size={20} />, id: 'dashboard' },
  { name: 'AI Scout', icon: <Bot size={20} />, id: 'engine' },
  { name: 'Settings', icon: <Settings size={20} />, id: 'settings' },
];
