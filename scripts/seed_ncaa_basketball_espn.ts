/**
 * NCAA Men's Basketball ESPN Roster Seeder
 * Scrapes NCAA Men's Basketball roster data from ESPN and saves to Supabase.
 * Usage: npx tsx scripts/seed_ncaa_basketball_espn.ts [startYear] [endYear] [teamFilter]
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Load .env manually
try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const match = line.match(/^([^#\s=]+)\s*=\s*(.*)$/);
            if (match) {
                const key = match[1];
                let value = match[2].trim();
                if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
                process.env[key] = value;
            }
        });
    }
} catch (err) {
    console.error('Error loading .env:', err);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface NCAATeam {
    id: string; // ESPN ID
    name: string;
    slug: string;
    conference: string;
    primaryColor?: string;
    secondaryColor?: string;
}

const NCAA_BASKETBALL_TEAMS: NCAATeam[] = [
    // SEC
    { id: '333', name: 'Alabama', slug: 'alabama-crimson-tide', conference: 'SEC', primaryColor: '#9E1B32', secondaryColor: '#FFFFFF' },
    { id: '8', name: 'Arkansas', slug: 'arkansas-razorbacks', conference: 'SEC', primaryColor: '#9D2235', secondaryColor: '#FFFFFF' },
    { id: '2', name: 'Auburn', slug: 'auburn-tigers', conference: 'SEC', primaryColor: '#0C2340', secondaryColor: '#E87722' },
    { id: '57', name: 'Florida', slug: 'florida-gators', conference: 'SEC', primaryColor: '#0021A5', secondaryColor: '#FA4616' },
    { id: '61', name: 'Georgia', slug: 'georgia-bulldogs', conference: 'SEC', primaryColor: '#BA0C2F', secondaryColor: '#000000' },
    { id: '96', name: 'Kentucky', slug: 'kentucky-wildcats', conference: 'SEC', primaryColor: '#0033A0', secondaryColor: '#FFFFFF' },
    { id: '99', name: 'LSU', slug: 'lsu-tigers', conference: 'SEC', primaryColor: '#461D7C', secondaryColor: '#FDD023' },
    { id: '344', name: 'Mississippi State', slug: 'mississippi-state-bulldogs', conference: 'SEC', primaryColor: '#660000', secondaryColor: '#FFFFFF' },
    { id: '142', name: 'Missouri', slug: 'missouri-tigers', conference: 'SEC', primaryColor: '#F1B82D', secondaryColor: '#000000' },
    { id: '201', name: 'Oklahoma', slug: 'oklahoma-sooners', conference: 'SEC', primaryColor: '#841617', secondaryColor: '#FDF9D8' },
    { id: '145', name: 'Ole Miss', slug: 'ole-miss-rebels', conference: 'SEC', primaryColor: '#CE1126', secondaryColor: '#14213D' },
    { id: '2579', name: 'South Carolina', slug: 'south-carolina-gamecocks', conference: 'SEC', primaryColor: '#73000A', secondaryColor: '#000000' },
    { id: '2633', name: 'Tennessee', slug: 'tennessee-volunteers', conference: 'SEC', primaryColor: '#FF8200', secondaryColor: '#FFFFFF' },
    { id: '245', name: 'Texas A&M', slug: 'texas-am-aggies', conference: 'SEC', primaryColor: '#500000', secondaryColor: '#FFFFFF' },
    { id: '251', name: 'Texas', slug: 'texas-longhorns', conference: 'SEC', primaryColor: '#BF5700', secondaryColor: '#FFFFFF' },
    { id: '238', name: 'Vanderbilt', slug: 'vanderbilt-commodores', conference: 'SEC', primaryColor: '#866D4B', secondaryColor: '#000000' },

    // ACC
    { id: '103', name: 'Boston College', slug: 'boston-college-eagles', conference: 'ACC', primaryColor: '#8A100B', secondaryColor: '#BC9B64' },
    { id: '25', name: 'California', slug: 'california-golden-bears', conference: 'ACC', primaryColor: '#003262', secondaryColor: '#FDB515' },
    { id: '228', name: 'Clemson', slug: 'clemson-tigers', conference: 'ACC', primaryColor: '#F56600', secondaryColor: '#522D80' },
    { id: '150', name: 'Duke', slug: 'duke-blue-devils', conference: 'ACC', primaryColor: '#003087', secondaryColor: '#FFFFFF' },
    { id: '52', name: 'Florida State', slug: 'florida-state-seminoles', conference: 'ACC', primaryColor: '#78243C', secondaryColor: '#FFD11B' },
    { id: '59', name: 'Georgia Tech', slug: 'georgia-tech-yellow-jackets', conference: 'ACC', primaryColor: '#B3A369', secondaryColor: '#003057' },
    { id: '97', name: 'Louisville', slug: 'louisville-cardinals', conference: 'ACC', primaryColor: '#AD0000', secondaryColor: '#000000' },
    { id: '2390', name: 'Miami (FL)', slug: 'miami-hurricanes', conference: 'ACC', primaryColor: '#F47321', secondaryColor: '#005030' },
    { id: '152', name: 'NC State', slug: 'nc-state-wolfpack', conference: 'ACC', primaryColor: '#CC0000', secondaryColor: '#000000' },
    { id: '153', name: 'North Carolina', slug: 'north-carolina-tar-heels', conference: 'ACC', primaryColor: '#7BAFD4', secondaryColor: '#FFFFFF' },
    { id: '87', name: 'Notre Dame', slug: 'notre-dame-fighting-irish', conference: 'ACC', primaryColor: '#0C2340', secondaryColor: '#C99700' },
    { id: '221', name: 'Pittsburgh', slug: 'pittsburgh-panthers', conference: 'ACC', primaryColor: '#003594', secondaryColor: '#FFB81C' },
    { id: '2567', name: 'SMU', slug: 'smu-mustangs', conference: 'ACC', primaryColor: '#CC0000', secondaryColor: '#354CA1' },
    { id: '24', name: 'Stanford', slug: 'stanford-cardinal', conference: 'ACC', primaryColor: '#8C1515', secondaryColor: '#FFFFFF' },
    { id: '183', name: 'Syracuse', slug: 'syracuse-orange', conference: 'ACC', primaryColor: '#F76900', secondaryColor: '#000E54' },
    { id: '258', name: 'Virginia', slug: 'virginia-cavaliers', conference: 'ACC', primaryColor: '#232D4B', secondaryColor: '#F84C1E' },
    { id: '259', name: 'Virginia Tech', slug: 'virginia-tech-hokies', conference: 'ACC', primaryColor: '#630031', secondaryColor: '#CF4420' },
    { id: '154', name: 'Wake Forest', slug: 'wake-forest-demon-deacons', conference: 'ACC', primaryColor: '#9E7E38', secondaryColor: '#000000' },

    // Big Ten
    { id: '356', name: 'Illinois', slug: 'illinois-fighting-illini', conference: 'Big Ten', primaryColor: '#E84A27', secondaryColor: '#13294B' },
    { id: '84', name: 'Indiana', slug: 'indiana-hoosiers', conference: 'Big Ten', primaryColor: '#990000', secondaryColor: '#EEEDEB' },
    { id: '2294', name: 'Iowa', slug: 'iowa-hawkeyes', conference: 'Big Ten', primaryColor: '#FFCD00', secondaryColor: '#000000' },
    { id: '120', name: 'Maryland', slug: 'maryland-terrapins', conference: 'Big Ten', primaryColor: '#E03A3E', secondaryColor: '#000000' },
    { id: '127', name: 'Michigan State', slug: 'michigan-state-spartans', conference: 'Big Ten', primaryColor: '#18453B', secondaryColor: '#FFFFFF' },
    { id: '130', name: 'Michigan', slug: 'michigan-wolverines', conference: 'Big Ten', primaryColor: '#00274C', secondaryColor: '#FFCB05' },
    { id: '135', name: 'Minnesota', slug: 'minnesota-golden-gophers', conference: 'Big Ten', primaryColor: '#7A0019', secondaryColor: '#FFCC33' },
    { id: '158', name: 'Nebraska', slug: 'nebraska-cornhuskers', conference: 'Big Ten', primaryColor: '#E41C38', secondaryColor: '#F3F3F3' },
    { id: '77', name: 'Northwestern', slug: 'northwestern-wildcats', conference: 'Big Ten', primaryColor: '#4E2A84', secondaryColor: '#FFFFFF' },
    { id: '194', name: 'Ohio State', slug: 'ohio-state-buckeyes', conference: 'Big Ten', primaryColor: '#BB0000', secondaryColor: '#666666' },
    { id: '2483', name: 'Oregon', slug: 'oregon-ducks', conference: 'Big Ten', primaryColor: '#154733', secondaryColor: '#FEE123' },
    { id: '213', name: 'Penn State', slug: 'penn-state-nittany-lions', conference: 'Big Ten', primaryColor: '#041E42', secondaryColor: '#FFFFFF' },
    { id: '2509', name: 'Purdue', slug: 'purdue-boilermakers', conference: 'Big Ten', primaryColor: '#CEB888', secondaryColor: '#000000' },
    { id: '164', name: 'Rutgers', slug: 'rutgers-scarlet-knights', conference: 'Big Ten', primaryColor: '#CC0033', secondaryColor: '#FFFFFF' },
    { id: '26', name: 'UCLA', slug: 'ucla-bruins', conference: 'Big Ten', primaryColor: '#2774AE', secondaryColor: '#FFD100' },
    { id: '30', name: 'USC', slug: 'usc-trojans', conference: 'Big Ten', primaryColor: '#990000', secondaryColor: '#FFC72C' },
    { id: '264', name: 'Washington', slug: 'washington-huskies', conference: 'Big Ten', primaryColor: '#4B2E83', secondaryColor: '#B7A57A' },
    { id: '275', name: 'Wisconsin', slug: 'wisconsin-badgers', conference: 'Big Ten', primaryColor: '#C5050C', secondaryColor: '#FFFFFF' },

    // Big 12
    { id: '9', name: 'Arizona State', slug: 'arizona-state-sun-devils', conference: 'Big 12', primaryColor: '#8C1D40', secondaryColor: '#FFC627' },
    { id: '12', name: 'Arizona', slug: 'arizona-wildcats', conference: 'Big 12', primaryColor: '#CC0033', secondaryColor: '#003366' },
    { id: '252', name: 'BYU', slug: 'byu-cougars', conference: 'Big 12', primaryColor: '#002E5D', secondaryColor: '#FFFFFF' },
    { id: '239', name: 'Baylor', slug: 'baylor-bears', conference: 'Big 12', primaryColor: '#154734', secondaryColor: '#FFB81C' },
    { id: '2132', name: 'Cincinnati', slug: 'cincinnati-bearcats', conference: 'Big 12', primaryColor: '#E00122', secondaryColor: '#000000' },
    { id: '38', name: 'Colorado', slug: 'colorado-buffaloes', conference: 'Big 12', primaryColor: '#CFB87C', secondaryColor: '#000000' },
    { id: '248', name: 'Houston', slug: 'houston-cougars', conference: 'Big 12', primaryColor: '#C8102E', secondaryColor: '#FFFFFF' },
    { id: '66', name: 'Iowa State', slug: 'iowa-state-cyclones', conference: 'Big 12', primaryColor: '#C8102E', secondaryColor: '#F1BE48' },
    { id: '2305', name: 'Kansas', slug: 'kansas-jayhawks', conference: 'Big 12', primaryColor: '#0051BA', secondaryColor: '#E8000D' },
    { id: '2306', name: 'Kansas State', slug: 'kansas-state-wildcats', conference: 'Big 12', primaryColor: '#512888', secondaryColor: '#FFFFFF' },
    { id: '197', name: 'Oklahoma State', slug: 'oklahoma-state-cowboys', conference: 'Big 12', primaryColor: '#FF7300', secondaryColor: '#000000' },
    { id: '2628', name: 'TCU', slug: 'tcu-horned-frogs', conference: 'Big 12', primaryColor: '#4D1979', secondaryColor: '#A3A9AC' },
    { id: '2641', name: 'Texas Tech', slug: 'texas-tech-red-raiders', conference: 'Big 12', primaryColor: '#CC0000', secondaryColor: '#000000' },
    { id: '2116', name: 'UCF', slug: 'ucf-knights', conference: 'Big 12', primaryColor: '#BA9B37', secondaryColor: '#000000' },
    { id: '254', name: 'Utah', slug: 'utah-utes', conference: 'Big 12', primaryColor: '#CC0000', secondaryColor: '#FFFFFF' },
    { id: '277', name: 'West Virginia', slug: 'west-virginia-mountaineers', conference: 'Big 12', primaryColor: '#002855', secondaryColor: '#EAAA00' },

    // Big East
    { id: '2086', name: 'Butler', slug: 'butler-bulldogs', conference: 'Big East', primaryColor: '#00263E', secondaryColor: '#FFFFFF' },
    { id: '156', name: 'Creighton', slug: 'creighton-bluejays', conference: 'Big East', primaryColor: '#005CA9', secondaryColor: '#FFFFFF' },
    { id: '305', name: 'DePaul', slug: 'depaul-blue-demons', conference: 'Big East', primaryColor: '#005191', secondaryColor: '#FFFFFF' },
    { id: '46', name: 'Georgetown', slug: 'georgetown-hoyas', conference: 'Big East', primaryColor: '#041E42', secondaryColor: '#63666A' },
    { id: '269', name: 'Marquette', slug: 'marquette-golden-eagles', conference: 'Big East', primaryColor: '#003366', secondaryColor: '#FFCC00' },
    { id: '2507', name: 'Providence', slug: 'providence-friars', conference: 'Big East', primaryColor: '#000000', secondaryColor: '#FFFFFF' },
    { id: '2550', name: 'Seton Hall', slug: 'seton-hall-pirates', conference: 'Big East', primaryColor: '#0044AD', secondaryColor: '#FFFFFF' },
    { id: '2599', name: "St. John's", slug: 'st-johns-red-storm', conference: 'Big East', primaryColor: '#BA0C2F', secondaryColor: '#FFFFFF' },
    { id: '41', name: 'UConn', slug: 'uconn-huskies', conference: 'Big East', primaryColor: '#000E2F', secondaryColor: '#FFFFFF' },
    { id: '222', name: 'Villanova', slug: 'villanova-wildcats', conference: 'Big East', primaryColor: '#123D7C', secondaryColor: '#FFFFFF' },
    { id: '2752', name: 'Xavier', slug: 'xavier-musketeers', conference: 'Big East', primaryColor: '#002144', secondaryColor: '#9EA2A2' }
];

async function seedTeams() {
    console.log('🏀 Seeding NCAA Basketball teams...');
    for (const team of NCAA_BASKETBALL_TEAMS) {
        const { error } = await supabase.from('ncaa_basketball_teams').upsert({
            id: team.id,
            name: team.name,
            display_name: team.name,
            slug: team.slug,
            primary_color: team.primaryColor,
            secondary_color: team.secondaryColor,
            logo_url: `https://a.espncdn.com/i/teamlogos/ncaa/500/${team.id}.png`
        });
        if (error) console.error(`Error seeding team ${team.name}:`, error);
    }
}

async function scrapeRoster(teamId: string, season: number) {
    const url = `https://site.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball/teams/${teamId}/roster?season=${season}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const data = response.data;
        const athleteGroups = data.athletes || data.positionGroups;
        if (!athleteGroups || !Array.isArray(athleteGroups) || athleteGroups.length === 0) {
            return [];
        }

        const players: any[] = [];
        for (const group of athleteGroups) {
            const playerList = group.athletes || group.items;
            if (!playerList || !Array.isArray(playerList)) continue;

            for (const athlete of playerList) {
                players.push({
                    team_id: teamId,
                    season_year: season,
                    player_id: athlete.id,
                    player_name: athlete.fullName || athlete.name || athlete.displayName,
                    jersey_number: athlete.jersey || athlete.jerseyNumber || null,
                    position: athlete.position?.abbreviation || athlete.position?.name || athlete.position || null,
                    height: athlete.displayHeight || athlete.height || null,
                    weight: athlete.displayWeight || athlete.weight || null,
                    class: athlete.experience?.displayValue || athlete.experience?.abbreviation || athlete.class || null,
                    hardware_safe_name: (athlete.fullName || athlete.name || athlete.displayName).toUpperCase()
                });
            }
        }
        return players;
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) return [];
        console.error(`    ❌ Error scraping ${teamId} ${season}:`, err instanceof Error ? err.message : err);
        return [];
    }
}

async function main() {
    console.log('\n🏀 ESPN NCAA Men\'s Basketball Seeding');
    const args = process.argv.slice(2);
    const startYear = parseInt(args[0]) || 2024;
    const endYear = parseInt(args[1]) || startYear;
    const teamFilter = args[2];

    console.log(`📅 ${startYear} - ${endYear}\n`);

    await seedTeams();

    for (const team of NCAA_BASKETBALL_TEAMS) {
        if (teamFilter) {
            const matchesTeam = team.slug.includes(teamFilter) || team.id === teamFilter;
            const matchesConf = team.conference.toLowerCase().includes(teamFilter.toLowerCase());
            if (!matchesTeam && !matchesConf) continue;
        }

        console.log(`🏆 ${team.name.toUpperCase()} (${team.conference})`);
        for (let season = startYear; season <= endYear; season++) {
            process.stdout.write(`  📆 Season ${season}: `);
            const players = await scrapeRoster(team.id, season);

            if (players.length > 0) {
                const { error } = await supabase.from('ncaa_basketball_rosters').upsert(players, {
                    onConflict: 'team_id,season_year,player_name,player_id'
                });
                if (error) {
                    process.stdout.write(`❌ Error: ${error.message}\n`);
                } else {
                    process.stdout.write(`✅ Saved ${players.length} players\n`);
                }
            } else {
                process.stdout.write(`⚠️ No players found\n`);
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    console.log('\n✅ NCAA Basketball ESPN Seeding Complete!');
}

main().catch(console.error);
