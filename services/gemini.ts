
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Athlete, NILStatus, SubscriptionTier } from "../types.ts";
import { getBrandingCache, saveBrandingCache, recordUsage, supabase } from "./supabase.ts";
import { KNOWN_TEAM_LOGOS, ESPN_TEAM_IDS, LEAGUE_DISPLAY_NAMES, LEAGUE_TO_SPORT, MILB_SPORT_IDS, NHL_API_CODES } from './teamData.ts';

// Helper to get the key even if the build tool is doing static analysis on process.env.API_KEY
const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.VITE_GEMINI_API_KEY || '';
};

export const isGeminiConfigured = !!getApiKey();

interface ProcessedRoster {
  teamName: string;
  sport: string;
  seasonYear: string;
  athletes: Athlete[];
  verificationSources?: { title: string; uri: string }[];
  candidateTeams?: { name: string; logoUrl: string; primaryColor: string; secondaryColor: string; sport?: string; league?: string }[];
  league?: string;
  abbreviation?: string;
  teamMetadata?: {
    primaryColor: string;
    secondaryColor: string;
    conference: string;
    abbreviation: string;
    logoUrl?: string;
    countryCode?: string;
  };
  officialRosterCount?: number;
  pastedRosterCount?: number;
  matchedRosterCount?: number;
  missingAthletes?: Athlete[];
}

interface ExternalAthleteData {
  jersey: string;
  position: string;
  headshot?: string;
  id: string;
  fullName: string;
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

function toTitleCase(str: string): string {
  if (!str) return "";
  const smallWords = ['of', 'the', 'and', 'de', 'del', 'da', 'at', 'by', 'for', 'in', 'on', 'to', 'up', 'y'];
  // Common sports acronyms and region codes to keep uppercase
  const acronyms = ['FC', 'CF', 'II', 'III', 'IV', 'VI', 'AFC', 'SC', 'AC', 'US', 'USA', 'U18', 'U20', 'U23', 'LA', 'NY', 'NJ', 'DC', 'KC', 'STL', 'RSL', 'NYC', 'S.C.', 'F.C.'];

  return str.split(' ').map((word, index) => {
    // Handle hyphenated names (e.g., Jean-Pierre)
    if (word.includes('-')) {
      return word.split('-').map(part => toTitleCase(part)).join('-');
    }

    const upper = word.toUpperCase();
    // Check if the word (stripped of punctuation for matching) is a known acronym
    const cleanWord = upper.replace(/[^A-Z0-9]/g, '');

    if (acronyms.includes(cleanWord) || acronyms.includes(upper)) {
      return upper;
    }

    // Check for small words (skip if first word)
    const lower = word.toLowerCase();
    if (index > 0 && smallWords.includes(lower)) {
      return lower;
    }

    // Capitalize first letter, lowercase rest
    return upper.charAt(0) + lower.slice(1);
  }).join(' ');
}

/**
 * Smartly fix casing only if it looks broken (all caps or all lowercase)
 */
function fixNameCase(name: string): string {
  if (!name) return "";
  // If it has at least one lowercase letter AND at least one uppercase, 
  // assume it was intentionally cased (e.g. LeBron, de Jong, MacKinnon)
  const hasLower = /[a-z]/.test(name);
  const hasUpper = /[A-Z]/.test(name);

  if (hasLower && hasUpper) return name;
  return toTitleCase(name);
}

/**
 * Authoritative Database Matching for Olympic Athletes
 * Queries Supabase athletes table to find official matches and override AI data.
 */


/**
 * Robustly extract JSON from AI response text
 */
function extractJSON(text: string): any {
  if (!text) throw new Error("Empty AI response");

  const tryParse = (str: string) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      const cleaned = str
        .replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1')
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/[\u201C\u201D]/g, '"') // Smart quotes
        .trim();
      try {
        return JSON.parse(cleaned);
      } catch (e2) {
        return null;
      }
    }
  };

  // 1. Try finding blocks between backticks first
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)(?:```|$)/gi;
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (!candidate) continue;

    const result = tryParse(candidate);
    if (result) return result;

    // Search for braces INSIDE the unparsed code block
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const braceResult = tryParse(candidate.substring(firstBrace, lastBrace + 1));
      if (braceResult) return braceResult;
    }
  }

  // 2. Brute force: Find any {...} block in the whole text
  const firstOpen = text.indexOf('{');
  const lastClose = text.lastIndexOf('}');
  if (firstOpen !== -1 && lastClose !== -1) {
    // Try largest possible block
    const fullCandidate = text.substring(firstOpen, lastClose + 1);
    const fullResult = tryParse(fullCandidate);
    if (fullResult) return fullResult;

    // Try finding all balanced { } pairs and testing them (best for nested JSON)
    const braceRegex = /\{(?:[^{}]|(\{(?:[^{}]|(\{[^{}]*\}))*\}))*\}/g;
    const matches = text.match(braceRegex);
    if (matches) {
      for (const m of matches) {
        const r = tryParse(m);
        if (r) return r;
      }
    }
  }

  // 3. Last resort: just the trimmed text
  const finalResult = tryParse(text.trim());
  if (finalResult) return finalResult;

  console.error("[Gemini] FAILED TO PARSE JSON. Full response was:", text);
  throw new Error(`Failed to parse AI response as JSON. Content: ${text.substring(0, 100)}`);
}

// Helper: Fetch authoritative branding from Supabase 'teams' table
async function fetchBrandingFromDB(name: string, league: string): Promise<{ name?: string; logoUrl?: string; primaryColor?: string; secondaryColor?: string } | null> {
  if (!name || !supabase || name === 'Unknown Team') return null;

  const searchLeague = league.toLowerCase();

  // 1. Try exact match first
  const { data } = await supabase
    .from('teams')
    .select('name, logo_url, primary_color, secondary_color')
    .eq('league', searchLeague)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (data) {
    console.log(`[Supabase] Found authoritative branding for ${name}`);
    return {
      name: data.name,
      logoUrl: data.logo_url,
      primaryColor: data.primary_color || undefined,
      secondaryColor: data.secondary_color || undefined
    };
  }

  // 2. Try looking in alt_names array if exact match fails
  const { data: altData } = await supabase
    .from('teams')
    .select('name, logo_url, primary_color, secondary_color')
    .eq('league', searchLeague)
    .contains('alt_names', [name])
    .limit(1)
    .maybeSingle();

  if (altData) {
    console.log(`[Supabase] Found authoritative branding via alt_name for ${name}`);
    return {
      name: altData.name,
      logoUrl: altData.logo_url,
      primaryColor: altData.primary_color || undefined,
      secondaryColor: altData.secondary_color || undefined
    };
  }

  return null;
}



/**
 * Normalize a player name for fuzzy matching
 */
function normalizePlayerName(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Strip accents
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch team roster from ESPN API
 */
async function fetchESPNRoster(teamName: string, league?: string): Promise<Map<string, ExternalAthleteData> | null> {
  const teamUpper = teamName.toUpperCase().trim();
  let teamInfo = ESPN_TEAM_IDS[teamUpper];

  console.log(`[ESPN] Looking up team: "${teamName}" (normalized: "${teamUpper}")`);
  console.log(`[ESPN] Direct lookup result:`, teamInfo ? `Found - ${teamInfo.id} (${teamInfo.sport}/${teamInfo.league})` : 'Not found');

  // If no match OR match is missing critical metadata (id, sport, league), perform a smarter lookup
  if (!teamInfo || !teamInfo.id || !teamInfo.sport || !teamInfo.league) {
    const allKeys = Object.keys(ESPN_TEAM_IDS);
    const fuzzyMatches = allKeys.filter(key =>
      teamUpper.includes(key) || key.includes(teamUpper)
    );

    console.log(`[ESPN] Fuzzy matches found: ${fuzzyMatches.length}`, fuzzyMatches.slice(0, 5));

    if (fuzzyMatches.length > 0) {
      // Prioritize matches that HAVE critical metadata
      const validMatches = fuzzyMatches.filter(key => {
        const info = ESPN_TEAM_IDS[key];
        return info.id && info.sport && info.league;
      });

      console.log(`[ESPN] Valid matches with metadata: ${validMatches.length}`, validMatches.slice(0, 5));

      // If a league is provided, prioritize matches in that league
      if (league && (validMatches.length > 0 || fuzzyMatches.length > 0)) {
        const leagueLower = league.toLowerCase();
        const pool = validMatches.length > 0 ? validMatches : fuzzyMatches;
        const leagueMatch = pool.find(key =>
          ESPN_TEAM_IDS[key].league.toLowerCase() === leagueLower ||
          ESPN_TEAM_IDS[key].league.toLowerCase().includes(leagueLower)
        );
        if (leagueMatch) {
          teamInfo = ESPN_TEAM_IDS[leagueMatch];
          console.log(`[ESPN] League-filtered match: ${leagueMatch}`, teamInfo);
        }
      }

      // Fallback: Use the first valid metadata-rich match
      if (!teamInfo && validMatches.length > 0) {
        teamInfo = ESPN_TEAM_IDS[validMatches[0]];
        console.log(`[ESPN] Using first valid match: ${validMatches[0]}`, teamInfo);
      }

      // Final fallback: Use the first fuzzy match regardless of metadata
      if (!teamInfo) {
        teamInfo = ESPN_TEAM_IDS[fuzzyMatches[0]];
        console.log(`[ESPN] Using first fuzzy match: ${fuzzyMatches[0]}`, teamInfo);
      }

      if (teamInfo && teamInfo.id) {
        console.log(`[ESPN] Resolved metadata-rich match for "${teamName}":`, teamInfo);
      }
    }
  }

  if (!teamInfo || !teamInfo.id) {
    console.log(`[ESPN] ❌ No valid team ID found for: ${teamName}`);
    return null;
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/${teamInfo.sport}/${teamInfo.league}/teams/${teamInfo.id}/roster`;

  try {
    console.log(`[ESPN] 🔄 Fetching roster from: ${url}`);
    const response = await fetch(url);
    console.log(`[ESPN] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[ESPN] ❌ HTTP Error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const rosterMap = new Map<string, ExternalAthleteData>();

    console.log(`[ESPN] API response keys:`, Object.keys(data || {}));
    console.log(`[ESPN] data.athletes:`, data.athletes ? `Array with ${data.athletes.length} items` : 'null/undefined');

    if (data.athletes && Array.isArray(data.athletes)) {
      for (const group of data.athletes) {
        // Handle grouped athletes (e.g., NFL has groups with 'items' array)
        if (group.items && Array.isArray(group.items)) {
          for (const athlete of group.items) {
            if (athlete.fullName) {
              rosterMap.set(normalizePlayerName(athlete.fullName), {
                jersey: athlete.jersey || "00",
                position: athlete.position?.abbreviation || athlete.position?.name || "Athlete",
                headshot: athlete.headshot?.href || "",
                id: athlete.id,
                fullName: athlete.fullName
              });
            }
          }
        }
        // Handle flat athletes (standard for many other leagues)
        else if (group.fullName) {
          rosterMap.set(normalizePlayerName(group.fullName), {
            jersey: group.jersey || "00",
            position: group.position?.abbreviation || group.position?.name || "Athlete",
            headshot: group.headshot?.href || "",
            id: group.id,
            fullName: group.fullName
          });
        }
      }
    }

    console.log(`[ESPN] ✅ Loaded ${rosterMap.size} players with jersey numbers`);
    return rosterMap;
  } catch (error) {
    console.error('[ESPN] ❌ Failed to fetch roster:', error);
    return null;
  }
}

const LEAGUE_ALIAS_MAP: Record<string, string[]> = {
  'mls': ['usa.1', 'mls'],
  'nwsl': ['usa.nwsl', 'nwsl'],
  'premier-league': ['eng.1', 'premier-league', 'eng.premier'],
  'la-liga': ['esp.1', 'la-liga', 'esp.laliga'],
  'bundesliga': ['ger.1', 'bundesliga', 'ger.bundesliga'],
  'serie-a': ['ita.1', 'serie-a', 'ita.seriea'],
  'ligue-1': ['fra.1', 'ligue-1', 'fra.ligue1'],
  'eredivisie': ['ned.1', 'eredivisie'],
  'liga-mx': ['mex.1', 'liga-mx'],
  'usl': ['usa.usl.1', 'usl'],
  'champions-league': ['uefa.champions', 'champions-league'],
  'milb': ['milb-aaa', 'milb'],
  'euroleague': ['euroleague'],
  'efl-championship': ['eng.2', 'efl-championship'],
  'scottish-premiership': ['sco.1', 'scottish-premiership'],
  'wsl': ['eng.w.1', 'wsl'],
};

/**
 * Extract unique team names for a specific league from our seeded data.
 * Used to provide a "multiple-choice" list to the AI to prevent "Unknown Team"
 * when search is disabled.
 */
function getKnownTeamsForLeague(league: string): string[] {
  const teams = new Set<string>();
  const targetLeague = league.toLowerCase();
  const validLeagues = LEAGUE_ALIAS_MAP[targetLeague] || [targetLeague];

  // Check ESPN_TEAM_IDS
  Object.entries(ESPN_TEAM_IDS).forEach(([name, info]) => {
    if (info.league && validLeagues.includes(info.league.toLowerCase())) {
      teams.add(name);
    }
  });

  // Check KNOWN_TEAM_LOGOS as fallback/secondary
  Object.entries(KNOWN_TEAM_LOGOS).forEach(([name, info]) => {
    if (info.league && validLeagues.includes(info.league.toLowerCase())) {
      teams.add(name);
    }
  });

  return Array.from(teams).sort();
}

/**
 * Fetch team roster from MLB Stats API (for MiLB)
 */
async function fetchMilbRoster(teamName: string, league: string): Promise<Map<string, ExternalAthleteData> | null> {
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
    const rosterMap = new Map<string, ExternalAthleteData>();

    if (rosterData.roster && Array.isArray(rosterData.roster)) {
      for (const entry of rosterData.roster) {
        if (entry.person?.fullName) {
          rosterMap.set(normalizePlayerName(entry.person.fullName), {
            jersey: entry.jerseyNumber || "00",
            position: entry.position?.abbreviation || "Athlete",
            id: entry.person.id.toString(),
            headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/${entry.person.id}/headshot/67/current`,
            fullName: entry.person.fullName
          });
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
 * Helper: Compute current NHL season string (e.g. "20242025")
 */
function getNHLSeasonString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed (Jan=1)

  // NHL seasons generally start in September/October
  if (month >= 9) {
    return `${year}${year + 1}`;
  } else {
    return `${year - 1}${year}`;
  }
}

/**
 * Fetch team roster from unofficial NHL API
 */
async function fetchNHLRoster(teamName: string): Promise<Map<string, ExternalAthleteData> | null> {
  const teamUpper = teamName.toUpperCase().trim();
  const teamCode = NHL_API_CODES[teamUpper];

  if (!teamCode) {
    console.log(`[NHL] No team code found for: ${teamName}`);
    return null;
  }

  // Use proxy path to avoid CORS issues
  // Local: Vite proxy forwards to https://api-web.nhle.com/v1
  // Prod: Vercel rewrite forwards to https://api-web.nhle.com/v1

  if (!teamCode) {
    console.warn(`[NHL] No team code found in NHL_API_CODES for: "${teamName}"`);
    return null;
  }

  const season = getNHLSeasonString();
  const url = `/api/nhl/roster/${teamCode}/${season}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[NHL] API returned status: ${response.status}`);
      return null;
    }

    const data: any = await response.json();
    const rosterMap = new Map<string, ExternalAthleteData>();

    const processPlayer = (player: any) => {
      const fullName = `${player.firstName.default} ${player.lastName.default}`;
      const normalized = normalizePlayerName(fullName);
      rosterMap.set(normalized, {
        jersey: player.sweaterNumber?.toString() || "00",
        position: player.positionCode || "Athlete",
        headshot: player.headshot || "",
        id: player.id?.toString(),
        fullName: fullName
      });
    };

    data.forwards?.forEach(processPlayer);
    data.defensemen?.forEach(processPlayer);
    data.goalies?.forEach(processPlayer);

    console.log(`[NHL] Successfully loaded ${rosterMap.size} players for ${teamCode}`);
    return rosterMap;
  } catch (error) {
    console.error('[NHL] Failed to fetch roster:', error);
    return null;
  }
}

/**
 * Fill in missing jersey numbers by matching against external roster data (ESPN or MiLB)
 */
export async function fillMissingJerseyNumbers(
  athletes: any[],
  teamName: string,
  league?: string
): Promise<{
  updatedAthletes: any[],
  officialCount: number,
  matchedCount: number,
  missingAthletes: Athlete[]
}> {
  console.log(`[Roster Sync] 🔍 fillMissingJerseyNumbers called with team: "${teamName}", league: ${league || 'unknown'}, athletes: ${athletes.length}`);
  console.log(`[Roster Sync] 📋 Sample athletes:`, athletes.slice(0, 3).map(a => ({ name: a.fullName, jersey: a.jerseyNumber, pos: a.position })));

  let externalRoster: Map<string, ExternalAthleteData> | null = null;

  console.log(`[Roster Sync] 🔎 Fetching external roster...`);

  if (league && MILB_SPORT_IDS[league]) {
    console.log(`[Roster Sync] 📡 Using MiLB API for: ${teamName}`);
    externalRoster = await fetchMilbRoster(teamName, league);
  } else if (league === 'nhl') {
    console.log(`[Roster Sync] 📡 Using NHL API for: ${teamName}`);
    externalRoster = await fetchNHLRoster(teamName);
  } else {
    console.log(`[Roster Sync] 📡 Using ESPN API for: ${teamName} (league: ${league || 'not specified'})`);
    externalRoster = await fetchESPNRoster(teamName, league);
  }

  console.log(`[Roster Sync] 📊 External roster size: ${externalRoster?.size || 0} players`);

  if (!externalRoster || externalRoster.size === 0) {
    console.log('[Roster Sync] ⚠️ No external roster data available - returning original athletes with casing fix');
    return {
      updatedAthletes: athletes.map(a => ({ ...a, fullName: fixNameCase(a.fullName) })),
      officialCount: 0,
      matchedCount: 0,
      missingAthletes: []
    };
  }

  console.log(`[Roster Sync] ✅ External roster loaded with ${externalRoster.size} players`);

  // 1. Fill missing jerseys AND positions
  let filledCount = 0;
  const matchedOfficialNames = new Set<string>();

  // Pre-calculate a map of normalized "Last Name" -> External Data for fuzzy matching
  const lastNameMap = new Map<string, ExternalAthleteData[]>();
  externalRoster.forEach((data, name) => {
    const parts = name.split(' ');
    const lastName = parts[parts.length - 1];
    if (lastName) {
      const list = lastNameMap.get(lastName) || [];
      list.push(data);
      lastNameMap.set(lastName, list);
    }
  });

  const updatedAthletes = athletes.map(athlete => {
    const normalizedName = normalizePlayerName(athlete.fullName || '');

    // 1. Try Exact Match
    let externalData = externalRoster?.get(normalizedName);
    if (externalData) {
      matchedOfficialNames.add(normalizedName);
    }

    // 2. Try Fuzzy Match (Last Name + First Initial) if no exact match
    if (!externalData) {
      const parts = normalizedName.split(' ');
      if (parts.length >= 2) {
        const firstName = parts[0];
        const lastName = parts[parts.length - 1];
        const initial = firstName.charAt(0);

        const candidates = lastNameMap.get(lastName);
        if (candidates && candidates.length === 1) {
          // Only match if it's the only player with that last name (safer)
          // or if we can confirm the first initial matches.
          // In the externalRoster keys, we need to find the full name that matches.
          // Let's check candidates.
          const match = candidates.find(c => {
            // We don't have the full name in ExternalAthleteData, but we can search externalRoster
            // This is a bit inefficient but for 30 players it's fine.
            for (const [extFullName, extData] of externalRoster.entries()) {
              if (extData === c) {
                const extParts = extFullName.split(' ');
                if (extParts[0].charAt(0) === initial) {
                  matchedOfficialNames.add(extFullName);
                  return true;
                }
              }
            }
            return false;
          });
          if (match) {
            console.log(`[Roster Sync] Fuzzy matched "${athlete.fullName}" to official roster via last name/initial`);
            externalData = match;
          }
        }
      }
    }

    if (!externalData) return athlete;

    let updated = { ...athlete };
    // Always ensure name casing is clean, preferring official name if matched
    updated.fullName = fixNameCase(externalData.fullName || updated.fullName);
    let changed = updated.fullName !== athlete.fullName;

    // Backfill Jersey if missing
    if (!updated.jerseyNumber || updated.jerseyNumber === '00' || updated.jerseyNumber === '') {
      if (externalData.jersey) {
        updated.jerseyNumber = formatJerseyNumber(externalData.jersey);
        changed = true;
      }
    }

    // Backfill Position if missing or generic
    if (!updated.position || updated.position === 'Athlete' || updated.position === 'UNK') {
      if (externalData.position) {
        updated.position = externalData.position;
        changed = true;
      }
    }

    if (changed) {
      filledCount++;
    }

    return updated;
  });

  console.log(`[Roster Sync] ✅ Filled ${filledCount} missing jersey numbers/positions`);
  console.log(`[Roster Sync] 📊 Matched ${matchedOfficialNames.size} official players to pasted roster`);

  // 2. Identify missing athletes
  const missingAthletes: Athlete[] = [];

  console.log(`[Roster Sync] 🔍 Checking for missing athletes...`);
  console.log(`[Roster Sync] 📋 External roster has ${externalRoster.size} players`);
  console.log(`[Roster Sync] 📋 Matched ${matchedOfficialNames.size} players`);

  externalRoster.forEach((data, nameKey) => {
    // Check if this official name was NOT matched to any pasted name
    if (!matchedOfficialNames.has(nameKey)) {
      const displayName = fixNameCase(data.fullName || nameKey);
      missingAthletes.push({
        id: `missing-${nameKey}-${Math.random().toString(36).substr(2, 9)}`,
        fullName: displayName,
        displayNameSafe: toSafeName(displayName),
        jerseyNumber: formatJerseyNumber(data.jersey).replace(/#/g, ''),
        position: (data.position || "Athlete").replace(/#/g, ''),
        phoneticIPA: "",
        phoneticSimplified: "",
        nilStatus: 'Active',
        seasonYear: athletes[0]?.seasonYear || new Date().getFullYear().toString()
      } as Athlete);
    }
  });

  console.log(`[Roster Sync] 🎯 RESULTS:`);
  console.log(`[Roster Sync]   - Official roster size: ${externalRoster.size}`);
  console.log(`[Roster Sync]   - Missing athletes detected: ${missingAthletes.length}`);
  console.log(`[Roster Sync]   - Missing athletes:`, missingAthletes.slice(0, 5).map(a => a.fullName));
  if (missingAthletes.length > 5) {
    console.log(`[Roster Sync]   - ... and ${missingAthletes.length - 5} more`);
  }

  return {
    updatedAthletes,
    officialCount: externalRoster.size,
    matchedCount: matchedOfficialNames.size,
    missingAthletes
  };
}

function getSchemaForTier(tier: SubscriptionTier, findBranding: boolean): any {
  const baseAthleteProperties: Record<string, any> = {
    fullName: { type: SchemaType.STRING },
    jerseyNumber: { type: SchemaType.STRING, description: "Jersey number. Always use two digits (pad with 0 if needed)." },
    position: { type: SchemaType.STRING, description: "Player position." },
  };

  const requiredFields = ["fullName", "jerseyNumber", "position"];

  // FREE TIER LIMITATION: Name, Jersey, Position only.
  if (tier !== 'FREE') {
    baseAthleteProperties.displayNameSafe = { type: SchemaType.STRING, description: "Name sanitized for broadcast hardware (ALL CAPS, no accents, special characters removed)." };
    baseAthleteProperties.nilStatus = { type: SchemaType.STRING };
    requiredFields.push("displayNameSafe", "nilStatus");

    baseAthleteProperties.phoneticSimplified = { type: SchemaType.STRING, description: "Simplified phonetic guide (e.g. 'fuh-NET-ik')." };
    requiredFields.push("phoneticSimplified");
  }

  if (tier === 'ENTERPRISE') {
    baseAthleteProperties.phoneticIPA = { type: SchemaType.STRING, description: "International Phonetic Alphabet (IPA) notation (e.g. /fəˈnɛtɪk/). Use standard symbols and slashes." };
    requiredFields.push("phoneticIPA");
    baseAthleteProperties.nameSpanish = { type: SchemaType.STRING };
    baseAthleteProperties.nameMandarin = { type: SchemaType.STRING };
    baseAthleteProperties.bioStats = { type: SchemaType.STRING, description: "Summary of achievements/medals or career stats." };
    baseAthleteProperties.socialHandle = { type: SchemaType.STRING, description: "Likely social media handle (e.g. @name)." };
  }

  const rootProperties: Record<string, any> = {
    teamName: { type: SchemaType.STRING, description: "Team Name." },
    abbreviation: { type: SchemaType.STRING, description: "3-letter Team Abbreviation." },
    conference: { type: SchemaType.STRING },
    sport: { type: SchemaType.STRING, description: "Sport name." },
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
    rootProperties.logoUrl = { type: SchemaType.STRING, description: "Direct URL to the official team logo. If unavailable on ESPN, YOU MUST USE a Wikipedia/Wikimedia upload.wikimedia.org URL." };
    rootProperties.primaryRgb = { type: SchemaType.STRING, description: "Primary color in RGB format (e.g. '255, 184, 28')." };
    rootProperties.secondaryRgb = { type: SchemaType.STRING, description: "Secondary color in RGB format." };
    rootProperties.primaryPantone = { type: SchemaType.STRING, description: "Primary color Pantone code (e.g. 'PMS 130 C')." };
    rootProperties.secondaryPantone = { type: SchemaType.STRING, description: "Secondary color Pantone code." };
    rootProperties.primaryCmyk = { type: SchemaType.STRING, description: "Primary color in CMYK format (e.g. '0, 28, 89, 0')." };
    rootProperties.secondaryCmyk = { type: SchemaType.STRING, description: "Secondary color in CMYK format." };
    // Branding fields are optional to avoid AI placeholders like "Unknown"
    // rootRequired.push("primaryColor", "secondaryColor", "logoUrl");
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
  tier: SubscriptionTier = 'FREE',
  overrideSeason: string = '',
  findBranding: boolean = false,
  userId?: string,
  league?: string,
  manualTeamName: string = ''
): Promise<ProcessedRoster> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const schema = getSchemaForTier(tier, findBranding);

  console.log("[Gemini] processRosterRawText called. TeamData loaded?", {
    espnIdsCount: Object.keys(ESPN_TEAM_IDS || {}).length,
    logosCount: Object.keys(KNOWN_TEAM_LOGOS || {}).length
  });


  // Optimization: If the user selected a Major League that we have fully seeded in Supabase,
  // we do NOT need to ask the AI to find branding. We can just look it up.
  // This saves:
  // 1. Tool Use Latency (2-5s)
  // 2. Search Quota
  // 3. Input Tokens (simpler prompt)
  const FULLY_SEEDED_LEAGUES = [
    'nba', 'wnba', 'nfl', 'nhl', 'mlb',
    'premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1', 'eredivisie', 'liga-mx', 'mls', 'nwsl',
  ];

  const isMajorLeague = league && FULLY_SEEDED_LEAGUES.includes(league);



  // SEARCH LOGIC: 
  // 1. Always enable search if the user wants branding (and it's not a major league where we have it).
  // 2. ALWAYS enable search for professional leagues (MiLB, NWSL, USL, etc.) to handle trades and expansion.
  const shouldSearch = findBranding || !!league;

  // brandingDiscovery is separate - we only tell it to deep-dive for logos if findBranding is true
  const shouldSearchForBranding = findBranding && !isMajorLeague;

  const knownTeams = league ? getKnownTeamsForLeague(league) : [];
  const knownTeamsList = knownTeams.length > 0
    ? `VALID TEAM LIST FOR ${league.toUpperCase()}:\n[${knownTeams.join(', ')}]\n`
    : '';

  const brandingInstruction = shouldSearchForBranding
    ? `BRANDING DISCOVERY: 
1. MiLB (Triple-A): 
   - Rule: Identification only. Do NOT search for logo or colors. 
   - Database has these teams: [Sacramento River Cats, Buffalo Bisons, Charlotte Knights, etc.]
2. US Pro (NFL, NHL, NBA, MLB): 
   - Logo URL Template: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{code}.png&w=200
   - Use Google to find the 2-3 letter team code (e.g. "ne" for Patriots).
3. NCAA:
   - Logo URL Template: https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/{TEAM_ID}.png&w=200
   - Use Google to find the ESPN Team ID.
4. Soccer:
   - Logo URL Template: https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{TEAM_ID}.png&w=200
5. Wikipedia: Use upload.wikimedia.org URLs if ESPN is missing.`
    : "Branding (Logos/Colors) will be handled downstream. Do not output logoUrl or colors.";

  const leagueHint = league ? `The user has indicated this is likely a roster for the ${LEAGUE_DISPLAY_NAMES[league] || league} league. ` : '';

  const systemInstruction = `You are an expert broadcast metadata extractor. Your PRIMARY GOAL is to extract the roster data.
    
    1. TEAM IDENTIFICATION:
    ${league ? `- The user has selected the ${league.toUpperCase()} league. IDENTIFY THE TEAM from the provided list or context.
    - VALID LIST: ${knownTeams.join(', ')}
    - If you are UNSURE, set teamName to "Unknown Team".` : `- DO NOT attempt to identify the team from player names or context.
    - ALWAYS set teamName to "Unknown Team".`}
    - The user will select the correct team manually after extraction if you are unsure.
    
    2. ROSTER EXTRACTION (MANDATORY):



    4. ROSTER EXTRACTION (MANDATORY):
    - CRITICAL: YOU MUST EXTRACT EVERY ATHLETE LISTED IN THE 'DATA' BLOCK BELOW.
    - NO SKIPPING: Even if an athlete only has a name and no other data, YOU MUST extract them.
    - DEFAULTS: If Jersey Number is missing, use "00". If NIL Status is missing, use "Incoming". If Position is missing, use "Athlete".
    - SOURCE DATA: You MUST extract the athletes from the literal 'DATA' provided in the user message, NOT from your search tool results.
    - SEARCH VS EXTRACTION: The 'googleSearch' tool is ONLY for identifying the 'teamName' and 'abbreviation'. Once identified, YOU MUST IMMEDIATELY go back to the 'DATA' block and extract every athlete listed there.
    - DO NOT return an empty 'athletes' array if there are names listed in the input.
    - CLEANING INPUT: The input text may have artifacts like "NAME01" (name + jersey number). You MUST separate them -> Name: "NAME", Jersey: "01".
    - NORMALIZE: Convert all athlete names to UPPERCASE and strip accents.
    - JERSEY NUMBERS: Always use at least two digits for 'jerseyNumber'. For ODF 'Code', use the 7-digit ID.
    - PHONETIC GUIDES:
      * Use 'phoneticSimplified' for a readable, capitalized-stress guide.
      * USE 'phoneticIPA' ONLY IF REQUESTED (Network Tier). Use standard International Phonetic Alphabet symbols.
    - SPORT INFERENCE: If the sport is not explicitly named, INFER it from the positions.
    - ODF COMPLIANCE (isNocMode):
      * TEAM NAME: Set 'teamName' to the Full Nation Name (e.g. "United States").
      * ABBREVIATION: Set 'abbreviation' to the 3-letter IOC code (e.g. "USA").
      * SPORT: Set 'sport' to the FULL discipline name + Gender. YOU MUST include "- Men" or "- Women" (e.g. "Alpine Skiing - Men").
      * NORMALIZE: Use 3-letter IOC codes for Nations (organisationId).
      * NAMES: Extract 'firstName' and 'lastName' (Proper Case).
      * METADATA: BirthDate MUST be YYYY-MM-DD. heightCm and weightKg MUST be integers. Gender MUST be 'M' or 'W'. Extract 'placeOfBirth' as the athlete's hometown.

    3. BRANDING & METADATA:
    - ${brandingInstruction}
    - ABBREVIATION: Always generate a 3-letter team code (e.g. "Liverpool FC" -> "LIV").

    4. OUTPUT FORMAT:
    - You MUST return a single valid JSON object.
    - DO NOT include markdown formatting (like \`\`\`json).
    - DO NOT include any introductory text.
    - JUST RETURN THE RAW JSON STRING. No reasoning, no search logs, and no preamble.
    - Structure: { "teamName": string, "athletes": [...] }
    ${findBranding ? `- EXPECTED PROPERTIES: ${JSON.stringify(Object.keys(schema.properties))}` : ''} `;

  const modelParams: any = {
    model: "gemini-2.0-flash", // Use stable alias
    systemInstruction,
  };

  // Ensure high output limit and focus
  const generationConfig: any = {
    temperature: 0.1, // Keep it precise
    maxOutputTokens: 8192, // Allow for large rosters + search logs
    responseMimeType: "application/json",
    responseSchema: schema,
  };

  modelParams.generationConfig = generationConfig;

  // Note: googleSearch tool removed - team identification is now manual
  // No tools needed for roster extraction


  const context = league ? `Context: League is ${league}.` : '';
  let result;
  try {
    const model = genAI.getGenerativeModel(modelParams);
    // Note: Team identification is now manual - AI always returns "Unknown Team"
    const extractionInstruction = league
      ? `Identify the team from the DATA and set teamName to the correct name from the valid list. If unclear, use "Unknown Team".`
      : `Extract roster data from the provided text. Set teamName to "Unknown Team".`;

    const userPrompt = `DATA:\n${text}\n\n${context}\nTier: ${tier}.\n\n` +
      `FINAL INSTRUCTIONS:\n` +
      `${extractionInstruction}\n` +
      `Extraction (MANDATORY): CRITICAL - You MUST extract EVERY SINGLE athlete from the 'DATA' block into the athletes array. ${league ? 'Identify the team if possible.' : 'Always set teamName to "Unknown Team".'}
         - NO SKIPPING: If a name is in DATA, it MUST be in the JSON results.
         - Use "00" for jersey/bib and "Athlete" as defaults for missing metadata.
         - Only provide birthDate, height, and weight if found in text or via search. Do NOT use fake placeholders.
         - THE DATA BLOCK IS YOUR ONLY AUTHORITATIVE SOURCE FOR NAMES.\n` +
      (shouldSearch ? `3. Required JSON Structure Template:
      {
        "teamName": "Full Nation Name",
        "abbreviation": "3-letter IOC Code",
        "sport": "Sport - Gender",
        "athletes": [
          { "fullName": "NAME", "jerseyNumber": "00", "position": "Athlete", "organisationId": "IOC_CODE", "gender": "M/W", "birthDate": "YYYY-MM-DD", "placeOfBirth": "Hometown" }
        ]
      }\n` : '') +
      `4. Return ONLY valid JSON. No conversational text.`;

    result = await model.generateContent(userPrompt);
  } catch (error: any) {
    if (findBranding && (error.message?.includes('fetch') || error.message?.includes('googleSearch'))) {
      console.warn("[Gemini] Fetch failed with search tool, retrying without search...", error);
      const fallbackParams = { ...modelParams };
      delete fallbackParams.tools;
      // Re-enable JSON mode for fallback if needed (since search was the only thing preventing it)
      fallbackParams.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: schema,
      };
      const fallbackModel = genAI.getGenerativeModel(fallbackParams);
      const fallbackPrompt = `
      IDENTIFY TEAM AND EXTRACT ROSTER
      INSTRUCTIONS:
      1. Identify the team name from the DATA provided.
      2. Extract EVERY athlete listed in the DATA.
      3. Return ONLY valid JSON matching the schema.

      DATA: ${text}`;
      result = await fallbackModel.generateContent(fallbackPrompt);
    } else {
      throw error;
    }
  }

  const response = await result.response;
  const usage = response.usageMetadata;
  const textResponse = response.text();

  if (findBranding) {
    console.log(`[Gemini] Search Response Preview: ${textResponse.substring(0, 500)}...`);
  }

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

    console.log(`[Gemini Usage]Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${totalCost.toFixed(6)} `);

    // Fire and forget usage recording
    recordUsage(userId, {
      operationType: 'ROSTER_IMPORT',
      modelName: 'gemini-2.0-flash',
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

  let parsedResult = extractJSON(textResponse);

  // ROBUSTNESS FIX: Normalize athletes to handle AI schema drift (e.g. "name" vs "fullName")
  if (parsedResult && parsedResult.athletes && Array.isArray(parsedResult.athletes)) {
    parsedResult.athletes = parsedResult.athletes.map((a: any) => {
      // If fullName is missing, check for common alternatives
      const normalizedName = a.fullName || a.name || a.player || "Unknown Athlete";
      const normalizedJersey = (a.jerseyNumber || a.jersey || "00").toString();
      const normalizedPos = a.position || a.pos || "UNK";

      return {
        ...a,
        fullName: normalizedName,
        jerseyNumber: normalizedJersey,
        position: normalizedPos
      };
    });
    console.log(`[Gemini] Normalized ${parsedResult.athletes.length} athletes. Sample:`, parsedResult.athletes[0]);
  }

  // ROBUSTNESS FIX: Normalize root branding fields to handle "Unknown" or placeholder strings from AI
  const cleanStr = (val: any) => {
    if (typeof val !== 'string') return val;
    const low = val.toLowerCase().trim();
    if (low === 'unknown' || low === 'unknown team' || low === 'null' || low === 'undefined' || low === 'unk' || low === 'logourl' || low === 'string' || low === 'none' || low.includes('placeholder')) return undefined;
    return val;
  };

  if (parsedResult) {
    const keysToClean = ['teamName', 'logoUrl', 'primaryColor', 'secondaryColor', 'abbreviation', 'conference', 'sport'];
    keysToClean.forEach(key => {
      if (key === 'teamName') {
        console.log(`[Gemini] Normalizing teamName. Before: "${parsedResult[key]}"`);
        parsedResult[key] = toTitleCase(cleanStr(parsedResult[key]));
        console.log(`[Gemini] Normalizing teamName. After: "${parsedResult[key]}"`);
      } else {
        parsedResult[key] = cleanStr(parsedResult[key]);
      }
    });
  }

  // FAILSAFE: If AI returns empty athletes list (common when search tool distracts it), retry without search
  if (findBranding && (!parsedResult.athletes || parsedResult.athletes.length === 0)) {
    console.warn("[Gemini] AI returned empty athletes list with search enabled. Retrying without search...");
    console.log("[Gemini] First pass result:", JSON.stringify(parsedResult, null, 2));

    try {
      const fallbackParams = { ...modelParams };
      delete fallbackParams.tools;
      fallbackParams.generationConfig = {
        responseMimeType: "application/json",
        responseSchema: schema,
      };

      const fallbackModel = genAI.getGenerativeModel(fallbackParams);
      const fallbackPrompt = `
      IDENTIFY TEAM AND EXTRACT ROSTER
      INSTRUCTIONS:
      1. Identify the team name from the DATA provided.
      2. Extract EVERY athlete listed in the DATA.
      3. Return ONLY valid JSON matching the schema.

      DATA: ${text}`;

      const fallbackResult = await fallbackModel.generateContent(fallbackPrompt);
      const fbResponse = await fallbackResult.response;
      const fbText = fbResponse.text();
      console.log("[Gemini] Fallback Response:", fbText);
      const fbParsed = extractJSON(fbText);

      // If fallback successfully extracted athletes, use it
      if (fbParsed.athletes && fbParsed.athletes.length > 0) {
        // preserve any branding info from the first run if available, 
        // but prioritized fallback for core data
        parsedResult = {
          ...parsedResult,
          ...fbParsed,
          // If fallback lacks team name but first run had it, keep first run's team name? 
          // Usually fallback is better for data, first run better for branding. 
          // But input text extraction should yield team name too.
        };
        console.log(`[Gemini] Recovered ${parsedResult.athletes.length} athletes via fallback.`);
      }
    } catch (fbError) {
      console.error("[Gemini] Fallback retry failed:", fbError);
    }
  }

  // --- NEW: Try to fetch authoritative logo from Supabase ---
  if (parsedResult.teamName) {
    const branding = await fetchBrandingFromDB(parsedResult.teamName, league || 'milb');
    if (branding) {
      if (branding.name) {
        console.log(`[Gemini] Updating teamName from "${parsedResult.teamName}" to official: "${branding.name}"`);
        parsedResult.teamName = branding.name;
      }
      if (branding.logoUrl) {
        console.log(`[Gemini] Overriding AI logo with DB logo: ${branding.logoUrl} `);
        parsedResult.logoUrl = branding.logoUrl;
      }
      if (branding.primaryColor) parsedResult.primaryColor = branding.primaryColor;
      if (branding.secondaryColor) parsedResult.secondaryColor = branding.secondaryColor;
    }
  }

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
    id: `athlete - ${idx} -${Date.now()} `,
    originalName: a.fullName || "",
    fullName: a.fullName || "",
    displayNameSafe: toSafeName(a.fullName || ""),
    jerseyNumber: formatJerseyNumber(a.jerseyNumber).replace(/#/g, ''),
    position: (a.position || "?").replace(/#/g, ''),
    phoneticIPA: a.phoneticIPA || "",
    phoneticSimplified: a.phoneticSimplified || "",
    nilStatus: (a.nilStatus as NILStatus) || 'Active',
    seasonYear: extractedSeason,
    nameSpanish: a.nameSpanish,
    nameMandarin: a.nameMandarin,
    bioStats: a.bioStats,
    socialHandle: a.socialHandle
  }));
  // Check branding cache if branding was enabled
  let finalBranding = {
    primaryColor: parsedResult.primaryColor || "#5B5FFF",
    secondaryColor: parsedResult.secondaryColor || "#1A1A1A",
    conference: parsedResult.conference || "General",
    abbreviation: parsedResult.teamName === "Unknown Team" ? "" : (parsedResult.abbreviation || "---"),
    logoUrl: parsedResult.logoUrl
  };

  // PRIORITY: Check hardcoded known teams first (most reliable)
  // Normalize team name: uppercase, trim, and REMOVE YEARS (e.g. "San Diego FC 2025" -> "SAN DIEGO FC")
  // This prevents year inputs from breaking exact matches
  // Priority: manualTeamName (user selected) > AI extracted teamName
  const teamNameUpper = (manualTeamName || parsedResult.teamName || "")
    .toUpperCase()
    .replace(/\b20\d{2}(-20\d{2})?\b/g, '') // Remove 2024, 2025, 2024-25
    .trim()
    .replace(/\s+/g, ' ');
  console.log('[Gemini] Checking KNOWN_TEAM_LOGOS for:', teamNameUpper);

  let knownTeam = KNOWN_TEAM_LOGOS[teamNameUpper];

  // AMBIGUITY DETECTION: Even if we have an exact match, check if other teams contain the same substring
  // This handles cases like "KINGS" which matches LA Kings exactly but should prompt for Sacramento Kings too
  let candidateTeams: { name: string; logoUrl: string; primaryColor: string; secondaryColor: string; sport?: string; league?: string }[] = [];

  // Helper for disambiguation priority
  const getLeaguePriority = (league?: string, sport?: string): number => {
    if (!league) return 1;
    const l = league.toLowerCase();
    // Tier 1: Major Pro Leagues
    if (l.includes('nba') || l.includes('nfl') || l.includes('mlb') || l.includes('nhl') || l.includes('premier') || l.includes('mls') || l.includes('nwsl') || l.includes('wnba')) {
      return 3;
    }
    // Tier 2: Other Pro / Semi-Pro
    if (l.includes('usl') || l.includes('champions')) {
      return 2;
    }
    // Tier 3: Minor / College / Other
    return 1;
  };

  // Always check for ambiguity when the search term is reasonable length (< 60 chars)
  // Expanded from 20 to 60 to handle long team names + metadata
  // CRITICAL FIX: Skip ambiguity check if user MANUALLY selected the team
  if (!manualTeamName && teamNameUpper.length > 3 && teamNameUpper.length < 60) {
    const allKeys = Array.from(new Set([
      ...Object.keys(KNOWN_TEAM_LOGOS),
      ...Object.keys(ESPN_TEAM_IDS)
    ]));

    const allMatchingKeys = allKeys.filter(key =>
      key.includes(teamNameUpper) || teamNameUpper.includes(key)
    );

    if (allMatchingKeys.length > 0) {
      // Deduplicate by logoUrl (same logo = same team, different aliases)
      const uniqueTeams = new Map<string, { name: string; logoUrl: string; primaryColor: string; secondaryColor: string; sport?: string; league?: string }>();

      for (const key of allMatchingKeys) {
        const team = KNOWN_TEAM_LOGOS[key] || ESPN_TEAM_IDS[key];
        const espnData = ESPN_TEAM_IDS[key]; // Look up sport/league metadata

        const logoUrl = team?.logoUrl || '';

        if (team && logoUrl && !uniqueTeams.has(logoUrl)) {
          uniqueTeams.set(logoUrl, {
            name: toTitleCase(key),
            logoUrl: logoUrl,
            primaryColor: team.primaryColor || '',
            secondaryColor: team.secondaryColor || '',
            sport: espnData?.sport || (team as any).sport,
            league: espnData?.league || (team as any).league
          });
        }
      }

      // Sort keys by Priority (Major League first) then Length (Longest match first)
      const sortedKeys = allMatchingKeys.sort((a, b) => {
        // ULTIMATE PRIORITY: Exact Match
        if (a === teamNameUpper) return -1;
        if (b === teamNameUpper) return 1;

        const teamObjA = KNOWN_TEAM_LOGOS[a] || ESPN_TEAM_IDS[a];
        const teamObjB = KNOWN_TEAM_LOGOS[b] || ESPN_TEAM_IDS[b];

        if (!teamObjA || !teamObjB) return 0;

        const teamA = uniqueTeams.get(teamObjA.logoUrl);
        const teamB = uniqueTeams.get(teamObjB.logoUrl);

        const priorityA = getLeaguePriority(teamA?.league, teamA?.sport);
        const priorityB = getLeaguePriority(teamB?.league, teamB?.sport);

        if (priorityA !== priorityB) {
          return priorityB - priorityA; // Descending priority (3 > 1)
        }
        return b.length - a.length;
      });

      // If multiple DISTINCT teams match, return them as candidates for user selection
      if (uniqueTeams.size > 1) {
        candidateTeams = Array.from(uniqueTeams.values());
        // Sort candidates for UI presentation
        candidateTeams.sort((a, b) => {
          const priorityA = getLeaguePriority(a.league, a.sport);
          const priorityB = getLeaguePriority(b.league, b.sport);
          if (priorityA !== priorityB) return priorityB - priorityA;
          return b.name.length - a.name.length;
        });

        console.log(`[Gemini] AMBIGUITY DETECTED for "${teamNameUpper}": ${candidateTeams.map(t => `${t.name} (L:${t.league})`).join(', ')} `);

        // Pick the best match (highest priority + longest name) as default
        knownTeam = KNOWN_TEAM_LOGOS[sortedKeys[0]] || ESPN_TEAM_IDS[sortedKeys[0]];

      } else if (uniqueTeams.size === 1 && !knownTeam) {
        // Single team (possibly with aliases) and no exact match - use fuzzy result
        const bestMatch = sortedKeys[0];
        console.log(`[Gemini] Fuzzy match found: "${teamNameUpper}" -> "${bestMatch}"`);
        knownTeam = KNOWN_TEAM_LOGOS[bestMatch] || ESPN_TEAM_IDS[bestMatch];
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
  const teamNameForLookup = manualTeamName || parsedResult.teamName || "";
  const {
    updatedAthletes: athletesWithJerseys,
    officialCount,
    matchedCount,
    missingAthletes
  } = await fillMissingJerseyNumbers(athletes, teamNameForLookup, league);

  // Standardize Sport/League from MiLB or ESPN ID Mapping
  // IMPORTANT: Only do this if there are NO candidate teams (no ambiguity)
  // If candidateTeams exist, the user will select from the modal and that selection
  // will have the correct sport/league metadata already attached
  let standardizedSport = parsedResult.sport || "";

  // Guard: For Olympics (NOC Mode), do not overwrite the AI's sport/gender string
  if (candidateTeams.length <= 1) {
    // PRIORITY 1: Check if a MiLB or Pro league was explicitly selected
    if (league && league !== 'ncaa' && LEAGUE_TO_SPORT[league]) {
      standardizedSport = LEAGUE_TO_SPORT[league];
      console.log(`[Gemini] Standardized sport from user - selected league: ${standardizedSport} `);
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
          console.log(`[Gemini] Standardized sport from ESPN ID: ${standardizedSport} `);
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
  // 3. User manual selection from modal (fallback)
  let finalLeague = parsedResult.league || (league ? (LEAGUE_DISPLAY_NAMES[league] || league) : undefined);

  if (!finalLeague && candidateTeams.length <= 1) {
    // Re-resolve identity if needed (to be safe/clean access) or just use the logic flow.
    // Since we scoped espnIdentity inside the `else ` block above, we need to re-access or restructure.
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

  // NEW: If team is Unknown and league is selected, populate all teams for user selection
  if (parsedResult.teamName === "Unknown Team" && league) {
    console.log(`[Gemini] Team is Unknown, populating all teams for league: ${league}`);
    // Normalize league ID to handle both formats: "nwsl" and "usa.nwsl"
    const normalizedInputLeague = league.replace(/^usa\./, '');
    candidateTeams = Object.entries(ESPN_TEAM_IDS)
      .filter(([_, info]) => {
        const normalizedTeamLeague = (info.league || '').replace(/^usa\./, '');
        return normalizedTeamLeague === normalizedInputLeague;
      })
      .map(([name, info]) => ({
        id: info.id,
        name: name,
        league: info.league,
        logoUrl: info.logoUrl,
        sport: info.sport,
        primaryColor: info.primaryColor,
        secondaryColor: info.secondaryColor
      }));
    console.log(`[Gemini] Populated ${candidateTeams.length} teams for selection`);
  }

  // --- REFINED: Ensure standardizedSport is set even with ambiguity ---
  if (!standardizedSport) {
    if (league && LEAGUE_TO_SPORT[league.toLowerCase()]) {
      standardizedSport = LEAGUE_TO_SPORT[league.toLowerCase()];
      console.log(`[Gemini] Standardized sport from league override: ${standardizedSport} `);
    } else if (candidateTeams.length > 0) {
      const sports = new Set(candidateTeams.filter(t => t.sport).map(t => t.sport!.toLowerCase()));
      if (sports.size === 1) {
        const detected = Array.from(sports)[0];
        standardizedSport = detected.charAt(0).toUpperCase() + detected.slice(1);
        console.log(`[Gemini] Standardized sport inferred from candidates: ${standardizedSport} `);
      }
    }
  }

  console.log(`[Gemini] Final standardized sport for backfill: "${standardizedSport}" (from league: ${league})`);

  // SECOND PASS: Backfill phonetics for BOTH matched and missing athletes if user is on a premium tier
  // Stronger missing detection: handle empty, whitespace, "?", or "N/A"
  const isPhoneticMissing = (a: Athlete) => {
    const val = (a.phoneticSimplified || "").trim();
    return !val || val === "?" || val.toUpperCase() === "N/A";
  };

  const allPossibleAthletes = [...athletesWithJerseys, ...(missingAthletes || [])];
  const missingCount = allPossibleAthletes.filter(isPhoneticMissing).length;

  const isPremium = tier !== 'FREE';
  const shouldBackfill = isPremium && missingCount > 0;

  console.log(`[Gemini] Backfill check - Tier: ${tier}, IsPremium: ${isPremium}, Missing: ${missingCount}/${allPossibleAthletes.length}`);

  if (shouldBackfill) {
    console.log(`[Gemini] Phonetic gap detected. Triggering backfill pass with sport: "${standardizedSport}"...`);
    try {
      // Use all fullNames for context, but we only really need results for those missing them.
      // However, generateBatchPhonetics returns a map, so supplying all names is safer for context.
      const namesForPhonetics = allPossibleAthletes.map(a => a.fullName);
      console.log(`[Gemini] Batch generation requested for ${namesForPhonetics.length} players. Sample: ${namesForPhonetics.slice(0, 3).join(', ')}`);
      const phoneticsMap = await generateBatchPhonetics(namesForPhonetics, standardizedSport || "Baseball", tier);
      console.log(`[Gemini] Batch generation returned ${Object.keys(phoneticsMap).length} results. Correcting map for robust matching...`);

      // Build a normalized mapping for robust lookup
      const normalizedPhoneticsMap: Record<string, { phoneticSimplified: string; phoneticIPA: string }> = {};
      Object.entries(phoneticsMap).forEach(([name, data]) => {
        const norm = normalizePlayerName(name);
        normalizedPhoneticsMap[norm] = data;
        // console.log(`[Gemini] Map entry: "${name}" -> "${norm}"`);
      });

      // Merge phonetics back into BOTH athletesWithJerseys and missingAthletes
      let mergedCount = 0;
      const mergePhonetics = (list: Athlete[]) => {
        list.forEach(a => {
          const normName = normalizePlayerName(a.fullName);
          if (isPhoneticMissing(a) && normalizedPhoneticsMap[normName]) {
            a.phoneticSimplified = normalizedPhoneticsMap[normName].phoneticSimplified;
            a.phoneticIPA = normalizedPhoneticsMap[normName].phoneticIPA;
            mergedCount++;
          }
        });
      };

      mergePhonetics(athletesWithJerseys);
      if (missingAthletes) mergePhonetics(missingAthletes);

      console.log(`[Gemini] Backfill complete. Successfully merged guides for ${mergedCount} players.`);
    } catch (err) {
      console.error("[Gemini] Phonetic backfill failed:", err);
    }
  }

  console.log(`[Gemini] Finalizing return. Manual: "${manualTeamName}", Parsed: "${parsedResult.teamName}"`);

  return {
    teamName: manualTeamName || parsedResult.teamName || "Unknown Team",
    sport: standardizedSport,
    league: finalLeague || undefined,
    seasonYear: extractedSeason,
    athletes: athletesWithJerseys,
    verificationSources,
    candidateTeams: candidateTeams.length > 0 ? candidateTeams : undefined,
    teamMetadata: finalBranding,
    abbreviation: finalBranding.abbreviation, // Also include at root for easy UI access
    officialRosterCount: officialCount,
    pastedRosterCount: athletes.length,
    matchedRosterCount: matchedCount,
    missingAthletes: missingAthletes
  };
}

/**
 * Generates phonetics for a list of names in batch
 */
export async function generateBatchPhonetics(
  names: string[],
  sport: string,
  tier: SubscriptionTier = 'FREE'
): Promise<Record<string, { phoneticSimplified: string; phoneticIPA: string }>> {
  const apiKey = getApiKey();
  if (!apiKey || names.length === 0) return {};

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          results: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                phoneticSimplified: { type: SchemaType.STRING },
                phoneticIPA: { type: SchemaType.STRING }
              },
              required: ["name", "phoneticSimplified"]
            }
          }
        },
        required: ["results"]
      }
    }
  });

  const prompt = `Generate phonetic pronunciation guides for the following ${sport} players:
  [${names.join(', ')}]
  
  Guidelines:
  1. Return one entry for EVERY name provided in the list. Do not skip any players.
  2. Use 'phoneticSimplified' for a readable, capitalized-stress guide (e.g. 'fuh-NET-ik').
  ${tier === 'ENTERPRISE' ? "3. Use 'phoneticIPA' for standard International Phonetic Alphabet symbols." : "3. Leave 'phoneticIPA' as an empty string (IPA is only for ENTERPRISE tier)."}
  4. Accuracy is critical for ${sport} broadcast usage.
  5. Return a JSON object with a 'results' array.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const parsed = extractJSON(text);

    console.log(`[Gemini] Phonetic batch result for ${sport}: ${parsed.results?.length || 0} items returned.`);
    if (parsed.results && parsed.results.length > 0) {
      console.log(`[Gemini] First few results:`, parsed.results.slice(0, 2));
    }

    const mapping: Record<string, { phoneticSimplified: string; phoneticIPA: string }> = {};
    parsed.results?.forEach((r: any) => {
      // Use original name as key for easy mapping
      mapping[r.name] = {
        phoneticSimplified: r.phoneticSimplified || '',
        phoneticIPA: r.phoneticIPA || ''
      };
    });
    return mapping;
  } catch (error) {
    console.error('[Gemini] Batch phonetic generation failed:', error);
    return {};
  }
}
