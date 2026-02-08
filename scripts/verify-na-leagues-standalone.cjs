const fs = require('fs');
const path = require('path');

const TEAM_DATA_PATH = path.join(__dirname, '../services/teamData.ts');

const EXPECTED_COUNTS = {
    'nfl': 32,
    'nba': 30,
    'mlb': 30,
    'nhl': 32,
    'usa.1': 30, // MLS (including San Diego FC)
    'wnba': 13, // WNBA (including Golden State Valkyries)
    'usa.nwsl': 14, // NWSL
    'usl': 24, // USL Championship
    'milb-aaa': 30, // MiLB Triple-A
    'ncaa': 134, // NCAA Football (approximate)
};

const LEAGUE_NAMES = {
    'nfl': 'NFL',
    'nba': 'NBA',
    'mlb': 'MLB',
    'nhl': 'NHL',
    'usa.1': 'MLS',
    'wnba': 'WNBA',
    'usa.nwsl': 'NWSL',
    'usl': 'USL',
    'milb-aaa': 'MiLB (AAA)',
    'ncaa': 'NCAA Football',
};

function verifyLeagues() {
    console.log('Reading team data from:', TEAM_DATA_PATH);

    try {
        const fileContent = fs.readFileSync(TEAM_DATA_PATH, 'utf8');

        const espnTeamIdsMatch = fileContent.match(/export const ESPN_TEAM_IDS: Record<string, TeamLogoInfo> = {([\s\S]*?)};/);

        if (!espnTeamIdsMatch) {
            console.error('Could not find ESPN_TEAM_IDS block in file.');
            process.exit(1);
        }

        const dataBlock = espnTeamIdsMatch[1];

        const teamRegex = /"([^"]+)":\s*{[^}]*id:\s*(\d+)[^}]*league:\s*"([^"]+)"/g;

        const leagueCounts = {};
        const leagueTeams = {};

        let match;
        while ((match = teamRegex.exec(dataBlock)) !== null) {
            const teamName = match[1];
            const teamId = parseInt(match[2], 10);
            const league = match[3];

            if (!leagueCounts[league]) {
                leagueCounts[league] = new Set();
                leagueTeams[league] = [];
            }

            // key by ID to avoid duplicates in list, or just push and filter later
            // We want to know which Teams (Names) correspond to IDs.
            // Since multiple names map to same ID, we might want to list all names for an ID.

            leagueCounts[league].add(teamId);
            leagueTeams[league].push({ name: teamName, id: teamId });
        }

        console.log('\n--- North American League Audit ---\n');

        const naLeagues = Object.keys(EXPECTED_COUNTS);
        let hasErrors = false;

        naLeagues.forEach(league => {
            const displayName = LEAGUE_NAMES[league] || league;
            const count = leagueCounts[league] ? leagueCounts[league].size : 0;
            const expected = EXPECTED_COUNTS[league];

            console.log(`${displayName} (${league}):`);
            console.log(`  Found: ${count}`);
            console.log(`  Expected: ${expected}`);

            if (count !== expected) {
                console.log(`  ⚠️  MISMATCH!`);
                console.log(`  Teams found:`);

                // Group names by ID
                const teamsById = {};
                if (leagueTeams[league]) {
                    leagueTeams[league].forEach(t => {
                        if (!teamsById[t.id]) teamsById[t.id] = [];
                        teamsById[t.id].push(t.name);
                    });
                }

                Object.keys(teamsById).forEach(id => {
                    console.log(`    - ID: ${id} | Names: ${teamsById[id].join(', ')}`);
                });

                hasErrors = true;
            } else {
                console.log(`  ✅ OK`);
            }
            console.log('');
        });

        if (hasErrors) {
            console.log('\nAudit completed with WARNINGS/ERRORS.');
        } else {
            console.log('\nAudit completed SUCCESSFULLY.');
        }

    } catch (err) {
        console.error('Error reading or processing file:', err);
        process.exit(1);
    }
}

verifyLeagues();
