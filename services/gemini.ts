
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Athlete, NILStatus, SubscriptionTier } from "../types.ts";
import { getBrandingCache, saveBrandingCache } from "./supabase.ts";

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
 * Ensures jersey numbers are at least two digits.
 * e.g. "3" -> "03", "12" -> "12", "0" -> "00"
 */
function formatJerseyNumber(num: any): string {
  if (num === undefined || num === null || num === "") return "00";
  const str = num.toString().replace(/#/g, '').trim();
  // If it's a single digit, pad with 0
  if (/^\d$/.test(str)) {
    return `0${str}`;
  }
  return str;
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
    rootProperties.primaryColor = { type: SchemaType.STRING, description: "The official primary hex color code for the team." };
    rootProperties.secondaryColor = { type: SchemaType.STRING, description: "The official secondary hex color code for the team." };
    rootProperties.logoUrl = { type: SchemaType.STRING, description: "Direct URL to the official team logo (preferably PNG/SVG)." };
    rootRequired.push("primaryColor", "secondaryColor");
  }

  return {
    type: SchemaType.OBJECT,
    properties: rootProperties,
    required: rootRequired
  };
}

export async function processRosterRawText(
  text: string,
  tier: SubscriptionTier = 'BASIC',
  isNocMode: boolean = false,
  overrideSeason: string = '',
  findBranding: boolean = false
): Promise<ProcessedRoster> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const schema = getSchemaForTier(tier, isNocMode, findBranding);

  const brandingInstruction = findBranding
    ? "BRANDING DISCOVERY: Query ESPN API at http://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/teams for team data including logos and colors. For logo URLs use ESPN CDN format: https://a.espncdn.com/combiner/i?img=/i/teamlogos/{league}/500/{teamcode}.png&h=200&w=200 (e.g. nhl/500/bos.png for Boston Bruins). For COLORS: Use teamcolorcodes.com or official team website. Example: Boston Bruins = Gold #FFB81C, Black #000000."
    : "Use default branding colors (#5B5FFF and #1A1A1A).";

  const systemInstruction = `You are an expert broadcast metadata extractor.
    - ${brandingInstruction}
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

  const result = await model.generateContent(`Tier: ${tier}. Mode: ${isNocMode ? 'NOC' : 'Standard'}. Data: ${text}`);
  const response = await result.response;
  const textResponse = response.text();

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

  // Debug: log branding data received from AI
  if (findBranding) {
    console.log('[Gemini] Branding data from AI:', {
      teamName: parsedResult.teamName,
      sport: parsedResult.sport,
      logoUrl: parsedResult.logoUrl,
      primaryColor: parsedResult.primaryColor,
      secondaryColor: parsedResult.secondaryColor,
      abbreviation: parsedResult.abbreviation
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

  if (findBranding && parsedResult.teamName && parsedResult.sport) {
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
        abbreviation: parsedResult.abbreviation || null
      });
    }
  }

  return {
    teamName: parsedResult.teamName || (isNocMode ? "Unknown NOC" : "Unknown Team"),
    sport: parsedResult.sport || "General",
    seasonYear: extractedSeason,
    isNocMode: isNocMode,
    athletes: athletes,
    verificationSources,
    teamMetadata: finalBranding
  };
}
