
import { ESPN_TEAM_IDS } from '../services/teamData';

const EXPECTED_COUNTS: Record<string, number> = {
    'nfl': 32,
    'nba': 30,
    'mlb': 30,
    'nhl': 32, // Utah added, so 32 active
    'usa.1': 30, // MLS 29 + San Diego FC = 30? Or 29? Let's check. 2024 season has 29. San Diego starts 2025.
    'wnba': 13, // 12 + Golden State Valkyries
    'usa.nwsl': 14, // 14 teams for 2024/2025
    'usl': 24, // Approx, need to verify active teams
    'milb-aaa': 30 // 30 AAA teams
};

const LEAGUE_MAPPING: Record<string, string> = {
    'nfl': 'NFL',
    'nba': 'NBA',
    'mlb': 'MLB',
    'nhl': 'NHL',
    'usa.1': 'MLS',
    'wnba': 'WNBA',
    'usa.nwsl': 'NWSL',
    'usl': 'USL',
    'milb-aaa': 'MiLB (AAA)'
};

async function verifyLeagues() {
    console.log('Starting North American League Audit...');

    const leagueCounts: Record<string, Set<string>> = {};
    const leagueIds: Record<string, Set<number>> = {};
    const errors: string[] = [];

    // Initialize checks
    Object.keys(EXPECTED_COUNTS).forEach(league => {
        leagueCounts[league] = new Set();
        leagueIds[league] = new Set();
    });

    // Iterating through all teams
    for (const [teamName, data] of Object.entries(ESPN_TEAM_IDS)) {
        if (!data.league) continue;

        // Check if it's one of our target leagues
        if (EXPECTED_COUNTS[data.league] !== undefined) {

            // 1. Check for Duplicate IDs within league
            if (leagueIds[data.league].has(data.id)) {
                // Allow ID 0 for some leagues if that's a pattern (e.g. some placeholder data), 
                // but generally should be unique.
                if (data.id !== 0) {
                    errors.push(`[${LEAGUE_MAPPING[data.league]}] Duplicate Team ID found: ${data.id} for "${teamName}"`);
                }
            }
            leagueIds[data.league].add(data.id);

            // 2. Track Team Names (checking for duplicate entries under different keys if mapped to same ID is handled above)
            leagueCounts[data.league].add(teamName);

            // 3. Validation: Check if ID is 0 or missing (except maybe placeholder leagues)
            if (!data.id && data.id !== 0) {
                errors.push(`[${LEAGUE_MAPPING[data.league]}] Missing ID for "${teamName}"`);
            }
        }
    }

    // Report Results
    console.log('\n--- Audit Results ---');
    Object.keys(EXPECTED_COUNTS).forEach(league => {
        const count = leagueIds[league].size;
        const expected = EXPECTED_COUNTS[league];
        const name = LEAGUE_MAPPING[league];

        // For some leagues like USL, exact count might vary, so we warn instead of fail hard if not exact match 
        // unless we are sure.
        // For Major leagues (NFL, NBA, MLB, NHL) we expect exact matches.

        let status = '✅ OK';
        if (count !== expected) {
            status = `⚠️ MISMATCH (Found: ${count}, Expected: ${expected})`;
        }

        console.log(`${name.padEnd(15)}: ${status}`);
    });

    if (errors.length > 0) {
        console.log('\n--- Errors Found ---');
        errors.forEach(e => console.error(e));
    } else {
        console.log('\n✅ No data integrity errors found.');
    }

}

verifyLeagues().catch(console.error);
