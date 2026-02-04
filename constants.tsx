
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
    name: 'Basic',
    id: 'BASIC',
    price: '$0',
    monthlyCredits: 10,
    description: 'Perfect for testing and small local clubs.',
    features: ['10 AI Credits / Month', 'Standard CSV Export', 'Basic Normalization', 'Community Support'],
    polarCheckoutUrl: '#'
  },
  {
    name: 'Pro',
    id: 'PRO',
    price: '$49',
    monthlyCredits: 250,
    description: 'High volume processing for media houses.',
    features: ['250 AI Credits / Month', 'Adobe Premiere (MOGRT)', 'Iconik MAM JSON', 'Unlimited Storage', 'Phonetic Guides'],
    polarCheckoutUrl: 'https://polar.sh/rostersync/products/pro-tier'
  },
  {
    name: 'Network',
    id: 'NETWORK',
    price: '$249',
    monthlyCredits: 3000,
    description: 'Full broadcast integration for networks.',
    features: ['3,000 AI Credits / Month', 'Ross DataLinq XML', 'Localization (EN/ES/ZH)', 'Priority 24/7 Support', 'API Access'],
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
