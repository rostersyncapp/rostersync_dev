
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Mapping from internal team_id to Hockey-Reference abbreviation
const HREF_TEAM_CODES: Record<string, string> = {
    'anaheim-ducks': 'ANA',
    'boston-bruins': 'BOS',
    'buffalo-sabres': 'BUF',
    'calgary-flames': 'CGY',
    'carolina-hurricanes': 'CAR',
    'chicago-blackhawks': 'CHI',
    'colorado-avalanche': 'COL',
    'columbus-blue-jackets': 'CBJ',
    'dallas-stars': 'DAL',
    'detroit-red-wings': 'DET',
    'edmonton-oilers': 'EDM',
    'florida-panthers': 'FLA',
    'los-angeles-kings': 'LAK',
    'minnesota-wild': 'MIN',
    'montreal-canadiens': 'MTL',
    'nashville-predators': 'NSH',
    'new-jersey-devils': 'NJD',
    'new-york-islanders': 'NYI',
    'new-york-rangers': 'NYR',
    'ottawa-senators': 'OTT',
    'philadelphia-flyers': 'PHI',
    'pittsburgh-penguins': 'PIT',
    'san-jose-sharks': 'SJS',
    'seattle-kraken': 'SEA',
    'st-louis-blues': 'STL',
    'tampa-bay-lightning': 'TBL',
    'toronto-maple-leafs': 'TOR',
    'utah-hockey-club': 'UTA',
    'vancouver-canucks': 'VAN',
    'vegas-golden-knights': 'VEG',
    'washington-capitals': 'WSH',
    'winnipeg-jets': 'WPG'
};

function normalizeName(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function enrichNHLRoster(teamId: string, year: number) {
    const hrefCode = HREF_TEAM_CODES[teamId];
    if (!hrefCode) {
        console.warn(`No HRef code for ${teamId}`);
        return;
    }

    const url = `https://www.hockey-reference.com/teams/${hrefCode}/numbers.html`;
    console.log(`\n🔍 Fetching HRef uniform numbers for ${teamId}...`);
    console.log(`🔗 ${url}`);

    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const numberMappings: Record<string, Record<string, string>> = {};

        // Parse the leaderboard blocks (grid of uniform numbers)
        $('div[id^="leaderboard_number-"]').each((_, el) => {
            // The number is usually the first text node or in an h2
            const numberText = $(el).find('h2').text().trim() || $(el).attr('id')?.replace('leaderboard_number-', '');
            if (!numberText) return;

            $(el).find('table tbody tr td.single').each((_, td) => {
                const playerLink = $(td).find('a').first();
                const playerName = normalizeName(playerLink.text().trim());
                const yearsText = $(td).find('span.desc').text().trim();

                if (playerName && yearsText) {
                    // yearsText looks like "(1951)", "(1951, 1953)", or "(2000-2005)"
                    // We need to parse this to see if it matches our target year
                    const yearsStr = yearsText.replace(/[()]/g, '');
                    const parts = yearsStr.split(',').map(s => s.trim());

                    let matches = false;
                    for (const part of parts) {
                        if (part.includes('-')) {
                            const [start, end] = part.split('-').map(s => parseInt(s.trim()));
                            if (year >= start && year <= end) matches = true;
                        } else {
                            if (parseInt(part) === year) matches = true;
                        }
                    }

                    if (matches) {
                        if (!numberMappings[year]) numberMappings[year] = {};
                        // Note: If multiple players wore the same number in a year, this only picks one
                        // but BRef/HRef usually lists them all. We'll store it by name.
                        numberMappings[year][playerName] = numberText;
                    }
                }
            });
        });

        const playerToNumber = numberMappings[year] || {};
        console.log(`  Found ${Object.keys(playerToNumber).length} players with numbers for ${year}.`);

        if (Object.keys(playerToNumber).length === 0) {
            console.warn(`  ⚠️ No numbers found for ${teamId} in ${year}.`);
            return;
        }

        // Fetch local records that need updating
        const { data: localRoster, error: fetchError } = await supabase
            .from('nhl_rosters')
            .select('player_name, jersey_number')
            .eq('team_id', teamId)
            .eq('season_year', year);

        if (fetchError) {
            console.error(`  ❌ Error fetching local roster:`, fetchError.message);
            return;
        }

        let updateCount = 0;
        for (const player of localRoster || []) {
            const normalized = normalizeName(player.player_name);
            const jersey = playerToNumber[normalized];

            if (jersey && (!player.jersey_number || player.jersey_number === '' || player.jersey_number === '00')) {
                const { error: updateError } = await supabase
                    .from('nhl_rosters')
                    .update({ jersey_number: jersey })
                    .match({
                        team_id: teamId,
                        season_year: year,
                        player_name: player.player_name
                    });

                if (updateError) {
                    console.error(`  ❌ Error updating ${player.player_name}:`, updateError.message);
                } else {
                    updateCount++;
                }
            }
        }

        console.log(`  ✅ Updated ${updateCount} players for ${teamId} ${year}.`);

    } catch (err: any) {
        console.error(`  ❌ Error for ${teamId}:`, err.message);
    }
}

async function main() {
    console.log('📊 Querying database for NHL roster gaps...');

    // Fallback: Exhaustive search for gaps
    const years = Array.from({ length: 27 }, (_, i) => 2026 - i);
    const teams = Object.keys(HREF_TEAM_CODES);

    const uniqueGaps = [];
    for (const year of years) {
        for (const team of teams) {
            const { count, error: countError } = await supabase
                .from('nhl_rosters')
                .select('*', { count: 'exact', head: true })
                .eq('team_id', team)
                .eq('season_year', year)
                .or('jersey_number.is.null,jersey_number.eq."",jersey_number.eq.00');

            if (!countError && count && count > 0) {
                uniqueGaps.push({ team, year });
            }
        }
    }

    console.log(`📍 Found ${uniqueGaps.length} team-season combinations with missing jerseys.`);

    // Group by team to avoid re-fetching the same /numbers.html page multiple times
    const teamGroups: Record<string, number[]> = {};
    for (const gap of uniqueGaps) {
        if (!teamGroups[gap.team]) teamGroups[gap.team] = [];
        teamGroups[gap.team].push(gap.year);
    }

    for (const teamId in teamGroups) {
        const years = teamGroups[teamId];
        // For HRef, the /numbers.html page contains the entire history.
        // We can fetch it once and process all years for that team.
        // Let's refine the enrich function slightly or just call it per year (simple but slower)
        for (const year of years) {
            await enrichNHLRoster(teamId, year);
            // Throttle to respect HRef
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    console.log('\n🏁 NHL Jersey Enrichment complete.');
}

main();
