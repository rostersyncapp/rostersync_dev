
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

// Team config for StatMuse
// We'll pull these from the database or just use a mapping
const TEAM_CONFIGS: Record<string, { slug: string, statmuseId: number }> = {
    "baltimore-ravens": { slug: "baltimore-ravens", statmuseId: 85 },
    "buffalo-bills": { slug: "buffalo-bills", statmuseId: 67 },
    "cincinnati-bengals": { slug: "cincinnati-bengals", statmuseId: 80 },
    "cleveland-browns": { slug: "cleveland-browns", statmuseId: 58 },
    "denver-broncos": { slug: "denver-broncos", statmuseId: 68 },
    "houston-texans": { slug: "houston-texans", statmuseId: 86 },
    "indianapolis-colts": { slug: "indianapolis-colts", statmuseId: 66 },
    "jacksonville-jaguars": { slug: "jacksonville-jaguars", statmuseId: 84 },
    "kansas-city-chiefs": { slug: "kansas-city-chiefs", statmuseId: 69 },
    "las-vegas-raiders": { slug: "las-vegas-raiders", statmuseId: 73 },
    "los-angeles-chargers": { slug: "los-angeles-chargers", statmuseId: 74 },
    "miami-dolphins": { slug: "miami-dolphins", statmuseId: 77 },
    "new-england-patriots": { slug: "new-england-patriots", statmuseId: 70 },
    "new-york-jets": { slug: "new-york-jets", statmuseId: 71 },
    "pittsburgh-steelers": { slug: "pittsburgh-steelers", statmuseId: 50 },
    "tennessee-titans": { slug: "tennessee-titans", statmuseId: 72 },
    "arizona-cardinals": { slug: "arizona-cardinals", statmuseId: 7 },
    "atlanta-falcons": { slug: "atlanta-falcons", statmuseId: 78 },
    "carolina-panthers": { slug: "carolina-panthers", statmuseId: 83 },
    "chicago-bears": { slug: "chicago-bears", statmuseId: 4 },
    "dallas-cowboys": { slug: "dallas-cowboys", statmuseId: 75 },
    "detroit-lions": { slug: "detroit-lions", statmuseId: 46 },
    "green-bay-packers": { slug: "green-bay-packers", statmuseId: 18 },
    "los-angeles-rams": { slug: "los-angeles-rams", statmuseId: 53 },
    "minnesota-vikings": { slug: "minnesota-vikings", statmuseId: 76 },
    "new-orleans-saints": { slug: "new-orleans-saints", statmuseId: 79 },
    "new-york-giants": { slug: "new-york-giants", statmuseId: 35 },
    "philadelphia-eagles": { slug: "philadelphia-eagles", statmuseId: 49 },
    "san-francisco-49ers": { slug: "san-francisco-49ers", statmuseId: 63 },
    "seattle-seahawks": { slug: "seattle-seahawks", statmuseId: 81 },
    "tampa-bay-buccaneers": { slug: "tampa-bay-buccaneers", statmuseId: 82 },
    "washington-commanders": { slug: "washington-commanders", statmuseId: 48 }
};

function normalizeName(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

async function enrichNFLRoster(teamId: string, year: number) {
    const config = TEAM_CONFIGS[teamId];
    if (!config) {
        console.warn(`No StatMuse config for ${teamId}`);
        return;
    }

    const url = `https://www.statmuse.com/nfl/team/${config.slug}-${config.statmuseId}/roster/${year}`;
    console.log(`\n🔍 Fetching StatMuse roster for ${teamId} (${year})...`);
    console.log(`🔗 ${url}`);

    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(res.data);
        const playerToNumber: Record<string, string> = {};

        // StatMuse Roster Table Structure:
        // td:nth-child(1) is NO.
        // td:nth-child(3) contains <a> with player name
        $('table tbody tr').each((_, row) => {
            const number = $(row).find('td').eq(0).text().trim();
            const name = $(row).find('td').eq(2).text().trim();

            if (name && number && number !== '') {
                playerToNumber[normalizeName(name)] = number;
            }
        });

        console.log(`  Found ${Object.keys(playerToNumber).length} players with numbers.`);

        if (Object.keys(playerToNumber).length === 0) {
            console.warn(`  ⚠️ No numbers found on page.`);
            return;
        }

        // Fetch local records that need updating
        const { data: localRoster, error: fetchError } = await supabase
            .from('nfl_rosters')
            .select('player_name, jersey_number')
            .eq('team_id', teamId)
            .eq('season_year', year)
            .or('jersey_number.is.null,jersey_number.eq."",jersey_number.eq.00');

        if (fetchError) {
            console.error(`  ❌ Error fetching local roster:`, fetchError.message);
            return;
        }

        let updateCount = 0;
        for (const player of localRoster || []) {
            const normalized = normalizeName(player.player_name);
            const jersey = playerToNumber[normalized];

            if (jersey) {
                const { error: updateError } = await supabase
                    .from('nfl_rosters')
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
        console.error(`  ❌ Error for ${teamId}:`, err.message);
    }
}

async function main() {
    console.log('📊 Querying database for NFL roster gaps in 2022...');

    // Specifically target 2022 gaps as requested
    const targetYear = 2022;
    const { data: gaps, error } = await supabase
        .from('nfl_rosters')
        .select('team_id')
        .eq('season_year', targetYear)
        .or('jersey_number.is.null,jersey_number.eq."",jersey_number.eq.00');

    if (error) {
        console.error('❌ Error finding gaps:', error.message);
        return;
    }

    const uniqueTeams = Array.from(new Set(gaps.map(g => g.team_id)));
    console.log(`📍 Found ${uniqueTeams.length} teams with missing jerseys in ${targetYear}.`);

    for (const teamId of uniqueTeams) {
        await enrichNFLRoster(teamId, targetYear);
        // Be nice to StatMuse
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n🏁 NFL Jersey Enrichment complete.');
}

main();
