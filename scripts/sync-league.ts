
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ESPN_TEAM_IDS, KNOWN_TEAM_LOGOS } from '../services/teamData.ts';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Map common leagues to their ESPN sport/league path
const SPORT_MAP: Record<string, string> = {
    'nfl': 'football/nfl',
    'nba': 'basketball/nba',
    'mlb': 'baseball/mlb',
    'nhl': 'hockey/nhl',
    'wnba': 'basketball/wnba',
    'college-football': 'football/college-football',
    'mens-college-basketball': 'basketball/mens-college-basketball',
    // Soccer leagues use soccer/:league
};

// Database league slug map (consistency with seed-all-teams.ts)
const DB_LEAGUE_MAP: Record<string, string> = {
    'eng.1': 'premier-league',
    'esp.1': 'la-liga',
    'ger.1': 'bundesliga',
    'ita.1': 'serie-a',
    'fra.1': 'ligue-1',
    'usa.1': 'mls',
    'mex.1': 'liga-mx',
    'ned.1': 'eredivisie',
    'nfl': 'nfl',
    'nba': 'nba',
    'mlb': 'mlb',
    'nhl': 'nhl',
    'wnba': 'wnba',
    'college-football': 'college-football',
    'mens-college-basketball': 'mens-college-basketball',
    'f1': 'formula-1',
    'ipl': 'ipl'
};

async function syncLeague(leaguePath: string) {
    const isSoccer = leaguePath.includes('.') || !SPORT_MAP[leaguePath];
    const fullPath = isSoccer ? `soccer/${leaguePath}` : SPORT_MAP[leaguePath];
    const url = `http://site.api.espn.com/apis/site/v2/sports/${fullPath}/teams?limit=1000`;

    console.log(`\n--- Syncing League: ${leaguePath} ---`);
    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const espnTeams = data.sports[0].leagues[0].teams;
        console.log(`Found ${espnTeams.length} teams on ESPN.\n`);

        // Get DB state
        const dbSlug = DB_LEAGUE_MAP[leaguePath] || leaguePath;
        const { data: dbTeams, error: dbError } = await supabase
            .from('teams')
            .select('name, logo_url')
            .eq('league', dbSlug);

        if (dbError) throw dbError;

        const espnTeamIds = new Set(espnTeams.map((e: any) => parseInt(e.team.id)));
        const dbTeamNames = new Set((dbTeams || []).map(t => t.name.toUpperCase()));

        const missingFromConfig: any[] = [];
        const missingFromDB: any[] = [];

        for (const entry of espnTeams) {
            const team = entry.team;
            const name = team.displayName.toUpperCase();
            const id = parseInt(team.id);
            const logo = team.logos?.[0]?.href;
            const color = team.color ? `#${team.color}` : '#000000';
            const altColor = team.alternateColor ? `#${team.alternateColor}` : '#ffffff';

            // Check if in ESPN_TEAM_IDS
            const inConfigId = Object.values(ESPN_TEAM_IDS).some(
                v => v.id === id && v.league === leaguePath
            );

            // Check if in KNOWN_TEAM_LOGOS
            const inConfigLogos = !!KNOWN_TEAM_LOGOS[name];

            if (!inConfigId || !inConfigLogos) {
                missingFromConfig.push({ name, id, logo, color, altColor });
            }

            if (!dbTeamNames.has(name)) {
                missingFromDB.push(name);
            }
        }

        // Logic for Relegations/Stale Teams
        const staleTeams: string[] = [];
        if (dbTeams) {
            for (const dbTeam of dbTeams) {
                // We need to check if ANY of our config aliases for this DB team match an ESPN ID
                // But simplified: check if DB team exists in current ESPN list (by name or cross-referencing config)
                // For now, let's just check if the name is in the ESPN set.
                if (!espnTeams.some((e: any) => e.team.displayName.toUpperCase() === dbTeam.name.toUpperCase())) {
                    staleTeams.push(dbTeam.name);
                }
            }
        }

        if (missingFromConfig.length > 0) {
            console.log(`⚠️  ${missingFromConfig.length} Teams Missing from teamData.ts:`);

            console.log('\n--- Paste into KNOWN_TEAM_LOGOS ---');
            missingFromConfig.forEach(t => {
                console.log(`  "${t.name}": { logoUrl: "${t.logo}", primaryColor: "${t.color}", secondaryColor: "${t.altColor}" },`);
            });

            console.log('\n--- Paste into ESPN_TEAM_IDS ---');
            missingFromConfig.forEach(t => {
                const sport = fullPath.split('/')[0];
                console.log(`  "${t.name}": { id: ${t.id}, sport: "${sport}", league: "${leaguePath}" },`);
            });
        } else {
            console.log('✅ All ESPN teams are already in teamData.ts');
        }

        if (missingFromDB.length > 0) {
            console.log(`\n⚠️  ${missingFromDB.length} Teams Missing from Database (Run seed script after updating config):`);
            missingFromDB.forEach(name => console.log(` - ${name}`));
        } else {
            console.log('✅ All teams are already in the Database');
        }

        if (staleTeams.length > 0) {
            console.log(`\n📉 ${staleTeams.length} Teams in DB but NOT in ESPN ${leaguePath} (Potential Relegations):`);
            staleTeams.forEach(name => console.log(` - ${name}`));
        }

    } catch (error: any) {
        console.error(`Error: ${error.message}`);
    }
}

const league = process.argv[2];
if (!league) {
    console.error('Please specify a league (e.g. nfl, esp.1, ita.1)');
    process.exit(1);
}

syncLeague(league).catch(console.error);
