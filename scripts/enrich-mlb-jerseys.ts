
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
    // Priority targets from our audit
    const targets = [
        { team: 'texas-rangers', year: 2014 },
        { team: 'texas-rangers', year: 2015 },
        { team: 'seattle-mariners', year: 2017 },
        { team: 'seattle-mariners', year: 2016 },
        { team: 'atlanta-braves', year: 2016 },
        { team: 'atlanta-braves', year: 2015 },
        { team: 'toronto-blue-jays', year: 2017 },
        { team: 'toronto-blue-jays', year: 2014 },
        { team: 'san-diego-padres', year: 2016 },
        { team: 'san-diego-padres', year: 2008 },
        { team: 'cleveland-guardians', year: 2002 },
        { team: 'new-york-yankees', year: 2014 },
        { team: 'kansas-city-royals', year: 2004 },
        { team: 'miami-marlins', year: 2010 },
        { team: 'detroit-tigers', year: 2002 },
        { team: 'cincinnati-reds', year: 2003 }
    ];

    for (const target of targets) {
        await enrichMLBRoster(target.team, target.year);
        // Be nice to BRef
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.log('\n🏁 MLB Jersey Enrichment complete.');
}

main();
