
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

// Mapping from internal team_id to Baseball-Reference abbreviation
const BREF_TEAM_CODES: Record<string, string> = {
    'arizona-diamondbacks': 'ARI',
    'atlanta-braves': 'ATL',
    'baltimore-orioles': 'BAL',
    'boston-red-sox': 'BOS',
    'chicago-cubs': 'CHC',
    'chicago-white-sox': 'CHW',
    'cincinnati-reds': 'CIN',
    'cleveland-guardians': 'CLE',
    'colorado-rockies': 'COL',
    'detroit-tigers': 'DET',
    'houston-astros': 'HOU',
    'kansas-city-royals': 'KCR',
    'los-angeles-angels': 'LAA',
    'los-angeles-dodgers': 'LAD',
    'miami-marlins': 'MIA',
    'milwaukee-brewers': 'MIL',
    'minnesota-twins': 'MIN',
    'new-york-mets': 'NYM',
    'new-york-yankees': 'NYY',
    'oakland-athletics': 'OAK',
    'philadelphia-phillies': 'PHI',
    'pittsburgh-pirates': 'PIT',
    'san-diego-padres': 'SDP',
    'san-francisco-giants': 'SFG',
    'seattle-mariners': 'SEA',
    'st-louis-cardinals': 'STL',
    'tampa-bay-rays': 'TBR',
    'texas-rangers': 'TEX',
    'toronto-blue-jays': 'TOR',
    'washington-nationals': 'WSN'
};

function normalizeName(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function enrichMLBRoster(teamId: string, year: number) {
    let brefCode = BREF_TEAM_CODES[teamId];
    if (!brefCode) {
        console.warn(`No BRef code for ${teamId}`);
        return;
    }

    // Handle historical team codes
    if (teamId === 'miami-marlins' && year <= 2011) {
        brefCode = 'FLA';
    }

    const url = `https://www.baseball-reference.com/teams/${brefCode}/${year}-uniform-numbers.shtml`;
    console.log(`\n🔍 Fetching BRef uniform numbers for ${teamId} (${year})...`);
    console.log(`🔗 ${url}`);

    try {
        const res = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(res.data);
        const numberMappings: Record<string, string> = {};

        // Parse the uniform numbers grid (BRef's current structure)
        $('div.thumb_grid.uni_holder > div').each((_, el) => {
            const number = $(el).find('svg text').text().trim();
            const playerLinks = $(el).find('div a');

            playerLinks.each((_, link) => {
                const playerName = normalizeName($(link).text().trim());
                if (playerName && number) {
                    // Only store the first number found for a player in a season
                    if (!numberMappings[playerName]) {
                        numberMappings[playerName] = number;
                    }
                }
            });
        });

        // Fallback: If grid not found, try the table structure (sometimes in comments/alternate views)
        if (Object.keys(numberMappings).length === 0) {
            $('table#uniform_numbers tbody tr, table#team_uni_history tbody tr').each((_, row) => {
                const number = $(row).find('th[data-stat="number"], td[data-stat="number"]').text().trim();
                const playerLinks = $(row).find('td[data-stat="player"] a, td[data-stat="players"] a');

                playerLinks.each((_, link) => {
                    const playerName = normalizeName($(link).text().trim());
                    if (playerName && number) {
                        if (!numberMappings[playerName]) {
                            numberMappings[playerName] = number;
                        }
                    }
                });
            });
        }

        console.log(`  Found ${Object.keys(numberMappings).length} players with numbers.`);

        // Fetch local records that need updating
        const { data: localRoster, error: fetchError } = await supabase
            .from('mlb_rosters')
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
            const jersey = numberMappings[normalized];

            if (jersey && (!player.jersey_number || player.jersey_number === '' || player.jersey_number === '00')) {
                const { error: updateError } = await supabase
                    .from('mlb_rosters')
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

        console.log(`  ✅ Updated ${updateCount} players.`);

    } catch (err: any) {
        console.error(`  ❌ Error for ${teamId} ${year}:`, err.message);
    }
}

async function main() {
    console.log('📊 Querying database for MLB roster gaps...');

    // Find all team/year combinations where at least one player is missing a jersey number
    // excluding '00' which is often a placeholder in current data
    const { data: gaps, error } = await supabase.rpc('get_mlb_roster_gaps');

    if (error) {
        // Fallback: Query the table for distinct gaps using a more robust approach
        console.warn('RPC not found, falling back to manual gap discovery...');

        const { data: manualGaps, error: manualError } = await supabase
            .from('mlb_rosters')
            .select('team_id, season_year')
            .or('jersey_number.is.null,jersey_number.eq."",jersey_number.eq.00');

        if (manualError) {
            console.error('❌ Error finding gaps:', manualError.message);
            return;
        }

        // Deduplicate manually (since Postgrest doesn't support SELECT DISTINCT across many rows easily without RPC)
        // But wait, if there are 23k rows, manualGaps will still be limited by 1000 unless we paginate or use a different approach.
        // A better way is to iterate through all known team/year combinations or use a raw SQL query if possible via a new RPC.

        // Let's create an RPC for this if possible, or just use a known list of years.
        const years = Array.from({ length: 26 }, (_, i) => 2025 - i);
        const teams = [
            'arizona-diamondbacks', 'atlanta-braves', 'baltimore-orioles', 'boston-red-sox',
            'chicago-cubs', 'chicago-white-sox', 'cincinnati-reds', 'cleveland-guardians',
            'colorado-rockies', 'detroit-tigers', 'houston-astros', 'kansas-city-royals',
            'los-angeles-angels', 'los-angeles-dodgers', 'miami-marlins', 'milwaukee-brewers',
            'minnesota-twins', 'new-york-mets', 'new-york-yankees', 'oakland-athletics',
            'philadelphia-phillies', 'pittsburgh-pirates', 'san-diego-padres', 'san-francisco-giants',
            'seattle-mariners', 'st-louis-cardinals', 'tampa-bay-rays', 'texas-rangers',
            'toronto-blue-jays', 'washington-nationals'
        ];

        const uniqueGaps = [];
        for (const year of years) {
            for (const team of teams) {
                // Check if this specific gap exists
                const { count, error: countError } = await supabase
                    .from('mlb_rosters')
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

        for (const gap of uniqueGaps) {
            await enrichMLBRoster(gap.team, gap.year);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    } else {
        console.log(`📍 Found ${gaps.length} team-season combinations with missing jerseys.`);
        for (const gap of gaps) {
            await enrichMLBRoster(gap.team_id, gap.season_year);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    console.log('\n🏁 MLB Jersey Enrichment complete.');
}

main();
