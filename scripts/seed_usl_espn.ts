/**
 * USL Championship ESPN Roster Seeder
 * Scrapes USL Championship roster data from ESPN and saves to Supabase.
 * Usage: npx tsx scripts/seed_usl_espn.ts [startYear] [endYear] [teamFilter]
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
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

interface USLTeam {
    id: string; // ESPN ID
    name: string;
    slug: string;
    abbreviation?: string;
    primaryColor?: string;
    secondaryColor?: string;
}

const USL_TEAMS: USLTeam[] = [
    // Current Independent Teams
    { id: '19405', name: 'Birmingham Legion FC', slug: 'birmingham-legion-fc', abbreviation: 'BHM', primaryColor: '#000000', secondaryColor: '#c5a045' },
    { id: '131579', name: 'Brooklyn FC', slug: 'brooklyn-fc', abbreviation: 'BK', primaryColor: '#000000', secondaryColor: '#ffffff' },
    { id: '9729', name: 'Charleston Battery', slug: 'charleston-battery', abbreviation: 'CHS', primaryColor: '#000000', secondaryColor: '#ffcc00' },
    { id: '17830', name: 'Colorado Springs Switchbacks FC', slug: 'colorado-springs-switchbacks-fc', abbreviation: 'COS', primaryColor: '#003366', secondaryColor: '#ffffff' },
    { id: '19179', name: 'Detroit City FC', slug: 'detroit-city-fc', abbreviation: 'DET', primaryColor: '#7a223f', secondaryColor: '#c5a045' },
    { id: '19407', name: 'El Paso Locomotive FC', slug: 'el-paso-locomotive-fc', abbreviation: 'ELP', primaryColor: '#002a5c', secondaryColor: '#8ecae6' },
    { id: '18446', name: 'FC Tulsa', slug: 'fc-tulsa', abbreviation: 'TUL', primaryColor: '#002a5c', secondaryColor: '#c5a045' },
    { id: '19411', name: 'Hartford Athletic', slug: 'hartford-athletic', abbreviation: 'HFD', primaryColor: '#004d44', secondaryColor: '#009a44' },
    { id: '17360', name: 'Indy Eleven', slug: 'indy-eleven', abbreviation: 'IND', primaryColor: '#00205b', secondaryColor: '#ffffff' },
    { id: '18987', name: 'Las Vegas Lights FC', slug: 'las-vegas-lights-fc', abbreviation: 'LVL', primaryColor: '#00d4ff', secondaryColor: '#f1ff00' },
    { id: '21822', name: 'Lexington SC', slug: 'lexington-sc', abbreviation: 'LEX', primaryColor: '#000000', secondaryColor: '#ffffff' },
    { id: '19410', name: 'Loudoun United FC', slug: 'loudoun-united-fc', abbreviation: 'LDN', primaryColor: '#cc0000', secondaryColor: '#000000' },
    { id: '17832', name: 'Louisville City FC', slug: 'louisville-city-fc', abbreviation: 'LOU', primaryColor: '#3d1c5c', secondaryColor: '#ac944d' },
    { id: '19409', name: 'Memphis 901 FC', slug: 'memphis-901-fc', abbreviation: 'MEM', primaryColor: '#002b5c', secondaryColor: '#7899b0' },
    // corrected Miami FC ID to 18159 to better match Championship era link
    { id: '18159', name: 'Miami FC', slug: 'miami-fc', abbreviation: 'MIA', primaryColor: '#003366', secondaryColor: '#00b5e2' },
    { id: '21370', name: 'Monterey Bay FC', slug: 'monterey-bay-fc', abbreviation: 'MB', primaryColor: '#000000', secondaryColor: '#00b5e2' },
    { id: '19408', name: 'New Mexico United', slug: 'new-mexico-united', abbreviation: 'NMU', primaryColor: '#000000', secondaryColor: '#fefe00' },
    { id: '9725', name: 'North Carolina FC', slug: 'north-carolina-fc', abbreviation: 'NC', primaryColor: '#002b5c', secondaryColor: '#ce0e2d' },
    { id: '20687', name: 'Oakland Roots SC', slug: 'oakland-roots-sc', abbreviation: 'OAK', primaryColor: '#000000', secondaryColor: '#ffffff' },
    { id: '18455', name: 'Orange County SC', slug: 'orange-county-sc', abbreviation: 'OC', primaryColor: '#ff6600', secondaryColor: '#000000' },
    { id: '17850', name: 'Phoenix Rising FC', slug: 'phoenix-rising-fc', abbreviation: 'PHX', primaryColor: '#cc0033', secondaryColor: '#ffffff' },
    { id: '17827', name: 'Pittsburgh Riverhounds SC', slug: 'pittsburgh-riverhounds-sc', abbreviation: 'PIT', primaryColor: '#ffcc00', secondaryColor: '#000000' },
    // Corrected Rhode Island ID
    { id: '22164', name: 'Rhode Island FC', slug: 'rhode-island-fc', abbreviation: 'RI', primaryColor: '#002b5c', secondaryColor: '#ac944d' },
    { id: '17828', name: 'Sacramento Republic FC', slug: 'sacramento-republic-fc', abbreviation: 'SAC', primaryColor: '#a81c32', secondaryColor: '#c5a045' },
    { id: '18265', name: 'San Antonio FC', slug: 'san-antonio-fc', abbreviation: 'SA', primaryColor: '#000000', secondaryColor: '#c0c0c0' },
    { id: '17361', name: 'Tampa Bay Rowdies', slug: 'tampa-bay-rowdies', abbreviation: 'TBR', primaryColor: '#008000', secondaryColor: '#ffff00' },

    // Expansion 2025/26
    { id: '131578', name: 'Sporting JAX', slug: 'sporting-jax', abbreviation: 'JAX', primaryColor: '#000000', secondaryColor: '#ffffff' },

    // Former USL Championship Teams (Post-Rebrand 2019+)
    { id: '20300', name: 'San Diego Loyal SC', slug: 'san-diego-loyal-sc', abbreviation: 'SD', primaryColor: '#de9b26', secondaryColor: '#0c223f' },
    { id: '18452', name: 'Rio Grande Valley FC', slug: 'rio-grande-valley-fc-toros', abbreviation: 'RGV', primaryColor: '#ff6600', secondaryColor: '#000000' },
    { id: '19412', name: 'Austin Bold FC', slug: 'austin-bold-fc', abbreviation: 'ATX', primaryColor: '#000000', secondaryColor: '#ffd700' },
    // Corrected OKC Energy ID
    { id: '17831', name: 'OKC Energy FC', slug: 'okc-energy-fc', abbreviation: 'OKC', primaryColor: '#000000', secondaryColor: '#a4cf3e' },
    { id: '18454', name: 'Reno 1868 FC', slug: 'reno-1868-fc', abbreviation: 'RNO', primaryColor: '#003366', secondaryColor: '#ffffff' },
    { id: '18988', name: 'Fresno FC', slug: 'fresno-fc', abbreviation: 'FRE', primaryColor: '#cfdae1', secondaryColor: '#002a5c' },
    // Corrected Saint Louis ID
    { id: '17833', name: 'Saint Louis FC', slug: 'saint-louis-fc', abbreviation: 'STL', primaryColor: '#003366', secondaryColor: '#ffffff' },
    { id: '18986', name: 'Nashville SC', slug: 'nashville-sc', abbreviation: 'NSH', primaryColor: '#ece81a', secondaryColor: '#1f1646' },
    { id: '17356', name: 'Ottawa Fury FC', slug: 'ottawa-fury-fc', abbreviation: 'OTT', primaryColor: '#cc0000', secondaryColor: '#000000' },
    { id: '17826', name: 'Charlotte Independence', slug: 'charlotte-independence', abbreviation: 'CLT', primaryColor: '#002d55', secondaryColor: '#ffffff' },

    // MLS II Teams (Played in USL Championship 2019+)
    { id: '18450', name: 'New York Red Bulls II', slug: 'new-york-red-bulls-ii', abbreviation: 'NYRB', primaryColor: '#e31351', secondaryColor: '#ffffff' },
    { id: '18989', name: 'Atlanta United 2', slug: 'atlanta-united-2', abbreviation: 'ATL', primaryColor: '#80000a', secondaryColor: '#000000' },
    // Ventura County FC (fka LA Galaxy II)
    { id: '18449', name: 'Ventura County FC', slug: 'ventura-county-fc', abbreviation: 'VC', primaryColor: '#00245d', secondaryColor: '#ffffff' },
    { id: '18453', name: 'Tacoma Defiance', slug: 'tacoma-defiance', abbreviation: 'TAC', primaryColor: '#000000', secondaryColor: '#ffffff' },
    { id: '18448', name: 'Real Monarchs SLC', slug: 'real-monarchs-slc', abbreviation: 'SLC', primaryColor: '#b21c25', secondaryColor: '#032140' },
    { id: '18451', name: 'Portland Timbers 2', slug: 'portland-timbers-2', abbreviation: 'POR', primaryColor: '#00482b', secondaryColor: '#ffffff' },
    { id: '18445', name: 'Philadelphia Union II', slug: 'philadelphia-union-ii', abbreviation: 'PHI', primaryColor: '#002d55', secondaryColor: '#b38707' },
    { id: '18457', name: 'Sporting Kansas City II', slug: 'sporting-kansas-city-ii', abbreviation: 'SKC', primaryColor: '#91b2c7', secondaryColor: '#002a3e' }
];


async function seedTeams() {
    console.log('⚽ Seeding USL Championship teams...');
    for (const team of USL_TEAMS) {
        const { error } = await supabase.from('usl_teams').upsert({
            id: team.id,
            name: team.name,
            display_name: team.name,
            slug: team.slug,
            abbreviation: team.abbreviation,
            primary_color: team.primaryColor,
            secondary_color: team.secondaryColor,
            logo_url: `https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`
        });
        if (error) console.error(`Error seeding team ${team.name}:`, error);
    }
    console.log('✅ Seeded USL Championship teams');
}

async function scrapeRoster(teamId: string, season: number) {
    const url = `https://www.espn.com/soccer/team/squad/_/id/${teamId}/league/USA.USL.1/season/${season}`;
    console.log(`  🔍 Fetching ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.log(`    ⚠️ Failed to fetch (Status: ${response.status})`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const players: any[] = [];

        $('table.Table tbody tr.Table__TR').each((_, row) => {
            const cells = $(row).find('td');
            if (cells.length < 5) return;

            const nameCell = $(cells[0]);
            const nameLink = nameCell.find('a.AnchorLink');
            const playerName = nameLink.text().trim() || nameCell.text().trim().replace(/^\d+/, '').trim();
            const playerUrl = nameLink.attr('href');
            const playerId = playerUrl?.match(/\/id\/(\d+)/)?.[1] || null;

            // Extract number
            let jerseyNumber = nameCell.find('span').text().trim();
            if (!jerseyNumber) {
                const fullText = nameCell.text().trim();
                const numMatch = fullText.match(/^(\d+)/);
                if (numMatch) jerseyNumber = numMatch[1];
            }

            const position = $(cells[1]).text().trim();
            const ageText = $(cells[2]).text().trim();
            const age = parseInt(ageText);
            const height = $(cells[3]).text().trim();
            const weight = $(cells[4]).text().trim();
            const nationality = $(cells[5]).text().trim();

            if (playerName && playerName !== 'Name') {
                players.push({
                    team_id: teamId,
                    season_year: season,
                    player_name: playerName,
                    player_id: playerId,
                    jersey_number: jerseyNumber || null,
                    position,
                    age: isNaN(age) ? null : age,
                    height: height !== '--' ? height : null,
                    weight: weight !== '--' ? weight : null,
                    nationality: nationality !== '--' ? nationality : null
                });
            }
        });

        return players;
    } catch (err) {
        console.error(`    ❌ Error scraping ${teamId} ${season}:`, err);
        return [];
    }
}

async function main() {
    console.log('\n⚽ ESPN USL Championship Seeding');
    const args = process.argv.slice(2);
    const startYear = parseInt(args[0]) || 2024;
    const endYear = parseInt(args[1]) || startYear;
    const teamFilter = args[2];

    console.log(`📅 ${startYear} - ${endYear}\n`);

    await seedTeams();

    for (const team of USL_TEAMS) {
        if (teamFilter && !team.slug.includes(teamFilter) && team.id !== teamFilter) continue;

        console.log(`🏆 ${team.name.toUpperCase()}`);
        for (let season = startYear; season <= endYear; season++) {
            console.log(`  📆 Season ${season}`);
            const players = await scrapeRoster(team.id, season);

            if (players.length > 0) {
                const { error } = await supabase.from('usl_rosters').upsert(players, {
                    onConflict: 'team_id,season_year,player_name'
                });
                if (error) {
                    console.error(`    ❌ Error saving players:`, error);
                } else {
                    console.log(`    ✅ Saved ${players.length} players`);
                }
            } else {
                console.log(`    ⚠️ No players found`);
            }

            // Small delay
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log('\n✅ USL Championship ESPN Seeding Complete!');
}

main().catch(console.error);
