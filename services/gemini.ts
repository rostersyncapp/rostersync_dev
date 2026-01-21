
import { GoogleGenAI, Type } from "@google/genai";
import { Athlete, NILStatus, SubscriptionTier } from "../types.ts";

// Helper to get the key even if the build tool is doing static analysis on process.env.API_KEY
const getApiKey = () => {
  return (process.env as any).API_KEY || (window as any).process?.env?.API_KEY;
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
  const str = num.toString().trim();
  // If it's a single digit, pad with 0
  if (/^\d$/.test(str)) {
    return `0${str}`;
  }
  return str;
}

function getSchemaForTier(tier: SubscriptionTier, isNocMode: boolean, findBranding: boolean): any {
  const baseAthleteProperties: Record<string, any> = {
    fullName: { type: Type.STRING },
    jerseyNumber: { type: Type.STRING, description: isNocMode ? "Bib number for the athlete. Always use two digits (pad with 0 if needed)." : "Jersey number. Always use two digits (pad with 0 if needed)." },
    position: { type: Type.STRING, description: isNocMode ? "Main sport/discipline (e.g. Swimming)." : "Player position." },
    nilStatus: { type: Type.STRING },
  };

  const requiredFields = ["fullName", "jerseyNumber", "position", "nilStatus"];

  if (isNocMode) {
    baseAthleteProperties.countryCode = { type: Type.STRING, description: "3-letter IOC Country Code (e.g. JAM, USA)." };
    baseAthleteProperties.event = { type: Type.STRING, description: "Specific event (e.g. 100m Butterfly)." };
  }

  if (tier !== 'BASIC') {
    baseAthleteProperties.phoneticSimplified = { type: Type.STRING };
  }

  if (tier === 'NETWORK') {
    baseAthleteProperties.nameSpanish = { type: Type.STRING };
    baseAthleteProperties.nameMandarin = { type: Type.STRING };
    baseAthleteProperties.bioStats = { type: Type.STRING, description: "Summary of Olympic achievements/medals or career stats." };
    baseAthleteProperties.socialHandle = { type: Type.STRING, description: "Likely social media handle (e.g. @name)." };
  }

  const rootProperties: Record<string, any> = {
    teamName: { type: Type.STRING, description: isNocMode ? "National Olympic Committee Name (e.g. Team Jamaica)." : "Team Name." },
    abbreviation: { type: Type.STRING, description: isNocMode ? "3-letter IOC Code." : "3-letter Team Abbreviation." },
    countryCode: { type: Type.STRING, description: "3-letter IOC Country Code." },
    conference: { type: Type.STRING },
    sport: { type: Type.STRING },
    seasonYear: { 
      type: Type.STRING, 
      description: "The specific season year or range found in the text (e.g. '2025-26', '2024-25', '2026')." 
    },
    athletes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: baseAthleteProperties,
        required: requiredFields,
      }
    }
  };

  const rootRequired = ["teamName", "sport", "seasonYear", "athletes", "abbreviation"];

  if (findBranding) {
    rootProperties.primaryColor = { type: Type.STRING, description: "The official primary hex color code for the team." };
    rootProperties.secondaryColor = { type: Type.STRING, description: "The official secondary hex color code for the team." };
    rootProperties.logoUrl = { type: Type.STRING, description: "Direct URL to the official team logo (preferably PNG/SVG)." };
    rootRequired.push("primaryColor", "secondaryColor");
  }

  return {
    type: Type.OBJECT,
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

  const ai = new GoogleGenAI({ apiKey });
  const schema = getSchemaForTier(tier, isNocMode, findBranding);

  const brandingInstruction = findBranding 
    ? "BRANDING DISCOVERY: Use Google Search to find the official team logo URL and their primary/secondary hex color codes. Ensure the logo URL is direct and high quality."
    : "Use default branding colors (#5B5FFF and #1A1A1A).";

  const systemInstruction = `You are an expert broadcast metadata extractor.
    - ${brandingInstruction}
    - NORMALIZE: Convert all athlete names to UPPERCASE and strip accents.
    - JERSEY NUMBERS: Always use at least two digits. Pad single digits with a leading zero (e.g., '3' becomes '03', '0' becomes '00').
    - OUTPUT: Valid JSON matching the schema provided.`;

  const config: any = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: schema,
  };

  if (findBranding) {
    config.tools = [{ googleSearch: {} }];
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Tier: ${tier}. Mode: ${isNocMode ? 'NOC' : 'Standard'}. Data: ${text}`,
    config,
  });

  if (!response.text) {
    throw new Error("AI returned no content.");
  }

  const result = JSON.parse(response.text.trim() || "{}");
  const extractedSeason = overrideSeason || result.seasonYear || new Date().getFullYear().toString();
  
  // Extract verification sources from grounding metadata if branding was used
  const verificationSources: { title: string; uri: string }[] = [];
  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
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

  const athletes: Athlete[] = (result.athletes || []).map((a: any, idx: number) => ({
    id: `athlete-${idx}-${Date.now()}`,
    originalName: a.fullName || "",
    fullName: a.fullName || "",
    displayNameSafe: toSafeName(a.fullName || ""),
    jerseyNumber: formatJerseyNumber(a.jerseyNumber),
    position: a.position || "?",
    phoneticIPA: "",
    phoneticSimplified: a.phoneticSimplified || "",
    nilStatus: (a.nilStatus as NILStatus) || 'Active',
    seasonYear: extractedSeason,
    nameSpanish: a.nameSpanish,
    nameMandarin: a.nameMandarin,
    bioStats: a.bioStats,
    socialHandle: a.socialHandle,
    countryCode: a.countryCode || result.countryCode,
    event: a.event
  }));

  return {
    teamName: result.teamName || (isNocMode ? "Unknown NOC" : "Unknown Team"),
    sport: result.sport || "General",
    seasonYear: extractedSeason,
    isNocMode: isNocMode,
    athletes: athletes,
    verificationSources,
    teamMetadata: {
      primaryColor: result.primaryColor || "#5B5FFF",
      secondaryColor: result.secondaryColor || "#1A1A1A",
      conference: result.conference || "General",
      abbreviation: result.abbreviation || "UNK",
      countryCode: result.countryCode,
      logoUrl: result.logoUrl 
    }
  };
}
