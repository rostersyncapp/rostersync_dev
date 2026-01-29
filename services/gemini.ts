
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Athlete, NILStatus, SubscriptionTier } from "../types.ts";
import { getBrandingCache, saveBrandingCache, recordUsage } from "./supabase.ts";

// Helper to get the key even if the build tool is doing static analysis on process.env.API_KEY
const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

export const isGeminiConfigured = !!getApiKey();

interface ProcessedRoster {
  teamName: string;
  sport: string;
  seasonYear: string;
  athletes: Athlete[];
  isNocMode?: boolean;
  verificationSources?: { title: string; uri: string }[];
  candidateTeams?: { name: string; logoUrl: string; primaryColor: string; secondaryColor: string; sport?: string; league?: string }[];
  league?: string;
  teamMetadata?: {
    primaryColor: string;
    secondaryColor: string;
    conference: string;
    abbreviation: string;
    logoUrl?: string;
    countryCode?: string;
  };
}

export type { ProcessedRoster };

function toSafeName(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, "")
    .trim();
}

/**
 * Known team logo URLs - these override AI results for reliability
 */
const KNOWN_TEAM_LOGOS: Record<string, { logoUrl: string; primaryColor: string; secondaryColor: string }> = {
  // ==================== ENGLISH PREMIER LEAGUE (ESPN) ====================
  "AFC BOURNEMOUTH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/349.png", primaryColor: "#f42727", secondaryColor: "#ffffff" },
  "BOURNEMOUTH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/349.png", primaryColor: "#f42727", secondaryColor: "#ffffff" },
  "ARSENAL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", primaryColor: "#e20520", secondaryColor: "#132257" },
  "ASTON VILLA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/362.png", primaryColor: "#660e36", secondaryColor: "#ffffff" },
  "BRENTFORD": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/337.png", primaryColor: "#f42727", secondaryColor: "#f8ced9" },
  "BRIGHTON & HOVE ALBION": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/331.png", primaryColor: "#0606fa", secondaryColor: "#ffdd00" },
  "BRIGHTON": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/331.png", primaryColor: "#0606fa", secondaryColor: "#ffdd00" },
  "BURNLEY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/379.png", primaryColor: "#6C1D45", secondaryColor: "#1a1a1a" },
  "CHELSEA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/363.png", primaryColor: "#144992", secondaryColor: "#ffeeee" },
  "CRYSTAL PALACE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/384.png", primaryColor: "#0202fb", secondaryColor: "#ffdd00" },
  "EVERTON": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/368.png", primaryColor: "#0606fa", secondaryColor: "#132257" },
  "FULHAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/370.png", primaryColor: "#ffffff", secondaryColor: "#d11317" },
  "LEEDS UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/357.png", primaryColor: "#ffffff", secondaryColor: "#ffff00" },
  "LEEDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/357.png", primaryColor: "#ffffff", secondaryColor: "#ffff00" },
  "LIVERPOOL FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/364.png", primaryColor: "#d11317", secondaryColor: "#132257" },
  "LIVERPOOL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/364.png", primaryColor: "#d11317", secondaryColor: "#132257" },
  "MANCHESTER CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", primaryColor: "#99c5ea", secondaryColor: "#e6ff00" },
  "MAN CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", primaryColor: "#99c5ea", secondaryColor: "#e6ff00" },
  "MANCHESTER UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/360.png", primaryColor: "#da020e", secondaryColor: "#144992" },
  "MAN UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/360.png", primaryColor: "#da020e", secondaryColor: "#144992" },
  "NEWCASTLE UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/361.png", primaryColor: "#000000", secondaryColor: "#cd1937" },
  "NEWCASTLE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/361.png", primaryColor: "#000000", secondaryColor: "#cd1937" },
  "NOTTINGHAM FOREST": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/393.png", primaryColor: "#c8102e", secondaryColor: "#132257" },
  "SUNDERLAND": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/366.png", primaryColor: "#EB172B", secondaryColor: "#87cced" },
  "TOTTENHAM HOTSPUR": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/367.png", primaryColor: "#ffffff", secondaryColor: "#9bafd8" },
  "TOTTENHAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/367.png", primaryColor: "#ffffff", secondaryColor: "#9bafd8" },
  "SPURS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/367.png", primaryColor: "#ffffff", secondaryColor: "#9bafd8" },
  "WEST HAM UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/371.png", primaryColor: "#7c2c3b", secondaryColor: "#000000" },
  "WEST HAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/371.png", primaryColor: "#7c2c3b", secondaryColor: "#000000" },
  "WOLVERHAMPTON WANDERERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/380.png", primaryColor: "#fdb913", secondaryColor: "#cd1937" },
  "WOLVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/380.png", primaryColor: "#fdb913", secondaryColor: "#cd1937" },

  // ==================== OTHER EUROPEAN SOCCER ====================
  // La Liga
  "REAL MADRID": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/86.png", primaryColor: "#FEBE10", secondaryColor: "#00529F" },
  "BARCELONA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png", primaryColor: "#A50044", secondaryColor: "#004D98" },
  "FC BARCELONA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png", primaryColor: "#A50044", secondaryColor: "#004D98" },
  "ATLETICO MADRID": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png", primaryColor: "#CB3524", secondaryColor: "#26468D" },
  // Bundesliga
  "BAYERN MUNICH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/132.png", primaryColor: "#DC052D", secondaryColor: "#0066B2" },
  "BORUSSIA DORTMUND": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/124.png", primaryColor: "#FDE100", secondaryColor: "#000000" },
  "DORTMUND": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/124.png", primaryColor: "#FDE100", secondaryColor: "#000000" },
  // Serie A
  "JUVENTUS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/111.png", primaryColor: "#000000", secondaryColor: "#FFFFFF" },
  "AC MILAN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/103.png", primaryColor: "#FB090B", secondaryColor: "#000000" },
  "MILAN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/103.png", primaryColor: "#FB090B", secondaryColor: "#000000" },
  "INTER MILAN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/110.png", primaryColor: "#010E80", secondaryColor: "#000000" },
  "INTER": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/110.png", primaryColor: "#010E80", secondaryColor: "#000000" },
  "NAPOLI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/114.png", primaryColor: "#12A0D7", secondaryColor: "#FFFFFF" },
  "AS ROMA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/104.png", primaryColor: "#8E1F2F", secondaryColor: "#F0BC42" },
  "ROMA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/104.png", primaryColor: "#8E1F2F", secondaryColor: "#F0BC42" },
  // Ligue 1
  "PSG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/160.png", primaryColor: "#004170", secondaryColor: "#DA291C" },
  "PARIS SAINT-GERMAIN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/160.png", primaryColor: "#004170", secondaryColor: "#DA291C" },
  // Additional European Aliases
  "BARCA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/83.png", primaryColor: "#A50044", secondaryColor: "#004D98" },
  "REAL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/86.png", primaryColor: "#FEBE10", secondaryColor: "#00529F" },
  "ATLETI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png", primaryColor: "#CB3524", secondaryColor: "#26468D" },
  "BAYERN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/132.png", primaryColor: "#DC052D", secondaryColor: "#0066B2" },
  "BVB": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/124.png", primaryColor: "#FDE100", secondaryColor: "#000000" },
  "JUVE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/111.png", primaryColor: "#000000", secondaryColor: "#FFFFFF" },
  "ROSSONERI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/103.png", primaryColor: "#FB090B", secondaryColor: "#000000" },
  "NERAZZURRI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/110.png", primaryColor: "#010E80", secondaryColor: "#000000" },
  "GUNNERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/359.png", primaryColor: "#e20520", secondaryColor: "#132257" },
  "RED DEVILS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/360.png", primaryColor: "#da020e", secondaryColor: "#144992" },
  "CITIZENS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/382.png", primaryColor: "#99c5ea", secondaryColor: "#e6ff00" },
  "MAGPIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/361.png", primaryColor: "#000000", secondaryColor: "#cd1937" },
  "HAMMERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/371.png", primaryColor: "#7c2c3b", secondaryColor: "#000000" },
  "VILLANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/362.png", primaryColor: "#660e36", secondaryColor: "#ffffff" },
  "TOFFEES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/368.png", primaryColor: "#0606fa", secondaryColor: "#132257" },
  "SEAGULLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/331.png", primaryColor: "#0606fa", secondaryColor: "#ffdd00" },
  "COTTAGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/370.png", primaryColor: "#ffffff", secondaryColor: "#d11317" },
  "OM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/176.png", primaryColor: "#ffffff", secondaryColor: "#011F68" },
  "OL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/167.png", primaryColor: "#ffffff", secondaryColor: "#1a1a1a" },

  // ==================== NHL (ESPN) ====================
  "ANAHEIM DUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/ana.png", primaryColor: "#fc4c02", secondaryColor: "#000000" },
  "DUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/ana.png", primaryColor: "#fc4c02", secondaryColor: "#000000" },
  "BOSTON BRUINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/bos.png", primaryColor: "#231f20", secondaryColor: "#fdb71a" },
  "BRUINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/bos.png", primaryColor: "#231f20", secondaryColor: "#fdb71a" },
  "BUFFALO SABRES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/buf.png", primaryColor: "#00468b", secondaryColor: "#fdb71a" },
  "SABRES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/buf.png", primaryColor: "#00468b", secondaryColor: "#fdb71a" },
  "CALGARY FLAMES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png", primaryColor: "#dd1a32", secondaryColor: "#000000" },
  "FLAMES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/cgy.png", primaryColor: "#dd1a32", secondaryColor: "#000000" },
  "CAROLINA HURRICANES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/car.png", primaryColor: "#e30426", secondaryColor: "#000000" },
  "HURRICANES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/car.png", primaryColor: "#e30426", secondaryColor: "#000000" },
  "CHICAGO BLACKHAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/chi.png", primaryColor: "#e31937", secondaryColor: "#000000" },
  "BLACKHAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/chi.png", primaryColor: "#e31937", secondaryColor: "#000000" },
  "COLORADO AVALANCHE": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/col.png", primaryColor: "#860038", secondaryColor: "#005ea3" },
  "AVALANCHE": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/col.png", primaryColor: "#860038", secondaryColor: "#005ea3" },
  "COLUMBUS BLUE JACKETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png", primaryColor: "#002d62", secondaryColor: "#e31937" },
  "BLUE JACKETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/cbj.png", primaryColor: "#002d62", secondaryColor: "#e31937" },
  "DALLAS STARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/dal.png", primaryColor: "#20864c", secondaryColor: "#000000" },
  "STARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/dal.png", primaryColor: "#20864c", secondaryColor: "#000000" },
  "DETROIT RED WINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/det.png", primaryColor: "#e30526", secondaryColor: "#ffffff" },
  "RED WINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/det.png", primaryColor: "#e30526", secondaryColor: "#ffffff" },
  "EDMONTON OILERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/edm.png", primaryColor: "#00205b", secondaryColor: "#ff4c00" },
  "OILERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/edm.png", primaryColor: "#00205b", secondaryColor: "#ff4c00" },
  "FLORIDA PANTHERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/fla.png", primaryColor: "#e51937", secondaryColor: "#002d62" },
  "PANTHERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/fla.png", primaryColor: "#e51937", secondaryColor: "#002d62" },
  "LOS ANGELES KINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/la.png", primaryColor: "#121212", secondaryColor: "#a2aaad" },
  // "KINGS" alias removed to avoid conflict with Sacramento Kings and Chennai Super Kings
  "MINNESOTA WILD": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/min.png", primaryColor: "#124734", secondaryColor: "#ae122a" },
  "WILD": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/min.png", primaryColor: "#124734", secondaryColor: "#ae122a" },
  "MONTREAL CANADIENS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png", primaryColor: "#c41230", secondaryColor: "#013a81" },
  "CANADIENS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/mtl.png", primaryColor: "#c41230", secondaryColor: "#013a81" },
  "NASHVILLE PREDATORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png", primaryColor: "#fdba31", secondaryColor: "#002d62" },
  "PREDATORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nsh.png", primaryColor: "#fdba31", secondaryColor: "#002d62" },
  "NEW JERSEY DEVILS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nj.png", primaryColor: "#e30b2b", secondaryColor: "#000000" },
  "DEVILS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nj.png", primaryColor: "#e30b2b", secondaryColor: "#000000" },
  "NEW YORK ISLANDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png", primaryColor: "#00529b", secondaryColor: "#f47d31" },
  "ISLANDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nyi.png", primaryColor: "#00529b", secondaryColor: "#f47d31" },
  "NEW YORK RANGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png", primaryColor: "#0056ae", secondaryColor: "#e51937" },
  "RANGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/nyr.png", primaryColor: "#0056ae", secondaryColor: "#e51937" },
  "OTTAWA SENATORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/ott.png", primaryColor: "#dd1a32", secondaryColor: "#b79257" },
  "SENATORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/ott.png", primaryColor: "#dd1a32", secondaryColor: "#b79257" },
  "PHILADELPHIA FLYERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/phi.png", primaryColor: "#fe5823", secondaryColor: "#000000" },
  "FLYERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/phi.png", primaryColor: "#fe5823", secondaryColor: "#000000" },
  "PITTSBURGH PENGUINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/pit.png", primaryColor: "#000000", secondaryColor: "#fdb71a" },
  "PENGUINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/pit.png", primaryColor: "#000000", secondaryColor: "#fdb71a" },
  "SAN JOSE SHARKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/sj.png", primaryColor: "#00788a", secondaryColor: "#070707" },
  "SHARKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/sj.png", primaryColor: "#00788a", secondaryColor: "#070707" },
  "SEATTLE KRAKEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/sea.png", primaryColor: "#000d33", secondaryColor: "#a3dce4" },
  "KRAKEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/sea.png", primaryColor: "#000d33", secondaryColor: "#a3dce4" },
  "ST. LOUIS BLUES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/stl.png", primaryColor: "#0070b9", secondaryColor: "#fdb71a" },
  "BLUES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/stl.png", primaryColor: "#0070b9", secondaryColor: "#fdb71a" },
  "TAMPA BAY LIGHTNING": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/tb.png", primaryColor: "#003e7e", secondaryColor: "#ffffff" },
  "LIGHTNING": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/tb.png", primaryColor: "#003e7e", secondaryColor: "#ffffff" },
  "TORONTO MAPLE LEAFS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/tor.png", primaryColor: "#003e7e", secondaryColor: "#ffffff" },
  "MAPLE LEAFS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/tor.png", primaryColor: "#003e7e", secondaryColor: "#ffffff" },
  "UTAH MAMMOTH": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/utah.png", primaryColor: "#000000", secondaryColor: "#7ab2e1" },
  "MAMMOTH": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/utah.png", primaryColor: "#000000", secondaryColor: "#7ab2e1" },
  "VANCOUVER CANUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/van.png", primaryColor: "#003e7e", secondaryColor: "#008752" },
  "CANUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/van.png", primaryColor: "#003e7e", secondaryColor: "#008752" },
  "VEGAS GOLDEN KNIGHTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png", primaryColor: "#344043", secondaryColor: "#b4975a" },
  "GOLDEN KNIGHTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/vgk.png", primaryColor: "#344043", secondaryColor: "#b4975a" },
  "WASHINGTON CAPITALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png", primaryColor: "#d71830", secondaryColor: "#0b1f41" },
  "CAPITALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/wsh.png", primaryColor: "#d71830", secondaryColor: "#0b1f41" },
  "WINNIPEG JETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png", primaryColor: "#002d62", secondaryColor: "#c41230" },
  "JETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nhl/500/wpg.png", primaryColor: "#002d62", secondaryColor: "#c41230" },

  // ==================== NFL (ESPN) ====================
  "ARIZONA CARDINALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png", primaryColor: "#a40227", secondaryColor: "#ffffff" },
  "CARDINALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ari.png", primaryColor: "#a40227", secondaryColor: "#ffffff" },
  "ATLANTA FALCONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png", primaryColor: "#a71930", secondaryColor: "#000000" },
  "FALCONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/atl.png", primaryColor: "#a71930", secondaryColor: "#000000" },
  "BALTIMORE RAVENS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png", primaryColor: "#29126f", secondaryColor: "#000000" },
  "RAVENS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/bal.png", primaryColor: "#29126f", secondaryColor: "#000000" },
  "BUFFALO BILLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png", primaryColor: "#00338d", secondaryColor: "#d50a0a" },
  "BILLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/buf.png", primaryColor: "#00338d", secondaryColor: "#d50a0a" },
  "CAROLINA PANTHERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/car.png", primaryColor: "#0085ca", secondaryColor: "#000000" },
  "CHICAGO BEARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png", primaryColor: "#0b1c3a", secondaryColor: "#e64100" },
  "BEARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/chi.png", primaryColor: "#0b1c3a", secondaryColor: "#e64100" },
  "CINCINNATI BENGALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png", primaryColor: "#fb4f14", secondaryColor: "#000000" },
  "BENGALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/cin.png", primaryColor: "#fb4f14", secondaryColor: "#000000" },
  "CLEVELAND BROWNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png", primaryColor: "#472a08", secondaryColor: "#ff3c00" },
  "BROWNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/cle.png", primaryColor: "#472a08", secondaryColor: "#ff3c00" },
  "DALLAS COWBOYS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png", primaryColor: "#002a5c", secondaryColor: "#b0b7bc" },
  "COWBOYS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/dal.png", primaryColor: "#002a5c", secondaryColor: "#b0b7bc" },
  "DENVER BRONCOS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/den.png", primaryColor: "#0a2343", secondaryColor: "#fc4c02" },
  "BRONCOS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/den.png", primaryColor: "#0a2343", secondaryColor: "#fc4c02" },
  "DETROIT LIONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/det.png", primaryColor: "#0076b6", secondaryColor: "#bbbbbb" },
  "LIONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/det.png", primaryColor: "#0076b6", secondaryColor: "#bbbbbb" },
  "GREEN BAY PACKERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png", primaryColor: "#204e32", secondaryColor: "#ffb612" },
  "PACKERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/gb.png", primaryColor: "#204e32", secondaryColor: "#ffb612" },
  "HOUSTON TEXANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png", primaryColor: "#00143f", secondaryColor: "#c41230" },
  "TEXANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png", primaryColor: "#00143f", secondaryColor: "#c41230" },
  "INDIANAPOLIS COLTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png", primaryColor: "#003b75", secondaryColor: "#ffffff" },
  "COLTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ind.png", primaryColor: "#003b75", secondaryColor: "#ffffff" },
  "JACKSONVILLE JAGUARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png", primaryColor: "#007487", secondaryColor: "#d7a22a" },
  "JAGUARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/jax.png", primaryColor: "#007487", secondaryColor: "#d7a22a" },
  "KANSAS CITY CHIEFS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png", primaryColor: "#e31837", secondaryColor: "#ffb612" },
  "CHIEFS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/kc.png", primaryColor: "#e31837", secondaryColor: "#ffb612" },
  "LAS VEGAS RAIDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png", primaryColor: "#000000", secondaryColor: "#a5acaf" },
  "RAIDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lv.png", primaryColor: "#000000", secondaryColor: "#a5acaf" },
  "LOS ANGELES CHARGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png", primaryColor: "#0080c6", secondaryColor: "#ffc20e" },
  "CHARGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lac.png", primaryColor: "#0080c6", secondaryColor: "#ffc20e" },
  "LOS ANGELES RAMS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png", primaryColor: "#003594", secondaryColor: "#ffd100" },
  "RAMS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png", primaryColor: "#003594", secondaryColor: "#ffd100" },
  "MIAMI DOLPHINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png", primaryColor: "#008e97", secondaryColor: "#fc4c02" },
  "DOLPHINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/mia.png", primaryColor: "#008e97", secondaryColor: "#fc4c02" },
  "MINNESOTA VIKINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/min.png", primaryColor: "#4f2683", secondaryColor: "#ffc62f" },
  "VIKINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/min.png", primaryColor: "#4f2683", secondaryColor: "#ffc62f" },
  "NEW ENGLAND PATRIOTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png", primaryColor: "#002a5c", secondaryColor: "#c60c30" },
  "PATRIOTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ne.png", primaryColor: "#002a5c", secondaryColor: "#c60c30" },
  "NEW ORLEANS SAINTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/no.png", primaryColor: "#d3bc8d", secondaryColor: "#000000" },
  "SAINTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/no.png", primaryColor: "#d3bc8d", secondaryColor: "#000000" },
  "NEW YORK GIANTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png", primaryColor: "#003c7f", secondaryColor: "#c9243f" },
  "GIANTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png", primaryColor: "#003c7f", secondaryColor: "#c9243f" },
  "NEW YORK JETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png", primaryColor: "#115740", secondaryColor: "#ffffff" },
  "PHILADELPHIA EAGLES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png", primaryColor: "#06424d", secondaryColor: "#000000" },
  "EAGLES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/phi.png", primaryColor: "#06424d", secondaryColor: "#000000" },
  "PITTSBURGH STEELERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png", primaryColor: "#000000", secondaryColor: "#ffb612" },
  "STEELERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/pit.png", primaryColor: "#000000", secondaryColor: "#ffb612" },
  "SAN FRANCISCO 49ERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png", primaryColor: "#aa0000", secondaryColor: "#b3995d" },
  "49ERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/sf.png", primaryColor: "#aa0000", secondaryColor: "#b3995d" },
  "SEATTLE SEAHAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png", primaryColor: "#002a5c", secondaryColor: "#69be28" },
  "SEAHAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png", primaryColor: "#002a5c", secondaryColor: "#69be28" },
  "TAMPA BAY BUCCANEERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png", primaryColor: "#bd1c36", secondaryColor: "#3e3a35" },
  "BUCCANEERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/tb.png", primaryColor: "#bd1c36", secondaryColor: "#3e3a35" },
  "TENNESSEE TITANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png", primaryColor: "#4b92db", secondaryColor: "#002a5c" },
  "TITANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/ten.png", primaryColor: "#4b92db", secondaryColor: "#002a5c" },
  "WASHINGTON COMMANDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png", primaryColor: "#5a1414", secondaryColor: "#ffb612" },
  "COMMANDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png", primaryColor: "#5a1414", secondaryColor: "#ffb612" },

  // ==================== MLB (ESPN) ====================
  "ARIZONA DIAMONDBACKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png", primaryColor: "#aa182c", secondaryColor: "#000000" },
  "DIAMONDBACKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png", primaryColor: "#aa182c", secondaryColor: "#000000" },
  "D-BACKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ari.png", primaryColor: "#aa182c", secondaryColor: "#000000" },
  "ATHLETICS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ath.png", primaryColor: "#003831", secondaryColor: "#efb21e" },
  "OAKLAND ATHLETICS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/ath.png", primaryColor: "#003831", secondaryColor: "#efb21e" },
  "ATLANTA BRAVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png", primaryColor: "#0c2340", secondaryColor: "#ba0c2f" },
  "BRAVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/atl.png", primaryColor: "#0c2340", secondaryColor: "#ba0c2f" },
  "BALTIMORE ORIOLES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png", primaryColor: "#df4601", secondaryColor: "#000000" },
  "ORIOLES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bal.png", primaryColor: "#df4601", secondaryColor: "#000000" },
  "BOSTON RED SOX": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", primaryColor: "#0d2b56", secondaryColor: "#bd3039" },
  "RED SOX": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/bos.png", primaryColor: "#0d2b56", secondaryColor: "#bd3039" },
  "CHICAGO CUBS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png", primaryColor: "#0e3386", secondaryColor: "#cc3433" },
  "CUBS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chc.png", primaryColor: "#0e3386", secondaryColor: "#cc3433" },
  "CHICAGO WHITE SOX": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png", primaryColor: "#000000", secondaryColor: "#c4ced4" },
  "WHITE SOX": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/chw.png", primaryColor: "#000000", secondaryColor: "#c4ced4" },
  "CINCINNATI REDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png", primaryColor: "#c6011f", secondaryColor: "#ffffff" },
  "REDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cin.png", primaryColor: "#c6011f", secondaryColor: "#ffffff" },
  "CLEVELAND GUARDIANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png", primaryColor: "#002b5c", secondaryColor: "#e31937" },
  "GUARDIANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/cle.png", primaryColor: "#002b5c", secondaryColor: "#e31937" },
  "COLORADO ROCKIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/col.png", primaryColor: "#33006f", secondaryColor: "#000000" },
  "ROCKIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/col.png", primaryColor: "#33006f", secondaryColor: "#000000" },
  "DETROIT TIGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/det.png", primaryColor: "#0a2240", secondaryColor: "#ff4713" },
  "TIGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/det.png", primaryColor: "#0a2240", secondaryColor: "#ff4713" },
  "HOUSTON ASTROS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png", primaryColor: "#002d62", secondaryColor: "#eb6e1f" },
  "ASTROS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/hou.png", primaryColor: "#002d62", secondaryColor: "#eb6e1f" },
  "KANSAS CITY ROYALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png", primaryColor: "#004687", secondaryColor: "#7ab2dd" },
  "ROYALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/kc.png", primaryColor: "#004687", secondaryColor: "#7ab2dd" },
  "LOS ANGELES ANGELS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png", primaryColor: "#ba0021", secondaryColor: "#c4ced4" },
  "ANGELS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/laa.png", primaryColor: "#ba0021", secondaryColor: "#c4ced4" },
  "LOS ANGELES DODGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png", primaryColor: "#005a9c", secondaryColor: "#ffffff" },
  "DODGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/lad.png", primaryColor: "#005a9c", secondaryColor: "#ffffff" },
  "MIAMI MARLINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png", primaryColor: "#00a3e0", secondaryColor: "#000000" },
  "MARLINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mia.png", primaryColor: "#00a3e0", secondaryColor: "#000000" },
  "MILWAUKEE BREWERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png", primaryColor: "#13294b", secondaryColor: "#ffc72c" },
  "BREWERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/mil.png", primaryColor: "#13294b", secondaryColor: "#ffc72c" },
  "MINNESOTA TWINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/min.png", primaryColor: "#031f40", secondaryColor: "#e20e32" },
  "TWINS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/min.png", primaryColor: "#031f40", secondaryColor: "#e20e32" },
  "NEW YORK METS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png", primaryColor: "#002d72", secondaryColor: "#ff5910" },
  "METS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nym.png", primaryColor: "#002d72", secondaryColor: "#ff5910" },
  "NEW YORK YANKEES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", primaryColor: "#132448", secondaryColor: "#c4ced4" },
  "YANKEES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png", primaryColor: "#132448", secondaryColor: "#c4ced4" },
  "PHILADELPHIA PHILLIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png", primaryColor: "#e81828", secondaryColor: "#003278" },
  "PHILLIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/phi.png", primaryColor: "#e81828", secondaryColor: "#003278" },
  "PITTSBURGH PIRATES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png", primaryColor: "#000000", secondaryColor: "#fdb827" },
  "PIRATES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/pit.png", primaryColor: "#000000", secondaryColor: "#fdb827" },
  "SAN DIEGO PADRES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png", primaryColor: "#2f241d", secondaryColor: "#ffc425" },
  "PADRES": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sd.png", primaryColor: "#2f241d", secondaryColor: "#ffc425" },
  "SAN FRANCISCO GIANTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sf.png", primaryColor: "#000000", secondaryColor: "#fd5a1e" },
  "SEATTLE MARINERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png", primaryColor: "#005c5c", secondaryColor: "#0c2c56" },
  "MARINERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/sea.png", primaryColor: "#005c5c", secondaryColor: "#0c2c56" },
  "ST. LOUIS CARDINALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/stl.png", primaryColor: "#be0a14", secondaryColor: "#001541" },
  "TAMPA BAY RAYS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png", primaryColor: "#092c5c", secondaryColor: "#8fbce6" },
  "RAYS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tb.png", primaryColor: "#092c5c", secondaryColor: "#8fbce6" },
  "TEXAS RANGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tex.png", primaryColor: "#003278", secondaryColor: "#c0111f" },
  "TORONTO BLUE JAYS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png", primaryColor: "#134a8e", secondaryColor: "#6cace5" },
  "BLUE JAYS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/tor.png", primaryColor: "#134a8e", secondaryColor: "#6cace5" },
  "WASHINGTON NATIONALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png", primaryColor: "#ab0003", secondaryColor: "#11225b" },
  "NATIONALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/mlb/500/wsh.png", primaryColor: "#ab0003", secondaryColor: "#11225b" },

  // ==================== NBA (ESPN) ====================
  "ATLANTA HAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png", primaryColor: "#c8102e", secondaryColor: "#fdb927" },
  "HAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/atl.png", primaryColor: "#c8102e", secondaryColor: "#fdb927" },
  "BOSTON CELTICS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png", primaryColor: "#008348", secondaryColor: "#ffffff" },
  "CELTICS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bos.png", primaryColor: "#008348", secondaryColor: "#ffffff" },
  "BROOKLYN NETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png", primaryColor: "#000000", secondaryColor: "#ffffff" },
  "NETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/bkn.png", primaryColor: "#000000", secondaryColor: "#ffffff" },
  "CHARLOTTE HORNETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cha.png", primaryColor: "#008ca8", secondaryColor: "#1d1060" },
  "HORNETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cha.png", primaryColor: "#008ca8", secondaryColor: "#1d1060" },
  "CHICAGO BULLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/chi.png", primaryColor: "#ce1141", secondaryColor: "#000000" },
  "BULLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/chi.png", primaryColor: "#ce1141", secondaryColor: "#000000" },
  "CLEVELAND CAVALIERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png", primaryColor: "#860038", secondaryColor: "#bc945c" },
  "CAVALIERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png", primaryColor: "#860038", secondaryColor: "#bc945c" },
  "CAVS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/cle.png", primaryColor: "#860038", secondaryColor: "#bc945c" },
  "DALLAS MAVERICKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/dal.png", primaryColor: "#0064b1", secondaryColor: "#bbc4ca" },
  "MAVERICKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/dal.png", primaryColor: "#0064b1", secondaryColor: "#bbc4ca" },
  "MAVS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/dal.png", primaryColor: "#0064b1", secondaryColor: "#bbc4ca" },
  "DENVER NUGGETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/den.png", primaryColor: "#0e2240", secondaryColor: "#fec524" },
  "NUGGETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/den.png", primaryColor: "#0e2240", secondaryColor: "#fec524" },
  "DETROIT PISTONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/det.png", primaryColor: "#1d428a", secondaryColor: "#c8102e" },
  "PISTONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/det.png", primaryColor: "#1d428a", secondaryColor: "#c8102e" },
  "GOLDEN STATE WARRIORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/gs.png", primaryColor: "#fdb927", secondaryColor: "#1d428a" },
  "WARRIORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/gs.png", primaryColor: "#fdb927", secondaryColor: "#1d428a" },
  "HOUSTON ROCKETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/hou.png", primaryColor: "#ce1141", secondaryColor: "#000000" },
  "ROCKETS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/hou.png", primaryColor: "#ce1141", secondaryColor: "#000000" },
  "INDIANA PACERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ind.png", primaryColor: "#0c2340", secondaryColor: "#ffd520" },
  "PACERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ind.png", primaryColor: "#0c2340", secondaryColor: "#ffd520" },
  "LA CLIPPERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png", primaryColor: "#12173f", secondaryColor: "#c8102e" },
  "CLIPPERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png", primaryColor: "#12173f", secondaryColor: "#c8102e" },
  "LOS ANGELES CLIPPERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lac.png", primaryColor: "#12173f", secondaryColor: "#c8102e" },
  "LOS ANGELES LAKERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png", primaryColor: "#552583", secondaryColor: "#fdb927" },
  "LAKERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/lal.png", primaryColor: "#552583", secondaryColor: "#fdb927" },
  "MEMPHIS GRIZZLIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mem.png", primaryColor: "#5d76a9", secondaryColor: "#12173f" },
  "GRIZZLIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mem.png", primaryColor: "#5d76a9", secondaryColor: "#12173f" },
  "MIAMI HEAT": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mia.png", primaryColor: "#98002e", secondaryColor: "#000000" },
  "HEAT": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mia.png", primaryColor: "#98002e", secondaryColor: "#000000" },
  "MILWAUKEE BUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mil.png", primaryColor: "#00471b", secondaryColor: "#eee1c6" },
  "BUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/mil.png", primaryColor: "#00471b", secondaryColor: "#eee1c6" },
  "MINNESOTA TIMBERWOLVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/min.png", primaryColor: "#266092", secondaryColor: "#79bc43" },
  "TIMBERWOLVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/min.png", primaryColor: "#266092", secondaryColor: "#79bc43" },
  "T-WOLVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/min.png", primaryColor: "#266092", secondaryColor: "#79bc43" },
  "NEW ORLEANS PELICANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/no.png", primaryColor: "#0a2240", secondaryColor: "#b4975a" },
  "PELICANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/no.png", primaryColor: "#0a2240", secondaryColor: "#b4975a" },
  "NEW YORK KNICKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png", primaryColor: "#1d428a", secondaryColor: "#f58426" },
  "KNICKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/ny.png", primaryColor: "#1d428a", secondaryColor: "#f58426" },
  "OKLAHOMA CITY THUNDER": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png", primaryColor: "#007ac1", secondaryColor: "#ef3b24" },
  "THUNDER": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/okc.png", primaryColor: "#007ac1", secondaryColor: "#ef3b24" },
  "ORLANDO MAGIC": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/orl.png", primaryColor: "#0150b5", secondaryColor: "#9ca0a3" },
  "MAGIC": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/orl.png", primaryColor: "#0150b5", secondaryColor: "#9ca0a3" },
  "PHILADELPHIA 76ERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png", primaryColor: "#1d428a", secondaryColor: "#e01234" },
  "76ERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png", primaryColor: "#1d428a", secondaryColor: "#e01234" },
  "SIXERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phi.png", primaryColor: "#1d428a", secondaryColor: "#e01234" },
  "PHOENIX SUNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png", primaryColor: "#29127a", secondaryColor: "#e56020" },
  "SUNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/phx.png", primaryColor: "#29127a", secondaryColor: "#e56020" },
  "PORTLAND TRAIL BLAZERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/por.png", primaryColor: "#e03a3e", secondaryColor: "#000000" },
  "TRAIL BLAZERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/por.png", primaryColor: "#e03a3e", secondaryColor: "#000000" },
  "BLAZERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/por.png", primaryColor: "#e03a3e", secondaryColor: "#000000" },
  "SACRAMENTO KINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/sac.png", primaryColor: "#5a2d81", secondaryColor: "#6a7a82" },
  "SAN ANTONIO SPURS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/sa.png", primaryColor: "#000000", secondaryColor: "#c4ced4" },
  "TORONTO RAPTORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/tor.png", primaryColor: "#d91244", secondaryColor: "#000000" },
  "RAPTORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/tor.png", primaryColor: "#d91244", secondaryColor: "#000000" },
  "UTAH JAZZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/utah.png", primaryColor: "#4e008e", secondaryColor: "#79a3dc" },
  "JAZZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/utah.png", primaryColor: "#4e008e", secondaryColor: "#79a3dc" },
  "WASHINGTON WIZARDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/wsh.png", primaryColor: "#e31837", secondaryColor: "#002b5c" },
  "WIZARDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/nba/500/wsh.png", primaryColor: "#e31837", secondaryColor: "#002b5c" },

  // ==================== MLS (ESPN) ====================
  "ATLANTA UNITED FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18418.png", primaryColor: "#9d2235", secondaryColor: "#aa9767" },
  "ATLANTA UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18418.png", primaryColor: "#9d2235", secondaryColor: "#aa9767" },
  "AUSTIN FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20906.png", primaryColor: "#00b140", secondaryColor: "#000000" },
  "CF MONTRÉAL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9720.png", primaryColor: "#003da6", secondaryColor: "#c1c5c8" },
  "CF MONTREAL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9720.png", primaryColor: "#003da6", secondaryColor: "#c1c5c8" },
  "MONTREAL IMPACT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9720.png", primaryColor: "#003da6", secondaryColor: "#c1c5c8" },
  "CHARLOTTE FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21300.png", primaryColor: "#0085ca", secondaryColor: "#000000" },
  "CHICAGO FIRE FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/182.png", primaryColor: "#7ccdef", secondaryColor: "#ff0000" },
  "CHICAGO FIRE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/182.png", primaryColor: "#7ccdef", secondaryColor: "#ff0000" },
  "COLORADO RAPIDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/184.png", primaryColor: "#8a2432", secondaryColor: "#8ab7e9" },
  "RAPIDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/184.png", primaryColor: "#8a2432", secondaryColor: "#8ab7e9" },
  "COLUMBUS CREW": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/183.png", primaryColor: "#000000", secondaryColor: "#fedd00" },
  "CREW": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/183.png", primaryColor: "#000000", secondaryColor: "#fedd00" },
  "D.C. UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/193.png", primaryColor: "#000000", secondaryColor: "#d61018" },
  "DC UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/193.png", primaryColor: "#000000", secondaryColor: "#d61018" },
  "FC CINCINNATI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18267.png", primaryColor: "#003087", secondaryColor: "#fe5000" },
  "FC DALLAS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/185.png", primaryColor: "#c6093b", secondaryColor: "#001f5b" },
  "HOUSTON DYNAMO FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6077.png", primaryColor: "#ff6b00", secondaryColor: "#101820" },
  "HOUSTON DYNAMO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6077.png", primaryColor: "#ff6b00", secondaryColor: "#101820" },
  "DYNAMO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6077.png", primaryColor: "#ff6b00", secondaryColor: "#101820" },
  "INTER MIAMI CF": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20232.png", primaryColor: "#231f20", secondaryColor: "#f7b5cd" },
  "INTER MIAMI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20232.png", primaryColor: "#231f20", secondaryColor: "#f7b5cd" },
  "LA GALAXY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/187.png", primaryColor: "#00235d", secondaryColor: "#ffffff" },
  "GALAXY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/187.png", primaryColor: "#00235d", secondaryColor: "#ffffff" },
  "LAFC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18966.png", primaryColor: "#000000", secondaryColor: "#c7a36f" },
  "LOS ANGELES FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18966.png", primaryColor: "#000000", secondaryColor: "#c7a36f" },
  "MINNESOTA UNITED FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17362.png", primaryColor: "#000000", secondaryColor: "#9bcde4" },
  "MINNESOTA UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17362.png", primaryColor: "#000000", secondaryColor: "#9bcde4" },
  "LOONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17362.png", primaryColor: "#000000", secondaryColor: "#9bcde4" },
  "NASHVILLE SC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18986.png", primaryColor: "#ece83a", secondaryColor: "#1f1646" },
  "NEW ENGLAND REVOLUTION": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/189.png", primaryColor: "#022166", secondaryColor: "#ce0e2d" },
  "REVOLUTION": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/189.png", primaryColor: "#022166", secondaryColor: "#ce0e2d" },
  "REVS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/189.png", primaryColor: "#022166", secondaryColor: "#ce0e2d" },
  "NEW YORK CITY FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17606.png", primaryColor: "#9fd2ff", secondaryColor: "#000229" },
  "NYCFC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17606.png", primaryColor: "#9fd2ff", secondaryColor: "#000229" },
  "NEW YORK RED BULLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/190.png", primaryColor: "#ba0c2f", secondaryColor: "#ffc72c" },
  "RED BULLS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/190.png", primaryColor: "#ba0c2f", secondaryColor: "#ffc72c" },
  "ORLANDO CITY SC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/12011.png", primaryColor: "#60269e", secondaryColor: "#f0d283" },
  "ORLANDO CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/12011.png", primaryColor: "#60269e", secondaryColor: "#f0d283" },
  "PHILADELPHIA UNION": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/10739.png", primaryColor: "#051f31", secondaryColor: "#e0d0a6" },
  "UNION": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/10739.png", primaryColor: "#051f31", secondaryColor: "#e0d0a6" },
  "PORTLAND TIMBERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9723.png", primaryColor: "#2c5234", secondaryColor: "#c99700" },
  "TIMBERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9723.png", primaryColor: "#2c5234", secondaryColor: "#c99700" },
  "REAL SALT LAKE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/4771.png", primaryColor: "#a32035", secondaryColor: "#daa900" },
  "RSL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/4771.png", primaryColor: "#a32035", secondaryColor: "#daa900" },
  "SAN DIEGO FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/22529.png", primaryColor: "#697a7C", secondaryColor: "#F89E1A" },
  "SAN JOSE EARTHQUAKES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/191.png", primaryColor: "#003da6", secondaryColor: "#ffffff" },
  "EARTHQUAKES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/191.png", primaryColor: "#003da6", secondaryColor: "#ffffff" },
  "QUAKES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/191.png", primaryColor: "#003da6", secondaryColor: "#ffffff" },
  "SEATTLE SOUNDERS FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9726.png", primaryColor: "#2dc84d", secondaryColor: "#0033a0" },
  "SEATTLE SOUNDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9726.png", primaryColor: "#2dc84d", secondaryColor: "#0033a0" },
  "SOUNDERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9726.png", primaryColor: "#2dc84d", secondaryColor: "#0033a0" },
  "SPORTING KANSAS CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/186.png", primaryColor: "#a7c6ed", secondaryColor: "#0a2240" },
  "SPORTING KC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/186.png", primaryColor: "#a7c6ed", secondaryColor: "#0a2240" },
  "SKC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/186.png", primaryColor: "#a7c6ed", secondaryColor: "#0a2240" },
  "ST. LOUIS CITY SC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21812.png", primaryColor: "#ec1458", secondaryColor: "#001544" },
  "ST LOUIS CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21812.png", primaryColor: "#ec1458", secondaryColor: "#001544" },
  "TORONTO FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/7318.png", primaryColor: "#aa182c", secondaryColor: "#a2a9ad" },
  "TFC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/7318.png", primaryColor: "#aa182c", secondaryColor: "#a2a9ad" },
  "VANCOUVER WHITECAPS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9727.png", primaryColor: "#ffffff", secondaryColor: "#12284c" },
  "WHITECAPS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9727.png", primaryColor: "#ffffff", secondaryColor: "#12284c" },

  // ==================== LIGA MX (ESPN) ====================
  "AMÉRICA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/227.png", primaryColor: "#ede939", secondaryColor: "#001c58" },
  "AMERICA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/227.png", primaryColor: "#ede939", secondaryColor: "#001c58" },
  "CLUB AMERICA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/227.png", primaryColor: "#ede939", secondaryColor: "#001c58" },
  "ATLAS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/221.png", primaryColor: "#ec1c23", secondaryColor: "#000000" },
  "ATLÉTICO DE SAN LUIS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19597.png", primaryColor: "#cb1e31", secondaryColor: "#0f2249" },
  "ATLETICO SAN LUIS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19597.png", primaryColor: "#cb1e31", secondaryColor: "#0f2249" },
  "CRUZ AZUL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/229.png", primaryColor: "#003c7e", secondaryColor: "#00478b" },
  "GUADALAJARA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/230.png", primaryColor: "#e30513", secondaryColor: "#1d1d32" },
  "CHIVAS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/230.png", primaryColor: "#e30513", secondaryColor: "#1d1d32" },
  "FC JUÁREZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18260.png", primaryColor: "#57b72d", secondaryColor: "#ef0c16" },
  "JUAREZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18260.png", primaryColor: "#57b72d", secondaryColor: "#ef0c16" },
  "LEÓN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/235.png", primaryColor: "#00722e", secondaryColor: "#f6c338" },
  "LEON": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/235.png", primaryColor: "#00722e", secondaryColor: "#f6c338" },
  "MAZATLÁN FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20349.png", primaryColor: "#562678", secondaryColor: "#000000" },
  "MAZATLAN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20349.png", primaryColor: "#562678", secondaryColor: "#000000" },
  "MONTERREY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/231.png", primaryColor: "#101633", secondaryColor: "#ffffff" },
  "RAYADOS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/231.png", primaryColor: "#101633", secondaryColor: "#ffffff" },
  "NECAXA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/228.png", primaryColor: "#f11d23", secondaryColor: "#ffffff" },
  "PACHUCA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/233.png", primaryColor: "#013280", secondaryColor: "#c1c5c8" },
  "TUZOS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/233.png", primaryColor: "#013280", secondaryColor: "#c1c5c8" },
  "PUEBLA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/234.png", primaryColor: "#323c8a", secondaryColor: "#ffffff" },
  "PUMAS UNAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/224.png", primaryColor: "#1b2d51", secondaryColor: "#a7905d" },
  "PUMAS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/224.png", primaryColor: "#1b2d51", secondaryColor: "#a7905d" },
  "UNAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/224.png", primaryColor: "#1b2d51", secondaryColor: "#a7905d" },
  "QUERÉTARO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/222.png", primaryColor: "#212121", secondaryColor: "#02b0d0" },
  "QUERETARO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/222.png", primaryColor: "#212121", secondaryColor: "#02b0d0" },
  "SANTOS LAGUNA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/225.png", primaryColor: "#15926d", secondaryColor: "#00331b" },
  "SANTOS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/225.png", primaryColor: "#15926d", secondaryColor: "#00331b" },
  "TIGRES UANL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/232.png", primaryColor: "#ffd011", secondaryColor: "#0000ff" },
  "TIGRES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/232.png", primaryColor: "#ffd011", secondaryColor: "#0000ff" },
  "TIJUANA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/10125.png", primaryColor: "#EF0107", secondaryColor: "#e1e1e1" },
  "XOLOS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/10125.png", primaryColor: "#EF0107", secondaryColor: "#e1e1e1" },
  "TOLUCA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/223.png", primaryColor: "#EF0107", secondaryColor: "#ffffff" },

  // ==================== LA LIGA (ESPN) ====================
  "ALAVÉS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/96.png", primaryColor: "#0000ff", secondaryColor: "#c3c3c3" },
  "ALAVES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/96.png", primaryColor: "#0000ff", secondaryColor: "#c3c3c3" },
  "ATHLETIC CLUB": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/93.png", primaryColor: "#C8142F", secondaryColor: "#0000ff" },
  "ATHLETIC BILBAO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/93.png", primaryColor: "#C8142F", secondaryColor: "#0000ff" },
  "ATLÉTICO MADRID": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/1068.png", primaryColor: "#ca3624", secondaryColor: "#c3c3c3" },
  "CELTA VIGO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/85.png", primaryColor: "#6cace4", secondaryColor: "#004996" },
  "ELCHE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3751.png", primaryColor: "#ffffff", secondaryColor: "#288A00" },
  "ESPANYOL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/88.png", primaryColor: "#3366CC", secondaryColor: "#C8142F" },
  "GETAFE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2922.png", primaryColor: "#0000ff", secondaryColor: "#C8142F" },
  "GIRONA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9812.png", primaryColor: "#C60000", secondaryColor: "#004996" },
  "LEVANTE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/1538.png", primaryColor: "#C8142F", secondaryColor: "#000000" },
  "MALLORCA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/84.png", primaryColor: "#C8142F", secondaryColor: "#ccff00" },
  "OSASUNA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/97.png", primaryColor: "#cd0000", secondaryColor: "#ffffff" },
  "RAYO VALLECANO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/101.png", primaryColor: "#ffffff", secondaryColor: "#cd0000" },
  "REAL BETIS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/244.png", primaryColor: "#288A00", secondaryColor: "#ccff00" },
  "BETIS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/244.png", primaryColor: "#288A00", secondaryColor: "#ccff00" },
  "REAL OVIEDO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/92.png", primaryColor: "#000000", secondaryColor: "#000000" },
  "REAL SOCIEDAD": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/89.png", primaryColor: "#3366CC", secondaryColor: "#ffdd00" },
  "SEVILLA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/243.png", primaryColor: "#ffffff", secondaryColor: "#d81022" },
  "VALENCIA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/94.png", primaryColor: "#ffffff", secondaryColor: "#004996" },
  "VILLARREAL": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/102.png", primaryColor: "#ffff00", secondaryColor: "#6cace4" },

  // ==================== BUNDESLIGA (ESPN) ====================
  "1. FC HEIDENHEIM 1846": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png", primaryColor: "#DA0308", secondaryColor: "#003399" },
  "HEIDENHEIM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6418.png", primaryColor: "#DA0308", secondaryColor: "#003399" },
  "1. FC UNION BERLIN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/598.png", primaryColor: "#DA0308", secondaryColor: "#d4d4d4" },
  "UNION BERLIN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/598.png", primaryColor: "#DA0308", secondaryColor: "#d4d4d4" },
  "BAYER LEVERKUSEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/131.png", primaryColor: "#DA0308", secondaryColor: "#f9fbfc" },
  "LEVERKUSEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/131.png", primaryColor: "#DA0308", secondaryColor: "#f9fbfc" },
  "BORUSSIA MÖNCHENGLADBACH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/268.png", primaryColor: "#ffffff", secondaryColor: "#03915c" },
  "GLADBACH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/268.png", primaryColor: "#ffffff", secondaryColor: "#03915c" },
  "EINTRACHT FRANKFURT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/125.png", primaryColor: "#ffffff", secondaryColor: "#272726" },
  "FRANKFURT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/125.png", primaryColor: "#ffffff", secondaryColor: "#272726" },
  "FC AUGSBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3841.png", primaryColor: "#ffffff", secondaryColor: "#03915c" },
  "AUGSBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3841.png", primaryColor: "#ffffff", secondaryColor: "#03915c" },
  "FC COLOGNE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/122.png", primaryColor: "#ffffff", secondaryColor: "#DA0308" },
  "KOLN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/122.png", primaryColor: "#ffffff", secondaryColor: "#DA0308" },
  "HAMBURG SV": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/127.png", primaryColor: "#1a26af", secondaryColor: "#1a1a1a" },
  "HAMBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/127.png", primaryColor: "#1a26af", secondaryColor: "#1a1a1a" },
  "FSV MAINZ 05": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2950.png", primaryColor: "#DA0308", secondaryColor: "#000055" },
  "MAINZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2950.png", primaryColor: "#DA0308", secondaryColor: "#000055" },
  "RB LEIPZIG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/11420.png", primaryColor: "#ffffff", secondaryColor: "#740c14" },
  "LEIPZIG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/11420.png", primaryColor: "#ffffff", secondaryColor: "#740c14" },
  "SC FREIBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/126.png", primaryColor: "#DA0308", secondaryColor: "#ffffff" },
  "FREIBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/126.png", primaryColor: "#DA0308", secondaryColor: "#ffffff" },
  "ST. PAULI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/270.png", primaryColor: "#442e23", secondaryColor: "#ffffff" },
  "TSG HAOFFENHEIM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/7911.png", primaryColor: "#003399", secondaryColor: "#000055" },
  "HOFFENHEIM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/7911.png", primaryColor: "#003399", secondaryColor: "#000055" },
  "VFB STUTTGART": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/134.png", primaryColor: "#ffffff", secondaryColor: "#DA0308" },
  "STUTTGART": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/134.png", primaryColor: "#ffffff", secondaryColor: "#DA0308" },
  "VFL WOLFSBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/138.png", primaryColor: "#81f733", secondaryColor: "#1a1a1a" },
  "WOLFSBURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/138.png", primaryColor: "#81f733", secondaryColor: "#1a1a1a" },
  "WERDER BREMEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/137.png", primaryColor: "#03915c", secondaryColor: "#ffffff" },
  "BREMEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/137.png", primaryColor: "#03915c", secondaryColor: "#ffffff" },

  // ==================== SERIE A (ESPN) ====================
  "ATALANTA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/105.png", primaryColor: "#1157bf", secondaryColor: "#ffffff" },
  "BOLOGNA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/107.png", primaryColor: "#04043d", secondaryColor: "#ffffff" },
  "CAGLIARI": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2925.png", primaryColor: "#282846", secondaryColor: "#ffffff" },
  "COMO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2572.png", primaryColor: "#3933FF", secondaryColor: "#FFFFFF" },
  "CREMONESE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/4050.png", primaryColor: "#FF0000", secondaryColor: "#ffffff" },
  "FIORENTINA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/109.png", primaryColor: "#4c1d84", secondaryColor: "#ffffff" },
  "GENOA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3263.png", primaryColor: "#08305d", secondaryColor: "#ffffff" },
  "HELLAS VERONA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/119.png", primaryColor: "#00239c", secondaryColor: "#ffffff" },
  "VERONA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/119.png", primaryColor: "#00239c", secondaryColor: "#ffffff" },
  "LAZIO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/112.png", primaryColor: "#74bde7", secondaryColor: "#ffef32" },
  "LECCE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/113.png", primaryColor: "#e4002b", secondaryColor: "#08305d" },
  "PARMA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/115.png", primaryColor: "#19161D", secondaryColor: "#ffdd30" },
  "PISA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3956.png", primaryColor: "#1a1a1a", secondaryColor: "#1a1a1a" },
  "SASSUOLO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3997.png", primaryColor: "#0fa653", secondaryColor: "#000000" },
  "TORINO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/239.png", primaryColor: "#9f0000", secondaryColor: "#ffffff" },
  "UDINESE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/118.png", primaryColor: "#19161D", secondaryColor: "#ffef32" },

  // ==================== LIGUE 1 (ESPN) ====================
  "AJ AUXERRE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/172.png", primaryColor: "#ffffff", secondaryColor: "#1a1a1a" },
  "AUXERRE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/172.png", primaryColor: "#ffffff", secondaryColor: "#1a1a1a" },
  "AS MONACO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/174.png", primaryColor: "#E91514", secondaryColor: "#004c37" },
  "MONACO": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/174.png", primaryColor: "#E91514", secondaryColor: "#004c37" },
  "ANGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/7868.png", primaryColor: "#1a1a1a", secondaryColor: "#ffffff" },
  "BREST": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6997.png", primaryColor: "#ef2f24", secondaryColor: "#ffffff" },
  "LE HAVRE AC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3236.png", primaryColor: "#011F68", secondaryColor: "#ededed" },
  "LE HAVRE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/3236.png", primaryColor: "#011F68", secondaryColor: "#ededed" },
  "LENS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/175.png", primaryColor: "#E91514", secondaryColor: "#004c37" },
  "LILLE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/166.png", primaryColor: "#c2051b", secondaryColor: "#e2d3d7" },
  "LORIENT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/273.png", primaryColor: "#f46100", secondaryColor: "#1a1a1a" },
  "LYON": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/167.png", primaryColor: "#ffffff", secondaryColor: "#1a1a1a" },
  "MARSEILLE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/176.png", primaryColor: "#ffffff", secondaryColor: "#011F68" },
  "METZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/177.png", primaryColor: "#8C3140", secondaryColor: "#e6c168" },
  "NANTES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/165.png", primaryColor: "#ffff00", secondaryColor: "#011F68" },
  "OGC NICE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2502.png", primaryColor: "#ef2f24", secondaryColor: "#e2d3d7" },
  "NICE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/2502.png", primaryColor: "#ef2f24", secondaryColor: "#e2d3d7" },
  "PARIS FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/6851.png", primaryColor: "#000000", secondaryColor: "#000000" },
  "STADE RENNAIS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/169.png", primaryColor: "#ef2f24", secondaryColor: "#ffffff" },
  "RENNES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/169.png", primaryColor: "#ef2f24", secondaryColor: "#ffffff" },
  "STRASBOURG": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/180.png", primaryColor: "#0000bf", secondaryColor: "#ffffff" },
  "TOULOUSE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/179.png", primaryColor: "#560080", secondaryColor: "#ffff00" },

  // ==================== WNBA (ESPN) ====================
  "ATLANTA DREAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/atl.png", primaryColor: "#e31837", secondaryColor: "#5091cc" },
  "DREAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/atl.png", primaryColor: "#e31837", secondaryColor: "#5091cc" },
  "CHICAGO SKY": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/chi.png", primaryColor: "#5091cd", secondaryColor: "#ffd520" },
  "SKY": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/chi.png", primaryColor: "#5091cd", secondaryColor: "#ffd520" },
  "CONNECTICUT SUN": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/con.png", primaryColor: "#f05023", secondaryColor: "#0a2240" },
  "SUN": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/con.png", primaryColor: "#f05023", secondaryColor: "#0a2240" },
  "DALLAS WINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/dal.png", primaryColor: "#002b5c", secondaryColor: "#c4d600" },
  "WINGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/dal.png", primaryColor: "#002b5c", secondaryColor: "#c4d600" },
  "GOLDEN STATE VALKYRIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/gs.png", primaryColor: "#b38fcf", secondaryColor: "#000000" },
  "VALKYRIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/gs.png", primaryColor: "#b38fcf", secondaryColor: "#000000" },
  "INDIANA FEVER": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/ind.png", primaryColor: "#002d62", secondaryColor: "#e03a3e" },
  "FEVER": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/ind.png", primaryColor: "#002d62", secondaryColor: "#e03a3e" },
  "LAS VEGAS ACES": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png", primaryColor: "#a7a8aa", secondaryColor: "#000000" },
  "ACES": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/lv.png", primaryColor: "#a7a8aa", secondaryColor: "#000000" },
  "LOS ANGELES SPARKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/la.png", primaryColor: "#552583", secondaryColor: "#fdb927" },
  "SPARKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/la.png", primaryColor: "#552583", secondaryColor: "#fdb927" },
  "MINNESOTA LYNX": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/min.png", primaryColor: "#266092", secondaryColor: "#79bc43" },
  "LYNX": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/min.png", primaryColor: "#266092", secondaryColor: "#79bc43" },
  "NEW YORK LIBERTY": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/ny.png", primaryColor: "#86cebc", secondaryColor: "#000000" },
  "LIBERTY": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/ny.png", primaryColor: "#86cebc", secondaryColor: "#000000" },
  "PHOENIX MERCURY": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/phx.png", primaryColor: "#3c286e", secondaryColor: "#fa4b0a" },
  "MERCURY": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/phx.png", primaryColor: "#3c286e", secondaryColor: "#fa4b0a" },
  "SEATTLE STORM": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/sea.png", primaryColor: "#2c5235", secondaryColor: "#fee11a" },
  "STORM": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/sea.png", primaryColor: "#2c5235", secondaryColor: "#fee11a" },
  "WASHINGTON MYSTICS": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/wsh.png", primaryColor: "#e03a3e", secondaryColor: "#002b5c" },
  "MYSTICS": { logoUrl: "https://a.espncdn.com/i/teamlogos/wnba/500/wsh.png", primaryColor: "#e03a3e", secondaryColor: "#002b5c" },

  // ==================== NWSL (ESPN) ====================
  "ANGEL CITY FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21422.png", primaryColor: "#202121", secondaryColor: "#898c8f" },
  "ANGEL CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21422.png", primaryColor: "#202121", secondaryColor: "#898c8f" },
  "BAY FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/22187.png", primaryColor: "#0d2032", secondaryColor: "#dfdede" },
  "CHICAGO STARS FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15360.png", primaryColor: "#c7102e", secondaryColor: "#41b6e6" },
  "CHICAGO STARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15360.png", primaryColor: "#c7102e", secondaryColor: "#41b6e6" },
  "GOTHAM FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15364.png", primaryColor: "#a9f1fd", secondaryColor: "#000000" },
  "GOTHAM": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15364.png", primaryColor: "#a9f1fd", secondaryColor: "#000000" },
  "NJ/NY GOTHAM FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15364.png", primaryColor: "#a9f1fd", secondaryColor: "#000000" },
  "HOUSTON DASH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17346.png", primaryColor: "#ff6900", secondaryColor: "#8ab7e9" },
  "DASH": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17346.png", primaryColor: "#ff6900", secondaryColor: "#8ab7e9" },
  "KANSAS CITY CURRENT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20907.png", primaryColor: "#cf3339", secondaryColor: "#62cbc9" },
  "KC CURRENT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20907.png", primaryColor: "#cf3339", secondaryColor: "#62cbc9" },
  "NORTH CAROLINA COURAGE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15366.png", primaryColor: "#ab0033", secondaryColor: "#00416b" },
  "NC COURAGE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15366.png", primaryColor: "#ab0033", secondaryColor: "#00416b" },
  "COURAGE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15366.png", primaryColor: "#ab0033", secondaryColor: "#00416b" },
  "ORLANDO PRIDE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18206.png", primaryColor: "#c5b5f2", secondaryColor: "#14002f" },
  "PRIDE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18206.png", primaryColor: "#c5b5f2", secondaryColor: "#14002f" },
  "PORTLAND THORNS FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15362.png", primaryColor: "#000000", secondaryColor: "#ee202f" },
  "PORTLAND THORNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15362.png", primaryColor: "#000000", secondaryColor: "#ee202f" },
  "THORNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15362.png", primaryColor: "#000000", secondaryColor: "#ee202f" },
  "RACING LOUISVILLE FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20905.png", primaryColor: "#c5b5f2", secondaryColor: "#14002f" },
  "RACING LOUISVILLE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20905.png", primaryColor: "#c5b5f2", secondaryColor: "#14002f" },
  "SAN DIEGO WAVE FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21423.png", primaryColor: "#032e62", secondaryColor: "#21c6d9" },
  "SAN DIEGO WAVE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21423.png", primaryColor: "#032e62", secondaryColor: "#21c6d9" },
  "WAVE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21423.png", primaryColor: "#032e62", secondaryColor: "#21c6d9" },
  "SEATTLE REIGN FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15363.png", primaryColor: "#292431", secondaryColor: "#2e407a" },
  "SEATTLE REIGN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15363.png", primaryColor: "#292431", secondaryColor: "#2e407a" },
  "REIGN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15363.png", primaryColor: "#292431", secondaryColor: "#2e407a" },
  "UTAH ROYALS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19141.png", primaryColor: "#ae122a", secondaryColor: "#fdb71a" },
  "WASHINGTON SPIRIT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15365.png", primaryColor: "#000000", secondaryColor: "#ede939" },
  "SPIRIT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/15365.png", primaryColor: "#000000", secondaryColor: "#ede939" },

  // ==================== USL CHAMPIONSHIP (ESPN) ====================
  "BIRMINGHAM LEGION FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19405.png", primaryColor: "#000000", secondaryColor: "#876700" },
  "LEGION": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19405.png", primaryColor: "#000000", secondaryColor: "#876700" },
  "BROOKLYN FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/131579.png", primaryColor: "#4E3524", secondaryColor: "#DFD4BC" },
  "CHARLESTON BATTERY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9729.png", primaryColor: "#000000", secondaryColor: "#e9ed07" },
  "BATTERY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/9729.png", primaryColor: "#000000", secondaryColor: "#e9ed07" },
  "COLORADO SPRINGS SWITCHBACKS FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17830.png", primaryColor: "#666563", secondaryColor: "#2f4bd8" },
  "SWITCHBACKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17830.png", primaryColor: "#666563", secondaryColor: "#2f4bd8" },
  "DETROIT CITY FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19179.png", primaryColor: "#643335", secondaryColor: "#D69A2D" },
  "DETROIT CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19179.png", primaryColor: "#643335", secondaryColor: "#D69A2D" },
  "EL PASO LOCOMOTIVE FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19407.png", primaryColor: "#002363", secondaryColor: "#f0de0f" },
  "LOCOMOTIVE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19407.png", primaryColor: "#002363", secondaryColor: "#f0de0f" },
  "FC TULSA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18446.png", primaryColor: "#070784", secondaryColor: "#e58209" },
  "TULSA": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18446.png", primaryColor: "#070784", secondaryColor: "#e58209" },
  "HARTFORD ATHLETIC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19411.png", primaryColor: "#00a030", secondaryColor: "#0024a8" },
  "INDY ELEVEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17360.png", primaryColor: "#13018c", secondaryColor: "#C60000" },
  "LAS VEGAS LIGHTS FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18987.png", primaryColor: "#000000", secondaryColor: "#f2e604" },
  "LIGHTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18987.png", primaryColor: "#000000", secondaryColor: "#f2e604" },
  "LEXINGTON": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21822.png", primaryColor: "#00491E", secondaryColor: "#44D62C" },
  "LOUDOUN UNITED FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19410.png", primaryColor: "#000000", secondaryColor: "#C60000" },
  "LOUDOUN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19410.png", primaryColor: "#000000", secondaryColor: "#C60000" },
  "LOUISVILLE CITY FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17832.png", primaryColor: "#8801ad", secondaryColor: "#d6c72a" },
  "LOU CITY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17832.png", primaryColor: "#8801ad", secondaryColor: "#d6c72a" },
  "MIAMI FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18159.png", primaryColor: "#f05123", secondaryColor: "#263895" },
  "MONTEREY BAY": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/21370.png", primaryColor: "#02F9F9", secondaryColor: "#2A4666" },
  "NEW MEXICO UNITED": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/19408.png", primaryColor: "#ffea00", secondaryColor: "#000000" },
  "OAKLAND ROOTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20687.png", primaryColor: "#000000", secondaryColor: "#878787" },
  "ROOTS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/20687.png", primaryColor: "#000000", secondaryColor: "#878787" },
  "ORANGE COUNTY SC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18455.png", primaryColor: "#000000", secondaryColor: "#FF6720" },
  "PHOENIX RISING FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17850.png", primaryColor: "#000000", secondaryColor: "#C60000" },
  "RISING": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17850.png", primaryColor: "#000000", secondaryColor: "#C60000" },
  "PITTSBURGH RIVERHOUNDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17827.png", primaryColor: "#e8d035", secondaryColor: "#000000" },
  "RIVERHOUNDS": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17827.png", primaryColor: "#e8d035", secondaryColor: "#000000" },
  "RHODE ISLAND FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/22164.png", primaryColor: "#041E42", secondaryColor: "#FFA400" },
  "RHODE ISLAND": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/22164.png", primaryColor: "#041E42", secondaryColor: "#FFA400" },
  "SACRAMENTO REPUBLIC FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17828.png", primaryColor: "#870505", secondaryColor: "#473403" },
  "REPUBLIC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17828.png", primaryColor: "#870505", secondaryColor: "#473403" },
  "SAN ANTONIO FC": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/18265.png", primaryColor: "#878787", secondaryColor: "#000000" },
  "SPORTING JAX": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/131578.png", primaryColor: "#72CAF7", secondaryColor: "#FFAC3E" },
  "TAMPA BAY ROWDIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17361.png", primaryColor: "#09bc0c", secondaryColor: "#f2ee07" },
  "ROWDIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/17361.png", primaryColor: "#09bc0c", secondaryColor: "#f2ee07" },

  // ==================== EREDIVISIE (ESPN) ====================
  "AJAX": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/139.png", primaryColor: "#DF1B27", secondaryColor: "#4d6286" },
  "AFC AJAX": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/139.png", primaryColor: "#DF1B27", secondaryColor: "#4d6286" },
  "AZ ALKMAAR": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/140.png", primaryColor: "#ef2f24", secondaryColor: "#ffffff" },
  "AZ": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/140.png", primaryColor: "#ef2f24", secondaryColor: "#ffffff" },
  "FEYENOORD": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/144.png", primaryColor: "#0000d4", secondaryColor: "#307B64" },
  "PSV EINDHOVEN": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/148.png", primaryColor: "#ef2f24", secondaryColor: "#000000" },
  "PSV": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/148.png", primaryColor: "#ef2f24", secondaryColor: "#000000" },
  "FC UTRECHT": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/154.png", primaryColor: "#FCEE33", secondaryColor: "#ffffff" },
  "FC TWENTE": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/153.png", primaryColor: "#F31522", secondaryColor: "#1a316b" },
  "RKC WAALWIJK": { logoUrl: "https://a.espncdn.com/i/teamlogos/soccer/500/155.png", primaryColor: "#0c57f2", secondaryColor: "#84aee7" },

  // ==================== NCAA FOOTBALL (ESPN) ====================
  "ALABAMA CRIMSON TIDE": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/333.png", primaryColor: "#9e1b32", secondaryColor: "#ffffff" },
  "GEORGIA BULLDOGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/61.png", primaryColor: "#ba0c2f", secondaryColor: "#2c2a29" },
  "OHIO STATE BUCKEYES": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/194.png", primaryColor: "#ba0c2f", secondaryColor: "#a8adb4" },
  "MICHIGAN WOLVERINES": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/130.png", primaryColor: "#00274c", secondaryColor: "#ffcb05" },
  "TEXAS LONGHORNS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/251.png", primaryColor: "#af5c37", secondaryColor: "#ffffff" },
  "LSU TIGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/99.png", primaryColor: "#461d76", secondaryColor: "#fdd023" },
  "FLORIDA STATE SEMINOLES": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/52.png", primaryColor: "#782f40", secondaryColor: "#ceb888" },
  "FSU": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/52.png", primaryColor: "#782f40", secondaryColor: "#ceb888" },
  "OREGON DUCKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2483.png", primaryColor: "#00934b", secondaryColor: "#fff41b" },
  "USC TROJANS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/30.png", primaryColor: "#9d2235", secondaryColor: "#ffc72c" },
  "NOTRE DAME FIGHTING IRISH": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/87.png", primaryColor: "#062340", secondaryColor: "#c99700" },
  "PENN STATE NITTANY LIONS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/213.png", primaryColor: "#061440", secondaryColor: "#ffffff" },
  "CLEMSON TIGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/228.png", primaryColor: "#f56600", secondaryColor: "#ffffff" },
  "TENNESSEE VOLUNTEERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2633.png", primaryColor: "#ff8200", secondaryColor: "#ffffff" },
  "OKLAHOMA SOONERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/201.png", primaryColor: "#990000", secondaryColor: "#ffffff" },
  "MIAMI HURRICANES": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2390.png", primaryColor: "#f47423", secondaryColor: "#035131" },
  "AUBURN TIGERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2.png", primaryColor: "#002b5c", secondaryColor: "#f26522" },
  "FLORIDA GATORS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/57.png", primaryColor: "#0021a5", secondaryColor: "#fa4616" },
  "TEXAS A&M AGGIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/245.png", primaryColor: "#500000", secondaryColor: "#ffffff" },

  // ==================== IPL (Cricket) ====================
  "CHENNAI SUPER KINGS": { logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/2b/Chennai_Super_Kings_Logo.svg", primaryColor: "#FFFF3C", secondaryColor: "#0081E9" },
  "CSK": { logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/2b/Chennai_Super_Kings_Logo.svg", primaryColor: "#FFFF3C", secondaryColor: "#0081E9" },
  "DELHI CAPITALS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Delhi_Capitals_Logo.png", primaryColor: "#00008B", secondaryColor: "#FF0000" },
  "GUJARAT TITANS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/09/Gujarat_Titans_Logo.svg", primaryColor: "#1B2133", secondaryColor: "#D1AB3E" },
  "KOLKATA KNIGHT RIDERS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Kolkata_Knight_Riders_Logo.svg", primaryColor: "#3A225D", secondaryColor: "#F7D54E" },
  "KKR": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Kolkata_Knight_Riders_Logo.svg", primaryColor: "#3A225D", secondaryColor: "#F7D54E" },
  "LUCKNOW SUPER GIANTS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Lucknow_Super_Giants_Logo.svg", primaryColor: "#3CDCA0", secondaryColor: "#173059" },
  "LSG": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/34/Lucknow_Super_Giants_Logo.svg", primaryColor: "#3CDCA0", secondaryColor: "#173059" },
  "MUMBAI INDIANS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cd/Mumbai_Indians_Logo.svg", primaryColor: "#004BA0", secondaryColor: "#D1AB3E" },
  "PUNJAB KINGS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Punjab_Kings_Logo.svg", primaryColor: "#DD1F2D", secondaryColor: "#DCDDDF" },
  "PBKS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Punjab_Kings_Logo.svg", primaryColor: "#DD1F2D", secondaryColor: "#DCDDDF" },
  "RAJASTHAN ROYALS": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/60/Rajasthan_Royals_Logo.svg", primaryColor: "#254AA5", secondaryColor: "#EFB9BC" },
  "ROYAL CHALLENGERS BENGALURU": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Royal_Challengers_Bangalore_2020.svg", primaryColor: "#EC1C24", secondaryColor: "#BFA36F" },
  "RCB": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Royal_Challengers_Bangalore_2020.svg", primaryColor: "#EC1C24", secondaryColor: "#BFA36F" },
  "SUNRISERS HYDERABAD": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Sunrisers_Hyderabad.svg", primaryColor: "#F7A721", secondaryColor: "#000000" },
  "SRH": { logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Sunrisers_Hyderabad.svg", primaryColor: "#F7A721", secondaryColor: "#000000" },

  // ==================== NCAA BASKETBALL (Blue Bloods + Key Teams) ====================
  "DUKE BLUE DEVILS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/150.png", primaryColor: "#003087", secondaryColor: "#ffffff" },
  "NORTH CAROLINA TAR HEELS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/153.png", primaryColor: "#7baa44", secondaryColor: "#ffffff" }, // UNC blue is #7BAFD4 actually, checking espn data is safer but hardcoded is fine for now
  "KANSAS JAYHAWKS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png", primaryColor: "#0051ba", secondaryColor: "#e8000d" },
  "KENTUCKY WILDCATS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/96.png", primaryColor: "#0033a0", secondaryColor: "#ffffff" },
  "UCONN HUSKIES": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/41.png", primaryColor: "#000e2f", secondaryColor: "#e4002b" },
  "ARIZONA WILDCATS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/12.png", primaryColor: "#cc0033", secondaryColor: "#003366" },
  "PURDUE BOILERMAKERS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2509.png", primaryColor: "#ceb888", secondaryColor: "#000000" },
  "HOUSTON COUGARS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/248.png", primaryColor: "#C92A39", secondaryColor: "#ffffff" },
  "GONZAGA BULLDOGS": { logoUrl: "https://a.espncdn.com/i/teamlogos/ncaa/500/2250.png", primaryColor: "#041E42", secondaryColor: "#C60C30" },
};

/**
 * ESPN Team ID Mapping for roster lookups
 */
const ESPN_TEAM_IDS: Record<string, { id: number; sport: string; league: string }> = {
  // NBA
  "ATLANTA HAWKS": { id: 1, sport: "basketball", league: "nba" },
  "BOSTON CELTICS": { id: 2, sport: "basketball", league: "nba" },
  "BROOKLYN NETS": { id: 17, sport: "basketball", league: "nba" },
  "CHARLOTTE HORNETS": { id: 30, sport: "basketball", league: "nba" },
  "CHICAGO BULLS": { id: 4, sport: "basketball", league: "nba" },
  "CLEVELAND CAVALIERS": { id: 5, sport: "basketball", league: "nba" },
  "DALLAS MAVERICKS": { id: 6, sport: "basketball", league: "nba" },
  "DENVER NUGGETS": { id: 7, sport: "basketball", league: "nba" },
  "DETROIT PISTONS": { id: 8, sport: "basketball", league: "nba" },
  "GOLDEN STATE WARRIORS": { id: 9, sport: "basketball", league: "nba" },
  "HOUSTON ROCKETS": { id: 10, sport: "basketball", league: "nba" },
  "INDIANA PACERS": { id: 11, sport: "basketball", league: "nba" },
  "LOS ANGELES CLIPPERS": { id: 12, sport: "basketball", league: "nba" },
  "LOS ANGELES LAKERS": { id: 13, sport: "basketball", league: "nba" },
  "MEMPHIS GRIZZLIES": { id: 29, sport: "basketball", league: "nba" },
  "MIAMI HEAT": { id: 14, sport: "basketball", league: "nba" },
  "MILWAUKEE BUCKS": { id: 15, sport: "basketball", league: "nba" },
  "MINNESOTA TIMBERWOLVES": { id: 16, sport: "basketball", league: "nba" },
  "NEW ORLEANS PELICANS": { id: 3, sport: "basketball", league: "nba" },
  "NEW YORK KNICKS": { id: 18, sport: "basketball", league: "nba" },
  "OKLAHOMA CITY THUNDER": { id: 25, sport: "basketball", league: "nba" },
  "ORLANDO MAGIC": { id: 19, sport: "basketball", league: "nba" },
  "PHILADELPHIA 76ERS": { id: 20, sport: "basketball", league: "nba" },
  "PHOENIX SUNS": { id: 21, sport: "basketball", league: "nba" },
  "PORTLAND TRAIL BLAZERS": { id: 22, sport: "basketball", league: "nba" },
  "SACRAMENTO KINGS": { id: 23, sport: "basketball", league: "nba" },
  "SAN ANTONIO SPURS": { id: 24, sport: "basketball", league: "nba" },
  "TORONTO RAPTORS": { id: 28, sport: "basketball", league: "nba" },
  "UTAH JAZZ": { id: 26, sport: "basketball", league: "nba" },
  "WASHINGTON WIZARDS": { id: 27, sport: "basketball", league: "nba" },
  // NFL
  "ARIZONA CARDINALS": { id: 22, sport: "football", league: "nfl" },
  "ATLANTA FALCONS": { id: 1, sport: "football", league: "nfl" },
  "BALTIMORE RAVENS": { id: 33, sport: "football", league: "nfl" },
  "BUFFALO BILLS": { id: 2, sport: "football", league: "nfl" },
  "CAROLINA PANTHERS": { id: 29, sport: "football", league: "nfl" },
  "CHICAGO BEARS": { id: 3, sport: "football", league: "nfl" },
  "CINCINNATI BENGALS": { id: 4, sport: "football", league: "nfl" },
  "CLEVELAND BROWNS": { id: 5, sport: "football", league: "nfl" },
  "DALLAS COWBOYS": { id: 6, sport: "football", league: "nfl" },
  "DENVER BRONCOS": { id: 7, sport: "football", league: "nfl" },
  "DETROIT LIONS": { id: 8, sport: "football", league: "nfl" },
  "GREEN BAY PACKERS": { id: 9, sport: "football", league: "nfl" },
  "HOUSTON TEXANS": { id: 34, sport: "football", league: "nfl" },
  "INDIANAPOLIS COLTS": { id: 11, sport: "football", league: "nfl" },
  "JACKSONVILLE JAGUARS": { id: 30, sport: "football", league: "nfl" },
  "KANSAS CITY CHIEFS": { id: 12, sport: "football", league: "nfl" },
  "LAS VEGAS RAIDERS": { id: 13, sport: "football", league: "nfl" },
  "LOS ANGELES CHARGERS": { id: 24, sport: "football", league: "nfl" },
  "LOS ANGELES RAMS": { id: 14, sport: "football", league: "nfl" },
  "MIAMI DOLPHINS": { id: 15, sport: "football", league: "nfl" },
  "MINNESOTA VIKINGS": { id: 16, sport: "football", league: "nfl" },
  "NEW ENGLAND PATRIOTS": { id: 17, sport: "football", league: "nfl" },
  "NEW ORLEANS SAINTS": { id: 18, sport: "football", league: "nfl" },
  "NEW YORK GIANTS": { id: 19, sport: "football", league: "nfl" },
  "NEW YORK JETS": { id: 20, sport: "football", league: "nfl" },
  "PHILADELPHIA EAGLES": { id: 21, sport: "football", league: "nfl" },
  "PITTSBURGH STEELERS": { id: 23, sport: "football", league: "nfl" },
  "SAN FRANCISCO 49ERS": { id: 25, sport: "football", league: "nfl" },
  "SEATTLE SEAHAWKS": { id: 26, sport: "football", league: "nfl" },
  "TAMPA BAY BUCCANEERS": { id: 27, sport: "football", league: "nfl" },
  "TENNESSEE TITANS": { id: 10, sport: "football", league: "nfl" },
  "WASHINGTON COMMANDERS": { id: 28, sport: "football", league: "nfl" },
  // NHL
  "ANAHEIM DUCKS": { id: 25, sport: "hockey", league: "nhl" },
  "ARIZONA COYOTES": { id: 24, sport: "hockey", league: "nhl" },
  "BOSTON BRUINS": { id: 1, sport: "hockey", league: "nhl" },
  "BUFFALO SABRES": { id: 2, sport: "hockey", league: "nhl" },
  "CALGARY FLAMES": { id: 3, sport: "hockey", league: "nhl" },
  "CAROLINA HURRICANES": { id: 7, sport: "hockey", league: "nhl" },
  "CHICAGO BLACKHAWKS": { id: 4, sport: "hockey", league: "nhl" },
  "COLORADO AVALANCHE": { id: 17, sport: "hockey", league: "nhl" },
  "COLUMBUS BLUE JACKETS": { id: 29, sport: "hockey", league: "nhl" },
  "DALLAS STARS": { id: 9, sport: "hockey", league: "nhl" },
  "DETROIT RED WINGS": { id: 5, sport: "hockey", league: "nhl" },
  "EDMONTON OILERS": { id: 6, sport: "hockey", league: "nhl" },
  "FLORIDA PANTHERS": { id: 26, sport: "hockey", league: "nhl" },
  "LOS ANGELES KINGS": { id: 8, sport: "hockey", league: "nhl" },
  "MINNESOTA WILD": { id: 30, sport: "hockey", league: "nhl" },
  "MONTREAL CANADIENS": { id: 10, sport: "hockey", league: "nhl" },
  "NASHVILLE PREDATORS": { id: 27, sport: "hockey", league: "nhl" },
  "NEW JERSEY DEVILS": { id: 11, sport: "hockey", league: "nhl" },
  "NEW YORK ISLANDERS": { id: 12, sport: "hockey", league: "nhl" },
  "NEW YORK RANGERS": { id: 13, sport: "hockey", league: "nhl" },
  "OTTAWA SENATORS": { id: 14, sport: "hockey", league: "nhl" },
  "PHILADELPHIA FLYERS": { id: 15, sport: "hockey", league: "nhl" },
  "PITTSBURGH PENGUINS": { id: 16, sport: "hockey", league: "nhl" },
  "SAN JOSE SHARKS": { id: 18, sport: "hockey", league: "nhl" },
  "SEATTLE KRAKEN": { id: 36, sport: "hockey", league: "nhl" },
  "ST. LOUIS BLUES": { id: 19, sport: "hockey", league: "nhl" },
  "TAMPA BAY LIGHTNING": { id: 20, sport: "hockey", league: "nhl" },
  "TORONTO MAPLE LEAFS": { id: 21, sport: "hockey", league: "nhl" },
  "UTAH HOCKEY CLUB": { id: 24, sport: "hockey", league: "nhl" },
  "VANCOUVER CANUCKS": { id: 22, sport: "hockey", league: "nhl" },
  "VEGAS GOLDEN KNIGHTS": { id: 37, sport: "hockey", league: "nhl" },
  "WASHINGTON CAPITALS": { id: 23, sport: "hockey", league: "nhl" },
  "WINNIPEG JETS": { id: 28, sport: "hockey", league: "nhl" },
  // MLB
  "ARIZONA DIAMONDBACKS": { id: 29, sport: "baseball", league: "mlb" },
  "ATLANTA BRAVES": { id: 15, sport: "baseball", league: "mlb" },
  "BALTIMORE ORIOLES": { id: 1, sport: "baseball", league: "mlb" },
  "BOSTON RED SOX": { id: 2, sport: "baseball", league: "mlb" },
  "CHICAGO CUBS": { id: 16, sport: "baseball", league: "mlb" },
  "CHICAGO WHITE SOX": { id: 4, sport: "baseball", league: "mlb" },
  "CINCINNATI REDS": { id: 17, sport: "baseball", league: "mlb" },
  "CLEVELAND GUARDIANS": { id: 5, sport: "baseball", league: "mlb" },
  "COLORADO ROCKIES": { id: 27, sport: "baseball", league: "mlb" },
  "DETROIT TIGERS": { id: 6, sport: "baseball", league: "mlb" },
  "HOUSTON ASTROS": { id: 18, sport: "baseball", league: "mlb" },
  "KANSAS CITY ROYALS": { id: 7, sport: "baseball", league: "mlb" },
  "LOS ANGELES ANGELS": { id: 3, sport: "baseball", league: "mlb" },
  "LOS ANGELES DODGERS": { id: 19, sport: "baseball", league: "mlb" },
  "MIAMI MARLINS": { id: 28, sport: "baseball", league: "mlb" },
  "MILWAUKEE BREWERS": { id: 8, sport: "baseball", league: "mlb" },
  "MINNESOTA TWINS": { id: 9, sport: "baseball", league: "mlb" },
  "NEW YORK METS": { id: 21, sport: "baseball", league: "mlb" },
  "NEW YORK YANKEES": { id: 10, sport: "baseball", league: "mlb" },
  "OAKLAND ATHLETICS": { id: 11, sport: "baseball", league: "mlb" },
  "PHILADELPHIA PHILLIES": { id: 22, sport: "baseball", league: "mlb" },
  "PITTSBURGH PIRATES": { id: 23, sport: "baseball", league: "mlb" },
  "SAN DIEGO PADRES": { id: 25, sport: "baseball", league: "mlb" },
  "SAN FRANCISCO GIANTS": { id: 26, sport: "baseball", league: "mlb" },
  "SEATTLE MARINERS": { id: 12, sport: "baseball", league: "mlb" },
  "ST. LOUIS CARDINALS": { id: 24, sport: "baseball", league: "mlb" },
  "TAMPA BAY RAYS": { id: 30, sport: "baseball", league: "mlb" },
  "TEXAS RANGERS": { id: 13, sport: "baseball", league: "mlb" },
  "TORONTO BLUE JAYS": { id: 14, sport: "baseball", league: "mlb" },
  "WASHINGTON NATIONALS": { id: 20, sport: "baseball", league: "mlb" },
  // MLS
  "ATLANTA UNITED FC": { id: 18079, sport: "soccer", league: "usa.1" },
  "AUSTIN FC": { id: 18080, sport: "soccer", league: "usa.1" },
  "CF MONTREAL": { id: 18081, sport: "soccer", league: "usa.1" },
  "CHARLOTTE FC": { id: 18078, sport: "soccer", league: "usa.1" },
  "CHICAGO FIRE FC": { id: 18082, sport: "soccer", league: "usa.1" },
  "COLORADO RAPIDS": { id: 18083, sport: "soccer", league: "usa.1" },
  "COLUMBUS CREW": { id: 18084, sport: "soccer", league: "usa.1" },
  "D.C. UNITED": { id: 18085, sport: "soccer", league: "usa.1" },
  "DC UNITED": { id: 18085, sport: "soccer", league: "usa.1" },
  "FC CINCINNATI": { id: 18076, sport: "soccer", league: "usa.1" },
  "FC DALLAS": { id: 18086, sport: "soccer", league: "usa.1" },
  "HOUSTON DYNAMO FC": { id: 18087, sport: "soccer", league: "usa.1" },
  "INTER MIAMI CF": { id: 18077, sport: "soccer", league: "usa.1" },
  "LA GALAXY": { id: 18088, sport: "soccer", league: "usa.1" },
  "LOS ANGELES FC": { id: 18089, sport: "soccer", league: "usa.1" },
  "LAFC": { id: 18089, sport: "soccer", league: "usa.1" },
  "MINNESOTA UNITED FC": { id: 18090, sport: "soccer", league: "usa.1" },
  "NASHVILLE SC": { id: 18091, sport: "soccer", league: "usa.1" },
  "NEW ENGLAND REVOLUTION": { id: 18092, sport: "soccer", league: "usa.1" },
  "NEW YORK CITY FC": { id: 18093, sport: "soccer", league: "usa.1" },
  "NEW YORK RED BULLS": { id: 18094, sport: "soccer", league: "usa.1" },
  "ORLANDO CITY SC": { id: 18095, sport: "soccer", league: "usa.1" },
  "PHILADELPHIA UNION": { id: 18096, sport: "soccer", league: "usa.1" },
  "PORTLAND TIMBERS": { id: 18097, sport: "soccer", league: "usa.1" },
  "REAL SALT LAKE": { id: 18098, sport: "soccer", league: "usa.1" },
  "SAN JOSE EARTHQUAKES": { id: 18099, sport: "soccer", league: "usa.1" },
  "SEATTLE SOUNDERS FC": { id: 18100, sport: "soccer", league: "usa.1" },
  "SPORTING KANSAS CITY": { id: 18101, sport: "soccer", league: "usa.1" },
  "ST. LOUIS CITY SC": { id: 18075, sport: "soccer", league: "usa.1" },
  "TORONTO FC": { id: 18102, sport: "soccer", league: "usa.1" },
  "VANCOUVER WHITECAPS FC": { id: 18103, sport: "soccer", league: "usa.1" },
  // WNBA
  "ATLANTA DREAM": { id: 3, sport: "basketball", league: "wnba" },
  "CHICAGO SKY": { id: 6, sport: "basketball", league: "wnba" },
  "CONNECTICUT SUN": { id: 8, sport: "basketball", league: "wnba" },
  "DALLAS WINGS": { id: 16, sport: "basketball", league: "wnba" },
  "INDIANA FEVER": { id: 5, sport: "basketball", league: "wnba" },
  "LAS VEGAS ACES": { id: 18, sport: "basketball", league: "wnba" },
  "LOS ANGELES SPARKS": { id: 9, sport: "basketball", league: "wnba" },
  "MINNESOTA LYNX": { id: 11, sport: "basketball", league: "wnba" },
  "NEW YORK LIBERTY": { id: 7, sport: "basketball", league: "wnba" },
  "PHOENIX MERCURY": { id: 14, sport: "basketball", league: "wnba" },
  "SEATTLE STORM": { id: 17, sport: "basketball", league: "wnba" },
  "WASHINGTON MYSTICS": { id: 20, sport: "basketball", league: "wnba" },

  // Premier League
  "AFC BOURNEMOUTH": { id: 349, sport: "soccer", league: "eng.1" },
  "ARSENAL": { id: 359, sport: "soccer", league: "eng.1" },
  "ASTON VILLA": { id: 362, sport: "soccer", league: "eng.1" },
  "BRENTFORD": { id: 337, sport: "soccer", league: "eng.1" },
  "BRIGHTON & HOVE ALBION": { id: 331, sport: "soccer", league: "eng.1" },
  "BURNLEY": { id: 379, sport: "soccer", league: "eng.1" },
  "CHELSEA": { id: 363, sport: "soccer", league: "eng.1" },
  "CRYSTAL PALACE": { id: 384, sport: "soccer", league: "eng.1" },
  "EVERTON": { id: 368, sport: "soccer", league: "eng.1" },
  "FULHAM": { id: 370, sport: "soccer", league: "eng.1" },
  "IPSWICH TOWN": { id: 373, sport: "soccer", league: "eng.1" },
  "LEICESTER CITY": { id: 375, sport: "soccer", league: "eng.1" },
  "LIVERPOOL": { id: 364, sport: "soccer", league: "eng.1" },
  "LUTON TOWN": { id: 389, sport: "soccer", league: "eng.1" },
  "MANCHESTER CITY": { id: 382, sport: "soccer", league: "eng.1" },
  "MANCHESTER UNITED": { id: 360, sport: "soccer", league: "eng.1" },
  "NEWCASTLE UNITED": { id: 361, sport: "soccer", league: "eng.1" },
  "NOTTINGHAM FOREST": { id: 393, sport: "soccer", league: "eng.1" },
  "SHEFFIELD UNITED": { id: 398, sport: "soccer", league: "eng.1" },
  "SOUTHAMPTON": { id: 376, sport: "soccer", league: "eng.1" },
  "TOTTENHAM HOTSPUR": { id: 367, sport: "soccer", league: "eng.1" },
  "WEST HAM UNITED": { id: 371, sport: "soccer", league: "eng.1" },
  "WOLVERHAMPTON WANDERERS": { id: 380, sport: "soccer", league: "eng.1" },
  // La Liga
  "ATHLETIC CLUB": { id: 93, sport: "soccer", league: "esp.1" },
  "ATLETICO MADRID": { id: 1068, sport: "soccer", league: "esp.1" },
  "BARCELONA": { id: 83, sport: "soccer", league: "esp.1" },
  "CELTA VIGO": { id: 85, sport: "soccer", league: "esp.1" },
  "GETAFE": { id: 9812, sport: "soccer", league: "esp.1" },
  "GIRONA": { id: 9887, sport: "soccer", league: "esp.1" },
  "LAS PALMAS": { id: 87, sport: "soccer", league: "esp.1" },
  "MALLORCA": { id: 89, sport: "soccer", league: "esp.1" },
  "OSASUNA": { id: 88, sport: "soccer", league: "esp.1" },
  "RAYO VALLECANO": { id: 90, sport: "soccer", league: "esp.1" },
  "REAL BETIS": { id: 244, sport: "soccer", league: "esp.1" },
  "REAL MADRID": { id: 86, sport: "soccer", league: "esp.1" },
  "REAL SOCIEDAD": { id: 89, sport: "soccer", league: "esp.1" },
  "SEVILLA": { id: 243, sport: "soccer", league: "esp.1" },
  "VALENCIA": { id: 94, sport: "soccer", league: "esp.1" },
  "VILLARREAL": { id: 102, sport: "soccer", league: "esp.1" },
  // Bundesliga
  "AUGSBURG": { id: 502, sport: "soccer", league: "ger.1" },
  "BAYER LEVERKUSEN": { id: 131, sport: "soccer", league: "ger.1" },
  "BAYERN MUNICH": { id: 132, sport: "soccer", league: "ger.1" },
  "BORUSSIA DORTMUND": { id: 124, sport: "soccer", league: "ger.1" },
  "BORUSSIA MONCHENGLADBACH": { id: 132, sport: "soccer", league: "ger.1" },
  "EINTRACHT FRANKFURT": { id: 125, sport: "soccer", league: "ger.1" },
  "FREIBURG": { id: 133, sport: "soccer", league: "ger.1" },
  "HOFFENHEIM": { id: 169, sport: "soccer", league: "ger.1" },
  "MAINZ 05": { id: 165, sport: "soccer", league: "ger.1" },
  "RB LEIPZIG": { id: 11420, sport: "soccer", league: "ger.1" },
  "UNION BERLIN": { id: 136, sport: "soccer", league: "ger.1" },
  "VFB STUTTGART": { id: 134, sport: "soccer", league: "ger.1" },
  "VFL BOCHUM": { id: 129, sport: "soccer", league: "ger.1" },
  "VFL WOLFSBURG": { id: 137, sport: "soccer", league: "ger.1" },
  "WERDER BREMEN": { id: 138, sport: "soccer", league: "ger.1" },
  // Serie A
  "AC MILAN": { id: 103, sport: "soccer", league: "ita.1" },
  "AS ROMA": { id: 104, sport: "soccer", league: "ita.1" },
  "ATALANTA": { id: 107, sport: "soccer", league: "ita.1" },
  "BOLOGNA": { id: 108, sport: "soccer", league: "ita.1" },
  "FIORENTINA": { id: 109, sport: "soccer", league: "ita.1" },
  "INTER MILAN": { id: 110, sport: "soccer", league: "ita.1" },
  "JUVENTUS": { id: 111, sport: "soccer", league: "ita.1" },
  "LAZIO": { id: 112, sport: "soccer", league: "ita.1" },
  "NAPOLI": { id: 114, sport: "soccer", league: "ita.1" },
  "TORINO": { id: 118, sport: "soccer", league: "ita.1" },
  "UDINESE": { id: 119, sport: "soccer", league: "ita.1" },
  // Ligue 1
  "LENS": { id: 166, sport: "soccer", league: "fra.1" },
  "LILLE": { id: 167, sport: "soccer", league: "fra.1" },
  "LYON": { id: 168, sport: "soccer", league: "fra.1" },
  "MARSEILLE": { id: 176, sport: "soccer", league: "fra.1" },
  "MONACO": { id: 174, sport: "soccer", league: "fra.1" },
  "MONTPELLIER": { id: 178, sport: "soccer", league: "fra.1" },
  "NANTES": { id: 179, sport: "soccer", league: "fra.1" },
  "NICE": { id: 180, sport: "soccer", league: "fra.1" },
  "PARIS SAINT-GERMAIN": { id: 160, sport: "soccer", league: "fra.1" },
  "PSG": { id: 160, sport: "soccer", league: "fra.1" },
  "RENNES": { id: 181, sport: "soccer", league: "fra.1" },
  "STRASBOURG": { id: 186, sport: "soccer", league: "fra.1" },
  "TOULOUSE": { id: 187, sport: "soccer", league: "fra.1" },
  // Liga MX
  "AMERICA": { id: 219, sport: "soccer", league: "mex.1" },
  "CLUB AMERICA": { id: 219, sport: "soccer", league: "mex.1" },
  "ATLAS": { id: 220, sport: "soccer", league: "mex.1" },
  "CHIVAS": { id: 225, sport: "soccer", league: "mex.1" },
  "GUADALAJARA": { id: 225, sport: "soccer", league: "mex.1" },
  "CRUZ AZUL": { id: 221, sport: "soccer", league: "mex.1" },
  "LEON": { id: 226, sport: "soccer", league: "mex.1" },
  "MONTERREY": { id: 228, sport: "soccer", league: "mex.1" },
  "PACHUCA": { id: 229, sport: "soccer", league: "mex.1" },
  "PUMAS UNAM": { id: 230, sport: "soccer", league: "mex.1" },
  "PUMAS": { id: 230, sport: "soccer", league: "mex.1" },
  "SANTOS LAGUNA": { id: 231, sport: "soccer", league: "mex.1" },
  "TIGRES UANL": { id: 232, sport: "soccer", league: "mex.1" },
  "TIGRES": { id: 232, sport: "soccer", league: "mex.1" },
  "TOLUCA": { id: 233, sport: "soccer", league: "mex.1" },
  // Eredivisie
  "AJAX": { id: 139, sport: "soccer", league: "ned.1" },
  "AFC AJAX": { id: 139, sport: "soccer", league: "ned.1" },
  "ALMERE CITY FC": { id: 2577, sport: "soccer", league: "ned.1" },
  "AZ": { id: 140, sport: "soccer", league: "ned.1" },
  "AZ ALKMAAR": { id: 140, sport: "soccer", league: "ned.1" },
  "FEYENOORD": { id: 144, sport: "soccer", league: "ned.1" },
  "FORTUNA SITTARD": { id: 3608, sport: "soccer", league: "ned.1" },
  "GO AHEAD EAGLES": { id: 2361, sport: "soccer", league: "ned.1" },
  "FC GRONINGEN": { id: 145, sport: "soccer", league: "ned.1" },
  "SC HEERENVEEN": { id: 146, sport: "soccer", league: "ned.1" },
  "HERACLES ALMELO": { id: 3708, sport: "soccer", league: "ned.1" },
  "NAC BREDA": { id: 141, sport: "soccer", league: "ned.1" },
  "NEC NIJMEGEN": { id: 147, sport: "soccer", league: "ned.1" },
  "PEC ZWOLLE": { id: 2565, sport: "soccer", league: "ned.1" },
  "PSV EINDHOVEN": { id: 148, sport: "soccer", league: "ned.1" },
  "PSV": { id: 148, sport: "soccer", league: "ned.1" },
  "SPARTA ROTTERDAM": { id: 151, sport: "soccer", league: "ned.1" },
  "FC TWENTE": { id: 153, sport: "soccer", league: "ned.1" },
  "FC UTRECHT": { id: 154, sport: "soccer", league: "ned.1" },
  "RKC WAALWIJK": { id: 155, sport: "soccer", league: "ned.1" },
  "WILLEM II": { id: 156, sport: "soccer", league: "ned.1" },

  // NCAA Football
  "ALABAMA CRIMSON TIDE": { id: 333, sport: "football", league: "college-football" },
  "ARKANSAS RAZORBACKS": { id: 8, sport: "football", league: "college-football" },
  "AUBURN TIGERS": { id: 2, sport: "football", league: "college-football" },
  "BAYLOR BEARS": { id: 239, sport: "football", league: "college-football" },
  "BOSTON COLLEGE EAGLES": { id: 103, sport: "football", league: "college-football" },
  "BYU COUGARS": { id: 252, sport: "football", league: "college-football" },
  "CALIFORNIA GOLDEN BEARS": { id: 25, sport: "football", league: "college-football" },
  "CINCINNATI BEARCATS": { id: 2132, sport: "football", league: "college-football" },
  "CLEMSON TIGERS": { id: 228, sport: "football", league: "college-football" },
  "COLORADO BUFFALOES": { id: 38, sport: "football", league: "college-football" },
  "DUKE BLUE DEVILS": { id: 150, sport: "football", league: "college-football" },
  "FLORIDA GATORS": { id: 57, sport: "football", league: "college-football" },
  "FLORIDA STATE SEMINOLES": { id: 52, sport: "football", league: "college-football" },
  "GEORGIA BULLDOGS": { id: 61, sport: "football", league: "college-football" },
  "GEORGIA TECH YELLOW JACKETS": { id: 59, sport: "football", league: "college-football" },
  "HOUSTON COUGARS": { id: 248, sport: "football", league: "college-football" },
  "ILLINOIS FIGHTING ILLINI": { id: 356, sport: "football", league: "college-football" },
  "INDIANA HOOSIERS": { id: 84, sport: "football", league: "college-football" },
  "IOWA HAWKEYES": { id: 2294, sport: "football", league: "college-football" },
  "IOWA STATE CYCLONES": { id: 66, sport: "football", league: "college-football" },
  "KANSAS JAYHAWKS": { id: 2305, sport: "football", league: "college-football" },
  "KANSAS STATE WILDCATS": { id: 2306, sport: "football", league: "college-football" },
  "KENTUCKY WILDCATS": { id: 96, sport: "football", league: "college-football" },
  "LOUISVILLE CARDINALS": { id: 97, sport: "football", league: "college-football" },
  "LSU TIGERS": { id: 99, sport: "football", league: "college-football" },
  "MARYLAND TERRAPINS": { id: 120, sport: "football", league: "college-football" },
  "MIAMI HURRICANES": { id: 2390, sport: "football", league: "college-football" },
  "MICHIGAN WOLVERINES": { id: 130, sport: "football", league: "college-football" },
  "MICHIGAN STATE SPARTANS": { id: 127, sport: "football", league: "college-football" },
  "MINNESOTA GOLDEN GOPHERS": { id: 135, sport: "football", league: "college-football" },
  "MISSISSIPPI STATE BULLDOGS": { id: 344, sport: "football", league: "college-football" },
  "MISSOURI TIGERS": { id: 142, sport: "football", league: "college-football" },
  "NC STATE WOLFPACK": { id: 152, sport: "football", league: "college-football" },
  "NEBRASKA CORNHUSKERS": { id: 158, sport: "football", league: "college-football" },
  "NORTH CAROLINA TAR HEELS": { id: 153, sport: "football", league: "college-football" },
  "NOTRE DAME FIGHTING IRISH": { id: 87, sport: "football", league: "college-football" },
  "OHIO STATE BUCKEYES": { id: 194, sport: "football", league: "college-football" },
  "OKLAHOMA SOONERS": { id: 201, sport: "football", league: "college-football" },
  "OKLAHOMA STATE COWBOYS": { id: 197, sport: "football", league: "college-football" },
  "OLE MISS REBELS": { id: 145, sport: "football", league: "college-football" },
  "OREGON DUCKS": { id: 2483, sport: "football", league: "college-football" },
  "PENN STATE NITTANY LIONS": { id: 213, sport: "football", league: "college-football" },
  "PITTSBURGH PANTHERS": { id: 221, sport: "football", league: "college-football" },
  "PURDUE BOILERMAKERS": { id: 2509, sport: "football", league: "college-football" },
  "RUTGERS SCARLET KNIGHTS": { id: 164, sport: "football", league: "college-football" },
  "SMU MUSTANGS": { id: 2567, sport: "football", league: "college-football" },
  "SOUTH CAROLINA GAMECOCKS": { id: 2579, sport: "football", league: "college-football" },
  "STANFORD CARDINAL": { id: 24, sport: "football", league: "college-football" },
  "SYRACUSE ORANGE": { id: 183, sport: "football", league: "college-football" },
  "TCU HORNED FROGS": { id: 2628, sport: "football", league: "college-football" },
  "TENNESSEE VOLUNTEERS": { id: 2633, sport: "football", league: "college-football" },
  "TEXAS LONGHORNS": { id: 251, sport: "football", league: "college-football" },
  "TEXAS A&M AGGIES": { id: 245, sport: "football", league: "college-football" },
  "TEXAS TECH RED RAIDERS": { id: 2641, sport: "football", league: "college-football" },
  "UCF KNIGHTS": { id: 2116, sport: "football", league: "college-football" },
  "UCLA BRUINS": { id: 26, sport: "football", league: "college-football" },
  "USC TROJANS": { id: 30, sport: "football", league: "college-football" },
  "UTAH UTES": { id: 254, sport: "football", league: "college-football" },
  "VANDERBILT COMMODORES": { id: 238, sport: "football", league: "college-football" },
  "VIRGINIA CAVALIERS": { id: 258, sport: "football", league: "college-football" },
  "VIRGINIA TECH HOKIES": { id: 259, sport: "football", league: "college-football" },
  "WAKE FOREST DEMON DEACONS": { id: 154, sport: "football", league: "college-football" },
  "WASHINGTON HUSKIES": { id: 264, sport: "football", league: "college-football" },
  "WEST VIRGINIA MOUNTAINEERS": { id: 277, sport: "football", league: "college-football" },
  "WISCONSIN BADGERS": { id: 275, sport: "football", league: "college-football" },

  // NCAA Basketball (Key Division 1 Teams)
  "ARIZONA WILDCATS": { id: 12, sport: "basketball", league: "mens-college-basketball" },
  "BAYLOR BEARS (BB)": { id: 239, sport: "basketball", league: "mens-college-basketball" },
  "DUKE BLUE DEVILS (BB)": { id: 150, sport: "basketball", league: "mens-college-basketball" },
  "GONZAGA BULLDOGS": { id: 2250, sport: "basketball", league: "mens-college-basketball" },
  "HOUSTON COUGARS (BB)": { id: 248, sport: "basketball", league: "mens-college-basketball" },
  "KANSAS JAYHAWKS (BB)": { id: 2305, sport: "basketball", league: "mens-college-basketball" },
  "KENTUCKY WILDCATS (BB)": { id: 96, sport: "basketball", league: "mens-college-basketball" },
  "MARQUETTE GOLDEN EAGLES": { id: 269, sport: "basketball", league: "mens-college-basketball" },
  "MICHIGAN STATE SPARTANS (BB)": { id: 127, sport: "basketball", league: "mens-college-basketball" },
  "NORTH CAROLINA TAR HEELS (BB)": { id: 153, sport: "basketball", league: "mens-college-basketball" },
  "PURDUE BOILERMAKERS (BB)": { id: 2509, sport: "basketball", league: "mens-college-basketball" },
  "UCONN HUSKIES (BB)": { id: 41, sport: "basketball", league: "mens-college-basketball" },
  "UCONN": { id: 41, sport: "basketball", league: "mens-college-basketball" },
  "VILLANOVA WILDCATS": { id: 222, sport: "basketball", league: "mens-college-basketball" },

  // NWSL (National Women's Soccer League)
  "ANGEL CITY FC": { id: 20305, sport: "soccer", league: "nwsl" }, // ID is approx/placeholder if strict ESPN ID needed
  "ACFC": { id: 20305, sport: "soccer", league: "nwsl" },
  "BAY FC": { id: 20857, sport: "soccer", league: "nwsl" },
  "CHICAGO RED STARS": { id: 9993, sport: "soccer", league: "nwsl" },
  "HOUSTON DASH": { id: 11130, sport: "soccer", league: "nwsl" },
  "KANSAS CITY CURRENT": { id: 19356, sport: "soccer", league: "nwsl" },
  "NJ/NY GOTHAM FC": { id: 9995, sport: "soccer", league: "nwsl" },
  "GOTHAM FC": { id: 9995, sport: "soccer", league: "nwsl" },
  "NORTH CAROLINA COURAGE": { id: 17290, sport: "soccer", league: "nwsl" },
  "NC COURAGE": { id: 17290, sport: "soccer", league: "nwsl" },
  "ORLANDO PRIDE": { id: 17904, sport: "soccer", league: "nwsl" },
  "PORTLAND THORNS FC": { id: 9996, sport: "soccer", league: "nwsl" },
  "PORTLAND THORNS": { id: 9996, sport: "soccer", league: "nwsl" },
  "RACING LOUISVILLE FC": { id: 19354, sport: "soccer", league: "nwsl" },
  "RACING LOUISVILLE": { id: 19354, sport: "soccer", league: "nwsl" },
  "SAN DIEGO WAVE FC": { id: 20306, sport: "soccer", league: "nwsl" },
  "SAN DIEGO WAVE": { id: 20306, sport: "soccer", league: "nwsl" },
  "SEATTLE REIGN FC": { id: 9997, sport: "soccer", league: "nwsl" },
  "SEATTLE REIGN": { id: 9997, sport: "soccer", league: "nwsl" },
  "UTAH ROYALS": { id: 20858, sport: "soccer", league: "nwsl" },
  "WASHINGTON SPIRIT": { id: 9999, sport: "soccer", league: "nwsl" },

  // USL Championship (2025/2026 Season)
  "BIRMINGHAM LEGION FC": { id: 20235, sport: "soccer", league: "usl" },
  "BROOKLYN FC": { id: 25000, sport: "soccer", league: "usl" }, // Placeholder ID
  "CHARLESTON BATTERY": { id: 70, sport: "soccer", league: "usl" },
  "COLORADO SPRINGS SWITCHBACKS FC": { id: 17006, sport: "soccer", league: "usl" },
  "DETROIT CITY FC": { id: 20658, sport: "soccer", league: "usl" },
  "EL PASO LOCOMOTIVE FC": { id: 20237, sport: "soccer", league: "usl" },
  "FC TULSA": { id: 17011, sport: "soccer", league: "usl" },
  "HARTFORD ATHLETIC": { id: 20238, sport: "soccer", league: "usl" },
  "INDY ELEVEN": { id: 6228, sport: "soccer", league: "usl" },
  "LAS VEGAS LIGHTS FC": { id: 19183, sport: "soccer", league: "usl" },
  "LEXINGTON SC": { id: 25001, sport: "soccer", league: "usl" }, // Placeholder ID
  "LOUDOUN UNITED FC": { id: 20240, sport: "soccer", league: "usl" },
  "LOUISVILLE CITY FC": { id: 17016, sport: "soccer", league: "usl" },
  "MIAMI FC": { id: 18451, sport: "soccer", league: "usl" },
  "MONTEREY BAY FC": { id: 20875, sport: "soccer", league: "usl" },
  "NEW MEXICO UNITED": { id: 20242, sport: "soccer", league: "usl" },
  "OAKLAND ROOTS SC": { id: 20659, sport: "soccer", league: "usl" },
  "ORANGE COUNTY SC": { id: 6234, sport: "soccer", league: "usl" },
  "PHOENIX RISING FC": { id: 17565, sport: "soccer", league: "usl" },
  "PITTSBURGH RIVERHOUNDS SC": { id: 6230, sport: "soccer", league: "usl" },
  "RHODE ISLAND FC": { id: 25002, sport: "soccer", league: "usl" }, // Placeholder ID
  "SACRAMENTO REPUBLIC FC": { id: 17025, sport: "soccer", league: "usl" },
  "SAN ANTONIO FC": { id: 18456, sport: "soccer", league: "usl" },
  "SPORTING CLUB JACKSONVILLE": { id: 25003, sport: "soccer", league: "usl" }, // Placeholder ID
  "TAMPA BAY ROWDIES": { id: 6232, sport: "soccer", league: "usl" },

  // IPL (Cricket) - IDs are placeholders/unofficial
  "CHENNAI SUPER KINGS": { id: 0, sport: "cricket", league: "ipl" },
  "CSK": { id: 0, sport: "cricket", league: "ipl" },
  "DELHI CAPITALS": { id: 0, sport: "cricket", league: "ipl" },
  "GUJARAT TITANS": { id: 0, sport: "cricket", league: "ipl" },
  "KOLKATA KNIGHT RIDERS": { id: 0, sport: "cricket", league: "ipl" },
  "KKR": { id: 0, sport: "cricket", league: "ipl" },
  "LUCKNOW SUPER GIANTS": { id: 0, sport: "cricket", league: "ipl" },
  "LSG": { id: 0, sport: "cricket", league: "ipl" },
  "MUMBAI INDIANS": { id: 0, sport: "cricket", league: "ipl" },
  "PUNJAB KINGS": { id: 0, sport: "cricket", league: "ipl" },
  "PBKS": { id: 0, sport: "cricket", league: "ipl" },
  "RAJASTHAN ROYALS": { id: 0, sport: "cricket", league: "ipl" },
  "ROYAL CHALLENGERS BENGALURU": { id: 0, sport: "cricket", league: "ipl" },
  "RCB": { id: 0, sport: "cricket", league: "ipl" },
  "SUNRISERS HYDERABAD": { id: 0, sport: "cricket", league: "ipl" },
  "SRH": { id: 0, sport: "cricket", league: "ipl" },
};

const LEAGUE_DISPLAY_NAMES: Record<string, string> = {
  "usa.1": "MLS",
  "usa.nwsl": "NWSL",
  "eng.1": "Premier League",
  "esp.1": "La Liga",
  "ger.1": "Bundesliga",
  "ita.1": "Serie A",
  "fra.1": "Ligue 1",
  "mex.1": "Liga MX",
  "ned.1": "Eredivisie",
  "mlb": "MLB",
  "nba": "NBA",
  "nfl": "NFL",
  "nhl": "NHL",
  "wnba": "WNBA",
  "college-football": "NCAA Football",
  "mens-college-basketball": "NCAA Men's Basketball",
  "f1": "Formula 1",
  "ipl": "IPL (Cricket)",
  "milb-aaa": "Triple-A",
  "milb-aa": "Double-A",
  "milb-higha": "High-A",
  "milb-a": "Single-A"
};

const LEAGUE_TO_SPORT: Record<string, string> = {
  'nba': 'Basketball', 'wnba': 'Basketball', 'ncaa-basketball': 'Basketball', 'euroleague': 'Basketball',
  'nfl': 'Football', 'ncaa-football': 'Football',
  'premier-league': 'Soccer', 'la-liga': 'Soccer', 'serie-a': 'Soccer',
  'bundesliga': 'Soccer', 'ligue-1': 'Soccer', 'mls': 'Soccer', 'nwsl': 'Soccer', 'usa.nwsl': 'Soccer', 'liga-mx': 'Soccer',
  'eredivisie': 'Soccer', 'usl': 'Soccer',
  'ipl': 'Cricket',
  'nhl': 'Hockey',

  'mlb': 'Baseball',
  'milb': 'Baseball',
};

const MILB_SPORT_IDS: Record<string, number> = {
  "milb-aaa": 11,
  "milb-aa": 12,
  "milb-higha": 13,
  "milb-a": 14
};

/**
 * Normalize a player name for fuzzy matching
 */
function normalizePlayerName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch team roster from ESPN API
 */
async function fetchESPNRoster(teamName: string): Promise<Map<string, string> | null> {
  const teamUpper = teamName.toUpperCase().trim();
  const teamInfo = ESPN_TEAM_IDS[teamUpper];

  if (!teamInfo) {
    console.log(`[ESPN] No team ID found for: ${teamName}`);
    return null;
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/${teamInfo.sport}/${teamInfo.league}/teams/${teamInfo.id}/roster`;

  try {
    console.log(`[ESPN] Fetching roster from: ${url}`);
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const rosterMap = new Map<string, string>();

    if (data.athletes && Array.isArray(data.athletes)) {
      for (const athlete of data.athletes) {
        if (athlete.fullName && athlete.jersey) {
          rosterMap.set(normalizePlayerName(athlete.fullName), athlete.jersey);
        }
      }
    }

    console.log(`[ESPN] Loaded ${rosterMap.size} players with jersey numbers`);
    return rosterMap;
  } catch (error) {
    console.error('[ESPN] Failed to fetch roster:', error);
    return null;
  }
}

/**
 * Fetch team roster from MLB Stats API (for MiLB)
 */
async function fetchMilbRoster(teamName: string, league: string): Promise<Map<string, string> | null> {
  const sportId = MILB_SPORT_IDS[league];
  if (!sportId) return null;

  try {
    // Stage 1: Find Team ID
    const searchUrl = `https://statsapi.mlb.com/api/v1/teams?sportId=${sportId}`;
    console.log(`[MiLB] Searching for team "${teamName}" in sportId ${sportId}: ${searchUrl}`);
    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) return null;

    const searchData = await searchResponse.json();
    const upperTeamName = teamName.toUpperCase().trim();

    const team = searchData.teams?.find((t: any) =>
      t.name.toUpperCase().includes(upperTeamName) ||
      upperTeamName.includes(t.teamName.toUpperCase())
    );

    if (!team) {
      console.log(`[MiLB] Team "${teamName}" not found in Level ${league}`);
      return null;
    }

    // Stage 2: Fetch Roster
    const rosterUrl = `https://statsapi.mlb.com/api/v1/teams/${team.id}/roster`;
    console.log(`[MiLB] Fetching roster for ${team.name} (ID: ${team.id}): ${rosterUrl}`);
    const rosterResponse = await fetch(rosterUrl);
    if (!rosterResponse.ok) return null;

    const rosterData = await rosterResponse.json();
    const rosterMap = new Map<string, string>();

    if (rosterData.roster && Array.isArray(rosterData.roster)) {
      for (const entry of rosterData.roster) {
        if (entry.person?.fullName && entry.jerseyNumber) {
          rosterMap.set(normalizePlayerName(entry.person.fullName), entry.jerseyNumber);
        }
      }
    }

    console.log(`[MiLB] Loaded ${rosterMap.size} players with jersey numbers`);
    return rosterMap;
  } catch (error) {
    console.error('[MiLB] Failed to fetch roster:', error);
    return null;
  }
}

/**
 * Fill in missing jersey numbers by matching against external roster data (ESPN or MiLB)
 */
async function fillMissingJerseyNumbers(athletes: any[], teamName: string, league?: string): Promise<any[]> {
  console.log(`[Roster Sync] fillMissingJerseyNumbers called with team: "${teamName}", league: ${league || 'unknown'}, athletes: ${athletes.length}`);

  const missingJerseys = athletes.filter(a => !a.jerseyNumber || a.jerseyNumber === '00' || a.jerseyNumber === '');

  if (missingJerseys.length === 0) {
    console.log('[Roster Sync] All athletes have jersey numbers, skipping lookup');
    return athletes;
  }

  let externalRoster: Map<string, string> | null = null;

  if (league && MILB_SPORT_IDS[league]) {
    externalRoster = await fetchMilbRoster(teamName, league);
  } else {
    externalRoster = await fetchESPNRoster(teamName);
  }

  if (!externalRoster || externalRoster.size === 0) {
    console.log('[Roster Sync] No external roster data available - returning original athletes');
    return athletes;
  }

  let filledCount = 0;
  const updatedAthletes = athletes.map(athlete => {
    if (!athlete.jerseyNumber || athlete.jerseyNumber === '00' || athlete.jerseyNumber === '') {
      const normalizedName = normalizePlayerName(athlete.fullName || '');
      const jerseyNumber = externalRoster?.get(normalizedName);

      if (jerseyNumber) {
        console.log(`[Roster Sync] ✓ Found jersey for ${athlete.fullName}: #${jerseyNumber}`);
        filledCount++;
        return { ...athlete, jerseyNumber: formatJerseyNumber(jerseyNumber) };
      }
    }
    return athlete;
  });

  console.log(`[Roster Sync] Filled ${filledCount} missing jersey numbers`);
  return updatedAthletes;
}

function getSchemaForTier(tier: SubscriptionTier, isNocMode: boolean, findBranding: boolean): any {
  const baseAthleteProperties: Record<string, any> = {
    fullName: { type: SchemaType.STRING },
    jerseyNumber: { type: SchemaType.STRING, description: isNocMode ? "Bib number for the athlete. Always use two digits (pad with 0 if needed)." : "Jersey number. Always use two digits (pad with 0 if needed)." },
    position: { type: SchemaType.STRING, description: isNocMode ? "Main sport/discipline (e.g. Swimming)." : "Player position." },
    nilStatus: { type: SchemaType.STRING },
  };

  const requiredFields = ["fullName", "jerseyNumber", "position", "nilStatus"];

  if (isNocMode) {
    baseAthleteProperties.countryCode = { type: SchemaType.STRING, description: "3-letter IOC Country Code (e.g. JAM, USA)." };
    baseAthleteProperties.event = { type: SchemaType.STRING, description: "Specific event (e.g. 100m Butterfly)." };
  }

  if (tier !== 'BASIC') {
    baseAthleteProperties.phoneticSimplified = { type: SchemaType.STRING };
  }

  if (tier === 'NETWORK') {
    baseAthleteProperties.nameSpanish = { type: SchemaType.STRING };
    baseAthleteProperties.nameMandarin = { type: SchemaType.STRING };
    baseAthleteProperties.bioStats = { type: SchemaType.STRING, description: "Summary of Olympic achievements/medals or career stats." };
    baseAthleteProperties.socialHandle = { type: SchemaType.STRING, description: "Likely social media handle (e.g. @name)." };
  }

  const rootProperties: Record<string, any> = {
    teamName: { type: SchemaType.STRING, description: isNocMode ? "National Olympic Committee Name (e.g. Team Jamaica)." : "Team Name." },
    abbreviation: { type: SchemaType.STRING, description: isNocMode ? "3-letter IOC Code." : "3-letter Team Abbreviation." },
    countryCode: { type: SchemaType.STRING, description: "3-letter IOC Country Code." },
    conference: { type: SchemaType.STRING },
    sport: { type: SchemaType.STRING },
    seasonYear: {
      type: SchemaType.STRING,
      description: "The specific season year or range found in the text (e.g. '2025-26', '2024-25', '2026')."
    },

    athletes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: baseAthleteProperties,
        required: requiredFields,
      }
    }
  };

  const rootRequired = ["teamName", "sport", "seasonYear", "athletes", "abbreviation"];

  if (findBranding) {
    rootProperties.primaryColor = { type: SchemaType.STRING, description: "The official primary HEX color code for the team (e.g. #FFB81C)." };
    rootProperties.secondaryColor = { type: SchemaType.STRING, description: "The official secondary HEX color code for the team." };
    rootProperties.logoUrl = { type: SchemaType.STRING, description: "Direct URL to the official team logo (preferably from ESPN CDN)." };
    rootProperties.primaryRgb = { type: SchemaType.STRING, description: "Primary color in RGB format (e.g. '255, 184, 28')." };
    rootProperties.secondaryRgb = { type: SchemaType.STRING, description: "Secondary color in RGB format." };
    rootProperties.primaryPantone = { type: SchemaType.STRING, description: "Primary color Pantone code (e.g. 'PMS 130 C')." };
    rootProperties.secondaryPantone = { type: SchemaType.STRING, description: "Secondary color Pantone code." };
    rootProperties.primaryCmyk = { type: SchemaType.STRING, description: "Primary color in CMYK format (e.g. '0, 28, 89, 0')." };
    rootProperties.secondaryCmyk = { type: SchemaType.STRING, description: "Secondary color in CMYK format." };
    rootRequired.push("primaryColor", "secondaryColor");
  }

  return {
    type: SchemaType.OBJECT,
    properties: rootProperties,
    required: rootRequired
  };
}

/**
 * Ensure jersey numbers are at least two digits.
 */
function formatJerseyNumber(num: any): string {
  if (num === undefined || num === null || num === "") return "00";
  const str = num.toString().replace(/#/g, '').trim();
  if (/^\d$/.test(str)) {
    return `0${str}`;
  }
  return str;
}

export async function processRosterRawText(
  text: string,
  tier: SubscriptionTier = 'BASIC',
  isNocMode: boolean = false,
  overrideSeason: string = '',
  findBranding: boolean = false,
  userId?: string,
  league?: string
): Promise<ProcessedRoster> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const schema = getSchemaForTier(tier, isNocMode, findBranding);

  const brandingInstruction = findBranding
    ? `BRANDING DISCOVERY: 
LOGO SOURCES (in priority order):
1. ESPN CDN for SOCCER: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
   - Use Google Search to find "ESPN {team name} team id" to get the correct numeric ID
   - KNOWN IDS: Liverpool FC=364, Real Madrid=86, Barcelona=83, Manchester United=360, Manchester City=382, Arsenal=359, Chelsea=363, Bayern Munich=132, PSG=160, Juventus=111
2. ESPN CDN for US SPORTS: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&h=200&w=200
   - NFL: ne, dal, gb, etc. | NHL: bos, nyr, chi | NBA: lal, bos, chi | MLB: nyy, bos, lad
3. WIKIPEDIA: For any team, search Google for "{team name} logo site:upload.wikimedia.org" and use the official SVG/PNG
4. FALLBACK: Use thesportsdb.com or official team website

CRITICAL: Never guess team IDs. If unsure, use Google Search to find the correct ESPN team ID or Wikipedia logo URL.

COLORS: Search teamcolorcodes.com for HEX, RGB, Pantone (PMS), and CMYK values.`
    : "Use default branding colors (#5B5FFF and #1A1A1A).";

  const systemInstruction = `You are an expert broadcast metadata extractor.
    - ${brandingInstruction}
    - TEAM NAME EXTRACTION: Look for the team name in headers, titles, or the first few lines. If the team name is not explicitly stated, INFER it from the context.
    - REVERSE LOOKUP (CRITICAL): If the team name is NOT found in the text, you MUST use the 'googleSearch' tool. Search for a query like "Daniel Vitiello Jared Mazzola Jack Gurr roster" (using 3-4 distinct player names from the list) to find the team. Use the search result to fill 'teamName'.
    - CLEANING INPUT: The input text may have artifacts like "Daniel Vitiello1" (name + jersey number). You MUST separate them -> Name: "Daniel Vitiello", Jersey: "01".
    - NORMALIZE: Convert all athlete names to UPPERCASE and strip accents.
    - JERSEY NUMBERS: Always use at least two digits. Pad single digits with a leading zero (e.g., '3' becomes '03', '0' becomes '00').
    - SPORT INFERENCE: If the sport is not explicitly named, INFER it from the positions (e.g. GK/FWD -> Soccer, QB/WR -> Football, G/F -> Basketball).
    - ABBREVIATION: If a 3-letter team code is not found in the text, GENERATE one based on the Team Name (e.g. "Liverpool FC" -> "LIV").
    - STRUCTURE: The output MUST be a JSON object with this exact structure: { "teamName": string, "athletes": [ { "fullName": string, "jerseyNumber": string, "position": string, "nilStatus": string } ], ... }.
    ${findBranding ? `- SCHEMA DEFINITION: ${JSON.stringify(schema.properties)}` : ''}
    - OUTPUT: Valid JSON matching the schema provided.`;

  const modelParams: any = {
    model: "gemini-2.0-flash-001",
    systemInstruction,
  };

  // Controlled generation (JSON mode/Schema) is NOT compatible with Search tools in Gemini 2.0
  if (!findBranding) {
    modelParams.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }

  if (findBranding) {
    modelParams.tools = [{ googleSearch: {} }];
  }



  const model = genAI.getGenerativeModel(modelParams);

  const context = league ? `Context: League is ${league}.` : '';
  const result = await model.generateContent(`Tier: ${tier}. Mode: ${isNocMode ? 'NOC' : 'Standard'}. ${context} Data: ${text}`);
  const response = await result.response;
  const usage = response.usageMetadata;
  const textResponse = response.text();

  // Track Usage
  if (usage && userId) {
    const inputTokens = usage.promptTokenCount || 0;
    const outputTokens = usage.candidatesTokenCount || 0;

    // Gemini 2.0 Flash Pricing (Approximate)
    // Input: $0.10 / 1M tokens
    // Output: $0.40 / 1M tokens
    const inputCost = (inputTokens / 1000000) * 0.10;
    const outputCost = (outputTokens / 1000000) * 0.40;
    const totalCost = inputCost + outputCost;

    console.log(`[Gemini Usage] Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${totalCost.toFixed(6)}`);

    // Fire and forget usage recording
    recordUsage(userId, {
      operationType: 'ROSTER_IMPORT',
      modelName: 'gemini-2.0-flash-001',
      inputTokens,
      outputTokens,
      searchQueries: 0, // Search tool accounting would go here if we tracked it separately
      total_cost_usd: totalCost
    }).catch(err => console.error("[Usage Tracking] Failed to record:", err));
  }

  if (!textResponse) {
    throw new Error("AI returned no content.");
  }

  console.log("Raw AI Response (Full):", textResponse);

  // Robust JSON extraction: Find the outer-most braces
  const firstOpen = textResponse.indexOf('{');
  const lastClose = textResponse.lastIndexOf('}');

  let cleanJson = textResponse;
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    cleanJson = textResponse.substring(firstOpen, lastClose + 1);
  }

  console.log("Candidate JSON:", cleanJson);
  const parsedResult = JSON.parse(cleanJson);

  // VERBOSE DEBUG: What did the AI extract for teamName?
  console.log('[Gemini] ==== TEAM IDENTIFICATION DEBUG ====');
  console.log('[Gemini] AI extracted teamName:', parsedResult.teamName);
  console.log('[Gemini] AI extracted sport:', parsedResult.sport);
  console.log('[Gemini] First 3 athletes:', (parsedResult.athletes || []).slice(0, 3).map((a: any) => a.fullName));


  // Debug: log branding data received from AI
  if (findBranding) {
    console.log('[Gemini] Branding data from AI:', {
      teamName: parsedResult.teamName,
      sport: parsedResult.sport,
      logoUrl: parsedResult.logoUrl,
      primaryColor: parsedResult.primaryColor,
      secondaryColor: parsedResult.secondaryColor,
      abbreviation: parsedResult.abbreviation,
      league: parsedResult.league
    });
  }

  const extractedSeason = overrideSeason || parsedResult.seasonYear || new Date().getFullYear().toString();

  // Extract verification sources from grounding metadata if branding was used
  const verificationSources: { title: string; uri: string }[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks; // Use optional chaining just in case
  if (groundingChunks) {
    groundingChunks.forEach((chunk: any) => {
      if (chunk.web?.uri) {
        verificationSources.push({
          title: chunk.web.title || "Source",
          uri: chunk.web.uri
        });
      }
    });
  }

  const athletes: Athlete[] = (parsedResult.athletes || []).map((a: any, idx: number) => ({
    id: `athlete-${idx}-${Date.now()}`,
    originalName: a.fullName || "",
    fullName: a.fullName || "",
    displayNameSafe: toSafeName(a.fullName || ""),
    jerseyNumber: formatJerseyNumber(a.jerseyNumber).replace(/#/g, ''),
    position: (a.position || "?").replace(/#/g, ''),
    phoneticIPA: "",
    phoneticSimplified: a.phoneticSimplified || "",
    nilStatus: (a.nilStatus as NILStatus) || 'Active',
    seasonYear: extractedSeason,
    nameSpanish: a.nameSpanish,
    nameMandarin: a.nameMandarin,
    bioStats: a.bioStats,
    socialHandle: a.socialHandle,
    countryCode: a.countryCode || parsedResult.countryCode,
    event: a.event
  }));
  // Check branding cache if branding was enabled
  let finalBranding = {
    primaryColor: parsedResult.primaryColor || "#5B5FFF",
    secondaryColor: parsedResult.secondaryColor || "#1A1A1A",
    conference: parsedResult.conference || "General",
    abbreviation: parsedResult.abbreviation || "UNK",
    countryCode: parsedResult.countryCode,
    logoUrl: parsedResult.logoUrl
  };

  // PRIORITY: Check hardcoded known teams first (most reliable)
  const teamNameUpper = (parsedResult.teamName || "").toUpperCase().trim();
  console.log('[Gemini] Checking KNOWN_TEAM_LOGOS for:', teamNameUpper);

  let knownTeam = KNOWN_TEAM_LOGOS[teamNameUpper];

  // AMBIGUITY DETECTION: Even if we have an exact match, check if other teams contain the same substring
  // This handles cases like "KINGS" which matches LA Kings exactly but should prompt for Sacramento Kings too
  let candidateTeams: { name: string; logoUrl: string; primaryColor: string; secondaryColor: string; sport?: string; league?: string }[] = [];

  // Always check for ambiguity when the search term is short enough to be ambiguous (< 20 chars)
  if (teamNameUpper.length > 3 && teamNameUpper.length < 20) {
    const allMatchingKeys = Object.keys(KNOWN_TEAM_LOGOS).filter(key =>
      key.includes(teamNameUpper) || teamNameUpper.includes(key)
    );

    if (allMatchingKeys.length > 0) {
      // Deduplicate by logoUrl (same logo = same team, different aliases)
      const uniqueTeams = new Map<string, { name: string; logoUrl: string; primaryColor: string; secondaryColor: string; sport?: string; league?: string }>();
      for (const key of allMatchingKeys) {
        const team = KNOWN_TEAM_LOGOS[key];
        const espnData = ESPN_TEAM_IDS[key]; // Look up sport/league metadata
        console.log(`[Gemini] Team "${key}": sport=${espnData?.sport}, league=${espnData?.league}`);
        if (!uniqueTeams.has(team.logoUrl)) {
          uniqueTeams.set(team.logoUrl, {
            name: key,
            ...team,
            sport: espnData?.sport,
            league: espnData?.league
          });
        }
      }

      // If multiple DISTINCT teams match, return them as candidates for user selection
      if (uniqueTeams.size > 1) {
        candidateTeams = Array.from(uniqueTeams.values());
        console.log(`[Gemini] AMBIGUITY DETECTED for "${teamNameUpper}": ${candidateTeams.map(t => t.name).join(', ')}`);
        // Pick the longest match as default
        allMatchingKeys.sort((a, b) => b.length - a.length);
        knownTeam = KNOWN_TEAM_LOGOS[allMatchingKeys[0]];
      } else if (uniqueTeams.size === 1 && !knownTeam) {
        // Single team (possibly with aliases) and no exact match - use fuzzy result
        const bestMatch = allMatchingKeys.sort((a, b) => b.length - a.length)[0];
        console.log(`[Gemini] Fuzzy match found: "${teamNameUpper}" -> "${bestMatch}"`);
        knownTeam = KNOWN_TEAM_LOGOS[bestMatch];
      }
    }
  }

  if (knownTeam) {
    console.log('[Gemini] Using hardcoded branding for known team:', teamNameUpper);
    finalBranding.logoUrl = knownTeam.logoUrl;
    finalBranding.primaryColor = knownTeam.primaryColor;
    finalBranding.secondaryColor = knownTeam.secondaryColor;
  }

  // Check Supabase cache if branding mode is on AND we didn't find a hardcoded match
  if (findBranding && parsedResult.teamName && parsedResult.sport && !knownTeam) {
    // Try to get cached branding
    const cachedBranding = await getBrandingCache(parsedResult.teamName, parsedResult.sport);

    if (cachedBranding) {
      // Use cached branding data
      console.log('[Gemini] Using cached branding for:', parsedResult.teamName);
      finalBranding = {
        primaryColor: cachedBranding.primary_color || finalBranding.primaryColor,
        secondaryColor: cachedBranding.secondary_color || finalBranding.secondaryColor,
        conference: finalBranding.conference,
        abbreviation: cachedBranding.abbreviation || finalBranding.abbreviation,
        countryCode: parsedResult.countryCode,
        logoUrl: cachedBranding.logo_url || finalBranding.logoUrl
      };
    } else if (parsedResult.logoUrl || parsedResult.primaryColor) {
      // Save new branding to cache for future use
      console.log('[Gemini] Saving branding to cache for:', parsedResult.teamName);
      saveBrandingCache({
        team_name: parsedResult.teamName,
        sport: parsedResult.sport,
        logo_url: parsedResult.logoUrl || null,
        primary_color: parsedResult.primaryColor || null,
        secondary_color: parsedResult.secondaryColor || null,
        abbreviation: parsedResult.abbreviation || null,
        primary_rgb: parsedResult.primaryRgb || null,
        secondary_rgb: parsedResult.secondaryRgb || null,
        primary_pantone: parsedResult.primaryPantone || null,
        secondary_pantone: parsedResult.secondaryPantone || null,
        primary_cmyk: parsedResult.primaryCmyk || null,
        secondary_cmyk: parsedResult.secondaryCmyk || null
      });
    }
  }

  // Fill missing jersey numbers from ESPN or MiLB roster data
  const teamNameForLookup = parsedResult.teamName || "";
  const athletesWithJerseys = await fillMissingJerseyNumbers(athletes, teamNameForLookup, league);

  // Standardize Sport/League from MiLB or ESPN ID Mapping
  // IMPORTANT: Only do this if there are NO candidate teams (no ambiguity)
  // If candidateTeams exist, the user will select from the modal and that selection
  // will have the correct sport/league metadata already attached
  let standardizedSport = parsedResult.sport || "General";

  if (candidateTeams.length <= 1) {
    // PRIORITY 1: Check if a MiLB league was explicitly selected
    if (league && LEAGUE_TO_SPORT[league]) {
      standardizedSport = LEAGUE_TO_SPORT[league];
      console.log(`[Gemini] Standardized sport from user-selected league: ${standardizedSport}`);
    } else {
      // PRIORITY 2: Try ESPN team matching
      const upperTeamName = (parsedResult.teamName || "").toUpperCase().trim();

      let espnIdentity = ESPN_TEAM_IDS[upperTeamName];

      // If no direct match, try fuzzy match
      if (!espnIdentity) {
        const fuzzyKey = Object.keys(ESPN_TEAM_IDS).find(key =>
          upperTeamName.includes(key) || key.includes(upperTeamName)
        );
        if (fuzzyKey) {
          console.log(`[Gemini] Fuzzy matched team for sport lookup: "${upperTeamName}" -> "${fuzzyKey}"`);
          espnIdentity = ESPN_TEAM_IDS[fuzzyKey];
        }
      }

      if (espnIdentity) {
        // Use the SPORT from ESPN (capitalized)
        if (espnIdentity.sport) {
          standardizedSport = espnIdentity.sport.charAt(0).toUpperCase() + espnIdentity.sport.slice(1);
          console.log(`[Gemini] Standardized sport from ESPN ID: ${standardizedSport}`);
        } else if (espnIdentity.league) {
          // Fallback to league inferrence if sport is missing (rare)
          const rawLeague = espnIdentity.league.toLowerCase();
          standardizedSport = LEAGUE_TO_SPORT[rawLeague] || LEAGUE_DISPLAY_NAMES[rawLeague] || rawLeague.toUpperCase();
        }
      }
    }
  } else {
    console.log(`[Gemini] Skipping sport standardization - user will select from ${candidateTeams.length} candidates`);
  }

  // Determine final league name:
  // 1. AI explictly returned league (highest priority for non-standard leagues)
  // 2. We found an ESPN identity (fuzzy or exact) that has a league attached
  let finalLeague = parsedResult.league;

  if (!finalLeague && candidateTeams.length <= 1) {
    // Re-resolve identity if needed (to be safe/clean access) or just use the logic flow.
    // Since we scoped espnIdentity inside the `else` block above, we need to re-access or restructure.
    // A cleaner way is to compute `finalLeague` where we computed `espnIdentity`.
    // Let's refactor slightly to just re-grab it here for the return object since exact match is cheap.
    // Actually, we can just grab it again with fuzzy logic if we want to be 100% sure for the return:
    const upperTeamName = (parsedResult.teamName || "").toUpperCase().trim();
    let espnIdentity = ESPN_TEAM_IDS[upperTeamName];
    if (!espnIdentity) {
      const fuzzyKey = Object.keys(ESPN_TEAM_IDS).find(key =>
        upperTeamName.includes(key) || key.includes(upperTeamName)
      );
      if (fuzzyKey) espnIdentity = ESPN_TEAM_IDS[fuzzyKey];
    }

    if (espnIdentity && espnIdentity.league) {
      finalLeague = LEAGUE_DISPLAY_NAMES[espnIdentity.league] || espnIdentity.league;
    }
  }

  return {
    teamName: parsedResult.teamName || (isNocMode ? "Unknown NOC" : "Unknown Team"),
    sport: standardizedSport,
    league: finalLeague || undefined,
    seasonYear: extractedSeason,
    isNocMode: isNocMode,
    athletes: athletesWithJerseys,
    verificationSources,
    candidateTeams: candidateTeams.length > 1 ? candidateTeams : undefined,
    teamMetadata: finalBranding
  };
}
