/**
 * NWSL ESPN Roster Seeder
 * Scrapes NWSL roster data from ESPN and saves to Supabase.
 * Usage: npx tsx scripts/seed_nwsl_espn.ts [startYear] [endYear] [teamFilter]
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

interface NWSLTeam {
    id: string; // ESPN ID
    name: string;
    slug: string;
    abbreviation?: string;
    primaryColor?: string;
    secondaryColor?: string;
}

const NWSL_TEAMS: NWSLTeam[] = [
    { id: '21422', name: 'Angel City FC', slug: 'angel-city-fc', abbreviation: 'LA', primaryColor: '#f7b5cd', secondaryColor: '#000000' },
    { id: '22187', name: 'Bay FC', slug: 'bay-fc', abbreviation: 'BAY', primaryColor: '#9fa0a4', secondaryColor: '#b4925a' },
    { id: '131562', name: 'Boston Legacy FC', slug: 'boston-legacy-fc', abbreviation: 'BOS', primaryColor: '#000000', secondaryColor: '#ffffff' },
    { id: '15360', name: 'Chicago Stars FC', slug: 'chicago-stars-fc', abbreviation: 'CHI', primaryColor: '#6da6da', secondaryColor: '#ffffff' },
    { id: '131563', name: 'Denver Summit FC', slug: 'denver-summit-fc', abbreviation: 'DEN', primaryColor: '#000000', secondaryColor: '#ffffff' },
    { id: '15364', name: 'Gotham FC', slug: 'gotham-fc', abbreviation: 'NYNJ', primaryColor: '#bfff00', secondaryColor: '#000000' },
    { id: '17346', name: 'Houston Dash', slug: 'houston-dash', abbreviation: 'HOU', primaryColor: '#ff7500', secondaryColor: '#000000' },
    { id: '20907', name: 'Kansas City Current', slug: 'kansas-city-current', abbreviation: 'KC', primaryColor: '#d62027', secondaryColor: '#00483a' },
    { id: '15366', name: 'North Carolina Courage', slug: 'north-carolina-courage', abbreviation: 'NC', primaryColor: '#002654', secondaryColor: '#ce0e2d' },
    { id: '18206', name: 'Orlando Pride', slug: 'orlando-city-sc', abbreviation: 'ORL', primaryColor: '#633492', secondaryColor: '#a1dbf5' },
    { id: '15362', name: 'Portland Thorns FC', slug: 'portland-thorns-fc', abbreviation: 'POR', primaryColor: '#80000a', secondaryColor: '#000000' },
    { id: '20905', name: 'Racing Louisville FC', slug: 'racing-louisville-fc', abbreviation: 'LOU', primaryColor: '#7030a0', secondaryColor: '#c3ef3c' },
    { id: '21423', name: 'San Diego Wave FC', slug: 'san-diego-wave-fc', abbreviation: 'SD', primaryColor: '#001e61', secondaryColor: '#6bc6e1' },
    { id: '15363', name: 'Seattle Reign FC', slug: 'usa.reignfc', abbreviation: 'SEA', primaryColor: '#002a5c', secondaryColor: '#ffffff' },
    { id: '19141', name: 'Utah Royals', slug: 'utah-royals-fc', abbreviation: 'UTA', primaryColor: '#b21c25', secondaryColor: '#032140' },
    { id: '15365', name: 'Washington Spirit', slug: 'washington-spirit', abbreviation: 'WAS', primaryColor: '#ed1849', secondaryColor: '#0b2341' }
];

async function seedTeams() {
    console.log('⚽ Seeding NWSL teams...');
    for (const team of NWSL_TEAMS) {
        const { error } = await supabase.from('nwsl_teams').upsert({
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
    console.log('✅ Seeded NWSL teams');
}

async function scrapeRoster(teamId: string, season: number) {
    const url = `https://www.espn.com/soccer/team/squad/_/id/${teamId}/league/USA.NWSL/season/${season}`;
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
    console.log('\n⚽ ESPN NWSL Seeding');
    const args = process.argv.slice(2);
    const startYear = parseInt(args[0]) || 2024;
    const endYear = parseInt(args[1]) || startYear;
    const teamFilter = args[2];

    console.log(`📅 ${startYear} - ${endYear}\n`);

    await seedTeams();

    for (const team of NWSL_TEAMS) {
        if (teamFilter && !team.slug.includes(teamFilter) && team.id !== teamFilter) continue;

        console.log(`🏆 ${team.name.toUpperCase()}`);
        for (let season = startYear; season <= endYear; season++) {
            console.log(`  📆 Season ${season}`);
            const players = await scrapeRoster(team.id, season);

            if (players.length > 0) {
                const { error } = await supabase.from('nwsl_rosters').upsert(players, {
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

    console.log('\n✅ NWSL ESPN Seeding Complete!');
}

main().catch(console.error);
