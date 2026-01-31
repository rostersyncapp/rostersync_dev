
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { KNOWN_TEAM_LOGOS, ESPN_TEAM_IDS } from '../services/teamData.ts';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Mapping from ESPN_TEAM_IDS league code to Database league slug
const LEAGUE_SLUG_MAP: Record<string, string> = {
    // Soccer
    'eng.1': 'premier-league',
    'esp.1': 'la-liga',
    'ger.1': 'bundesliga',
    'ita.1': 'serie-a',
    'fra.1': 'ligue-1',
    'usa.1': 'mls',
    'mex.1': 'liga-mx',
    'ned.1': 'eredivisie',
    'usa.nwsl': 'nwsl',

    // US Sports
    'nba': 'nba',
    'wnba': 'wnba',
    'nfl': 'nfl',
    'mlb': 'mlb',
    'nhl': 'nhl',
    'college-football': 'college-football',
    'mens-college-basketball': 'mens-college-basketball',

    // Others
    'f1': 'formula-1',
    'ipl': 'ipl',
    'euroleague': 'euroleague',
};

// Helper: normalize name for comparison
const normalize = (s: string) => s.toLowerCase().trim();

async function seedAllTeams() {
    console.log('Starting full team seeding...');

    // 1. Group teams by ID + League (The "Canonical" Team)
    const canonicalTeams: Record<string, {
        espnId: number;
        leagueCode: string; // e.g. 'eng.1'
        names: Set<string>; // All aliases found
        primaryName?: string;
        logoUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
    }> = {};

    // Map ESPN_TEAM_IDS
    for (const [name, meta] of Object.entries(ESPN_TEAM_IDS)) {
        const key = `${meta.league}:${meta.id}`;
        if (!canonicalTeams[key]) {
            canonicalTeams[key] = {
                espnId: meta.id,
                leagueCode: meta.league,
                names: new Set()
            };
        }
        canonicalTeams[key].names.add(name);
    }

    // 2. Enrich with Logos/Colors and determine Primary Name
    for (const groupKey in canonicalTeams) {
        const group = canonicalTeams[groupKey];

        // Find the best name and logo info
        // Strategy: Look for a name that exists in KNOWN_TEAM_LOGOS.
        // If multiple exist, prioritize the one that matches the ESPN name if possible, or usually the longest one is the full name.

        let bestName = '';
        let foundLogo = false;

        // Convert Set to Array and sort by length (descending) to prefer full names like "Manchester City" over "Man City"
        const aliases = Array.from(group.names).sort((a, b) => b.length - a.length);

        for (const alias of aliases) {
            if (!bestName) bestName = alias; // Default to first (longest)

            if (KNOWN_TEAM_LOGOS[alias]) {
                if (!foundLogo) {
                    group.logoUrl = KNOWN_TEAM_LOGOS[alias].logoUrl;
                    group.primaryColor = KNOWN_TEAM_LOGOS[alias].primaryColor;
                    group.secondaryColor = KNOWN_TEAM_LOGOS[alias].secondaryColor;
                    foundLogo = true;
                    // If we found a logo under this alias, update primary name to this alias strictly? 
                    // Often aliases in KNOWN_TEAM_LOGOS are good.
                    // But sometimes KNOWN_TEAM_LOGOS has "ARSENAL" and "GUNNERS". "ARSENAL" is better.
                    // Since we sorted by length, we likely visited "ARSENAL" before "GUNNERS" ? No "THE GUNNERS" is longer.

                    // Let's stick to the longest name found in ESPN_TEAM_IDS as the "Primary Name",
                    // But take branding from ANY alias.
                }
            }
        }

        // Convert uppercase keys to Title Case for DB?
        // DB names are currently "Paris Saint-Germain" etc.
        // teamData.ts keys are "PARIS SAINT-GERMAIN".
        // We should try to Title Case it carefully.
        group.primaryName = toTitleCase(bestName);
    }

    // 3. Prepare Upsert Payload
    const payload = [];

    for (const groupKey in canonicalTeams) {
        const group = canonicalTeams[groupKey];
        const dbLeague = LEAGUE_SLUG_MAP[group.leagueCode] || group.leagueCode; // Fallback to raw if not mapped

        if (!group.logoUrl) {
            console.log(`[WARN] Skipping ${group.primaryName} (${dbLeague}): No logo found.`);
            continue;
        }

        // Build Alt Names (exclude primary)
        const altNames = Array.from(group.names)
            .map(n => toTitleCase(n))
            .filter(n => n !== group.primaryName);

        payload.push({
            name: group.primaryName,
            league: dbLeague,
            logo_url: group.logoUrl,
            primary_color: group.primaryColor,
            secondary_color: group.secondaryColor,
            alt_names: altNames.length > 0 ? altNames : null
        });
    }

    console.log(`Prepared ${payload.length} unique teams for insertion.`);

    // 4. Upsert in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
            .from('teams')
            .upsert(batch, { onConflict: 'name, league' });

        if (error) {
            console.error(`Error inserting batch ${i}:`, error.message);
        } else {
            console.log(`Inserted batch ${i} - ${i + batch.length}`);
        }
    }

    console.log('Seeding complete.');
}

// Simple Title Case Helper
function toTitleCase(str: string) {
    return str.replace(
        /\w\S*/g,
        text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    )
        .replace(/\bFc\b/g, 'FC') // Fix common acronyms
        .replace(/\bSc\b/g, 'SC')
        .replace(/\bRb\b/g, 'RB')
        .replace(/\bPsg\b/g, 'PSG')
        .replace(/\bNyc\b/g, 'NYC')
        .replace(/\bNy\b/g, 'NY')
        .replace(/\bLa\b/g, 'LA')
        .replace(/\bDc\b/g, 'DC');
}

seedAllTeams().catch(console.error);
