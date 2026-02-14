
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
  Bot,
  Archive
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
    id: 'TRIAL',
    price: '$0',
    monthlyCredits: 50,
    description: 'Trial/Trialists',
    features: ['50 Credits (Limited Trial)', 'CSV_Flat Exports Only', 'Current Season Data Only', '1 Project Max'],
    polarCheckoutUrl: '#'
  },
  {
    name: 'Starter',
    id: 'STARTER',
    price: '$49',
    monthlyCredits: 150,
    description: 'Individual Creators',
    features: ['150 Credits / Month', '1 Seat', 'Hardware Safe + Simple Phonetics', 'English CSV/JSON Exports', '1-Year History', '5 Projects Max', 'Basic Branding (HEX)'],
    polarCheckoutUrl: '#'
  },
  {
    name: 'Pro',
    id: 'PRO',
    price: '$149',
    monthlyCredits: 500,
    description: 'MAM/DAM Workflows',
    features: ['500 Credits / Month', '3 Seats', 'MAM Sync (Iconik/CatDV)', 'All Broadcast Formats', '5-Year History', 'RGB/CMYK Colors', 'Unlimited Projects', 'Team Collaboration'],
    polarCheckoutUrl: 'https://polar.sh/rostersync/products/pro-tier'
  },
  {
    name: 'Enterprise',
    id: 'ENTERPRISE',
    price: '$199',
    monthlyCredits: 1000,
    description: 'National Broadcasters',
    features: ['1000 Credits / Month', '10+ Seats', 'IPA Phonetics', 'ES/ZH Support', 'Full 25-Year Archive', 'Custom Export Formats'],
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
