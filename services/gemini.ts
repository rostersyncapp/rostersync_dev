
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Athlete, NILStatus, SubscriptionTier } from "../types.ts";
import { getBrandingCache, saveBrandingCache, recordUsage, supabase } from "./supabase.ts";
import { KNOWN_TEAM_LOGOS, ESPN_TEAM_IDS, LEAGUE_DISPLAY_NAMES, LEAGUE_TO_SPORT, MILB_SPORT_IDS } from './teamData.ts';

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
async function fetchBrandingFromDB(name: string, league: string): Promise<{ logoUrl?: string; primaryColor?: string; secondaryColor?: string } | null> {
  if (!name || !supabase || name === 'Unknown Team') return null;

  const searchLeague = league.toLowerCase();

  // 1. Try exact match first
  const { data } = await supabase
    .from('teams')
    .select('logo_url, primary_color, secondary_color')
    .eq('league', searchLeague)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (data) {
    console.log(`[Supabase] Found authoritative branding for ${name}`);
    return {
      logoUrl: data.logo_url,
      primaryColor: data.primary_color || undefined,
      secondaryColor: data.secondary_color || undefined
    };
  }

  // 2. Try looking in alt_names array if exact match fails
  const { data: altData } = await supabase
    .from('teams')
    .select('logo_url, primary_color, secondary_color')
    .eq('league', searchLeague)
    .contains('alt_names', [name])
    .limit(1)
    .maybeSingle();

  if (altData) {
    console.log(`[Supabase] Found authoritative branding via alt_name for ${name}`);
    return {
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
    'premier-league', 'la-liga', 'bundesliga', 'serie-a', 'ligue-1', 'eredivisie', 'liga-mx', 'mls',
  ];

  const isMajorLeague = league && FULLY_SEEDED_LEAGUES.includes(league);

  // Force disable branding search if we know we have the data
  const shouldSearchForBranding = findBranding && !isMajorLeague;

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

  const systemInstruction = `You are an expert broadcast metadata extractor. Your PRIMARY GOAL is to identify the team and extract the roster.
    
    1. TEAM IDENTIFICATION (HIGHEST PRIORITY):
    - ${leagueHint}
    - Identification Strategy:
      * Use the 'googleSearch' tool ONLY if the team name is not obvious from the text.
      * Look at the player names. If you see "Sacramento" or "River Cats" - this is ALWAYS the "Sacramento River Cats" baseball team.
      * If you see "Sydney Leroux", "Christen Press", "Alyssa Thompson", "Sarah Gorden", "Gisele Thompson", "Claire Emslie", or "M.A. Vignola" - this is ALWAYS "Angel City FC" (NWSL).
      * If you see "Naomi Girma", "Jaedyn Shaw", "Kailen Sheridan", "Maria Sanchez", "Alex Morgan", "Abby Dahlkemper", or "Delphine Cascarino" - this is ALWAYS "San Diego Wave FC" (NWSL).
      * If you see "Marta", "Trinity Rodman", or "Rose Lavelle" - this is a professional women's soccer team (likely NWSL).
      * MANDATORY: Do not return "Unknown Team" if "Angel City", "ACFC", "Gotham", "Thorns", "Wave", "Spirit", "Sacramento", or "River Cats" appears in the player names or header.
      * IGNORE Major League affiliates (e.g. "Affiliate of the Giants"). Always pick the MiLB club name.
    - MiLB VALIDATION LIST (Reference these EXACT names):
      [Buffalo Bisons, Charlotte Knights, Columbus Clippers, Durham Bulls, Gwinnett Stripers, Indianapolis Indians, Iowa Cubs, Jacksonville Jumbo Shrimp, Lehigh Valley IronPigs, Louisville Bats, Memphis Redbirds, Nashville Sounds, Norfolk Tides, Omaha Storm Chasers, Rochester Red Wings, Scranton/Wilkes-Barre RailRiders, St. Paul Saints, Syracuse Mets, Toledo Mud Hens, Worcester Red Sox, Albuquerque Isotopes, El Paso Chihuahuas, Las Vegas Aviators, Oklahoma City Comets, Reno Aces, Round Rock Express, Sacramento River Cats, Salt Lake Bees, Sugar Land Space Cowboys, Tacoma Rainiers]
    - NWSL VALIDATION LIST (Reference these EXACT names):
      [Angel City FC, Bay FC, Boston Legacy FC, Chicago Stars FC, Denver Summit FC, Houston Dash, Kansas City Current, NJ/NY Gotham FC, North Carolina Courage, Orlando Pride, Portland Thorns FC, Racing Louisville FC, San Diego Wave FC, Seattle Reign FC, Utah Royals, Washington Spirit]
    
    - SEARCH STRATEGY:
      * If unknown, pick 3 athletes. Search Google for: "{Name 1}" "{Name 2}" "{Name 3}" roster.
      * Pinpoint the specific professional team (MiLB, NWSL, USL, MLS, etc.). 
      * Once identified, STOP searching. Do NOT search for logos or colors.
    - VALIDATION: Ensure at least 3 names from the input match the identified team's official roster.
    - DO NOT return "Unknown Team" without attempting a player-based search.

    2. ROSTER EXTRACTION (MANDATORY):
    - SOURCE DATA: You MUST extract the athletes from the literal 'DATA' provided in the user message, NOT from your search tool results.
    - SEARCH VS EXTRACTION: The 'googleSearch' tool is ONLY for identifying the 'teamName'. Once identified, you MUST go back to the 'DATA' and extract every athlete listed.
    - DO NOT return an empty 'athletes' array if there are names listed in the input.
    - CLEANING INPUT: The input text may have artifacts like "NAME01" (name + jersey number). You MUST separate them -> Name: "NAME", Jersey: "01".
    - NORMALIZE: Convert all athlete names to UPPERCASE and strip accents.
    - JERSEY NUMBERS: Always use at least two digits. Pad single digits with a leading zero (e.g., '3' becomes '03', '0' becomes '00').
    - SPORT INFERENCE: If the sport is not explicitly named, INFER it from the positions.

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
  };

  if (!shouldSearchForBranding) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = schema;
  }
  modelParams.generationConfig = generationConfig;

  // Only enable tools if we REALLY need to search for branding, or if checking a completely unknown league/NOC
  if (shouldSearchForBranding) {
    modelParams.tools = [{ googleSearch: {} }];
  }


  const context = league ? `Context: League is ${league}.` : '';
  let result;
  try {
    const model = genAI.getGenerativeModel(modelParams);
    const userPrompt = `DATA:\n${text}\n\n${context}\nTier: ${tier}. Mode: ${isNocMode ? 'NOC' : 'Standard'}.\n\n` +
      `FINAL INSTRUCTIONS:\n` +
      `1. Identification: Use 'googleSearch' to identify the team name (e.g. "Sacramento River Cats") by searching for the athletes in 'DATA'.\n` +
      `2. Extraction: CRITICAL - You MUST extract EVERY SINGLE athlete from the 'DATA' block into the JSON results. Do not return an empty athletes list.\n` +
      `3. Return ONLY valid JSON. No conversational text.`;

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
      if (typeof parsedResult[key] === 'string') {
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

  // Helper for disambiguation priority
  const getLeaguePriority = (league?: string, sport?: string): number => {
    if (!league) return 1;
    const l = league.toLowerCase();
    // Tier 1: Major Pro Leagues
    if (l.includes('nba') || l.includes('nfl') || l.includes('mlb') || l.includes('nhl') || l.includes('premier') || l.includes('mls') || l.includes('wnba') || l.includes('mex.1') || l.includes('eng.1') || l.includes('ger.1') || l.includes('esp.1') || l.includes('ita.1') || l.includes('fra.1') || l.includes('ned.1')) {
      return 3;
    }
    // Tier 2: Other Pro / Semi-Pro
    if (l.includes('usl') || l.includes('champions')) {
      return 2;
    }
    // Tier 3: Minor / College / Other
    return 1;
  };

  // Always check for ambiguity when the search term is short enough to be ambiguous (< 20 chars)
  if (teamNameUpper.length > 3 && teamNameUpper.length < 20) {
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
            name: key,
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
  let standardizedSport = parsedResult.sport || "";

  if (candidateTeams.length <= 1) {
    // PRIORITY 1: Check if a MiLB league was explicitly selected
    if (league && LEAGUE_TO_SPORT[league]) {
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
