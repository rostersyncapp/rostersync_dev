/**
 * MLS ESPN Roster Seeder
 * Scrapes MLS roster data from ESPN and saves to Supabase.
 * Usage: npx tsx scripts/seed_mls_espn.ts [startYear] [endYear] [teamFilter]
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

interface MLSTeam {
    id: string; // ESPN ID
    name: string;
    slug: string;
    abbreviation?: string;
    primaryColor?: string;
    secondaryColor?: string;
}

const MLS_TEAMS: MLSTeam[] = [
    { id: '18418', name: 'Atlanta United FC', slug: 'atlanta-united-fc', abbreviation: 'ATL', primaryColor: '#80000a', secondaryColor: '#221f1f' },
    { id: '20906', name: 'Austin FC', slug: 'austin-fc', abbreviation: 'ATX', primaryColor: '#00B140', secondaryColor: '#000000' },
    { id: '9720', name: 'CF Montréal', slug: 'cf-montreal', abbreviation: 'MTL', primaryColor: '#0033A0', secondaryColor: '#000000' },
    { id: '21300', name: 'Charlotte FC', slug: 'charlotte-fc', abbreviation: 'CLT', primaryColor: '#1A85C8', secondaryColor: '#111111' },
    { id: '182', name: 'Chicago Fire FC', slug: 'chicago-fire-fc', abbreviation: 'CHI', primaryColor: '#FF0000', secondaryColor: '#00233C' },
    { id: '184', name: 'Colorado Rapids', slug: 'colorado-rapids', abbreviation: 'COL', primaryColor: '#6F263D', secondaryColor: '#92ADCD' },
    { id: '183', name: 'Columbus Crew', slug: 'columbus-crew', abbreviation: 'CLB', primaryColor: '#FEDD00', secondaryColor: '#000000' },
    { id: '193', name: 'D.C. United', slug: 'dc-united', abbreviation: 'DC', primaryColor: '#000000', secondaryColor: '#EF3E42' },
    { id: '18267', name: 'FC Cincinnati', slug: 'fc-cincinnati', abbreviation: 'CIN', primaryColor: '#263B80', secondaryColor: '#FB4F14' },
    { id: '185', name: 'FC Dallas', slug: 'fc-dallas', abbreviation: 'DAL', primaryColor: '#E81010', secondaryColor: '#202A44' },
    { id: '6077', name: 'Houston Dynamo FC', slug: 'houston-dynamo-fc', abbreviation: 'HOU', primaryColor: '#FF6B00', secondaryColor: '#000000' },
    { id: '20232', name: 'Inter Miami CF', slug: 'inter-miami-cf', abbreviation: 'MIA', primaryColor: '#F7B5CD', secondaryColor: '#231F20' },
    { id: '187', name: 'LA Galaxy', slug: 'la-galaxy', abbreviation: 'LA', primaryColor: '#00245D', secondaryColor: '#FFD200' },
    { id: '18966', name: 'LAFC', slug: 'lafc', abbreviation: 'LAFC', primaryColor: '#000000', secondaryColor: '#C39E6D' },
    { id: '17362', name: 'Minnesota United FC', slug: 'minnesota-united-fc', abbreviation: 'MIN', primaryColor: '#8cd2f4', secondaryColor: '#58595b' },
    { id: '18986', name: 'Nashville SC', slug: 'nashville-sc', abbreviation: 'NSH', primaryColor: '#ede93b', secondaryColor: '#1f1646' },
    { id: '189', name: 'New England Revolution', slug: 'new-england-revolution', abbreviation: 'NE', primaryColor: '#ce0e2d', secondaryColor: '#002b5c' },
    { id: '17606', name: 'New York City FC', slug: 'new-york-city-fc', abbreviation: 'NYC', primaryColor: '#6cace4', secondaryColor: '#041e42' },
    { id: '190', name: 'New York Red Bulls', slug: 'new-york-red-bulls', abbreviation: 'RBNY', primaryColor: '#ED1E36', secondaryColor: '#23326A' },
    { id: '12011', name: 'Orlando City SC', slug: 'orlando-city-sc', abbreviation: 'ORL', primaryColor: '#633492', secondaryColor: '#FDE192' },
    { id: '10739', name: 'Philadelphia Union', slug: 'philadelphia-union', abbreviation: 'PHI', primaryColor: '#002D55', secondaryColor: '#B38707' },
    { id: '9723', name: 'Portland Timbers', slug: 'portland-timbers', abbreviation: 'POR', primaryColor: '#00482B', secondaryColor: '#EAE827' },
    { id: '4771', name: 'Real Salt Lake', slug: 'real-salt-lake', abbreviation: 'RSL', primaryColor: '#B30838', secondaryColor: '#013A81' },
    { id: '191', name: 'San Jose Earthquakes', slug: 'san-jose-earthquakes', abbreviation: 'SJ', primaryColor: '#0067B1', secondaryColor: '#000000' },
    { id: '9726', name: 'Seattle Sounders FC', slug: 'seattle-sounders-fc', abbreviation: 'SEA', primaryColor: '#5D9741', secondaryColor: '#005596' },
    { id: '186', name: 'Sporting Kansas City', slug: 'sporting-kansas-city', abbreviation: 'SKC', primaryColor: '#91B2D2', secondaryColor: '#002F65' },
    { id: '21812', name: 'St. Louis CITY SC', slug: 'st-louis-city-sc', abbreviation: 'STL', primaryColor: '#ED174C', secondaryColor: '#001730' },
    { id: '7318', name: 'Toronto FC', slug: 'toronto-fc', abbreviation: 'TOR', primaryColor: '#E31937', secondaryColor: '#000000' },
    { id: '9727', name: 'Vancouver Whitecaps', slug: 'vancouver-whitecaps', abbreviation: 'VAN', primaryColor: '#00245E', secondaryColor: '#94C2E4' },
    { id: '22529', name: 'San Diego FC', slug: 'san-diego-fc', abbreviation: 'SDFC', primaryColor: '#181A18', secondaryColor: '#C39E6D' },
    // Historical
    { id: '1115', name: 'Chivas USA', slug: 'chivas-usa', abbreviation: 'CHV', primaryColor: '#E31937', secondaryColor: '#FFFFFF' },
    { id: '188', name: 'Miami Fusion', slug: 'miami-fusion', abbreviation: 'MF', primaryColor: '#EEB111', secondaryColor: '#000000' },
    { id: '192', name: 'Tampa Bay Mutiny', slug: 'tampa-bay-mutiny', abbreviation: 'TBM', primaryColor: '#00AEEF', secondaryColor: '#000000' }
];

async function seedTeams() {
    console.log('⚽ Seeding MLS teams...');
    for (const team of MLS_TEAMS) {
        const { error } = await supabase.from('mls_teams').upsert({
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
    console.log('✅ Seeded MLS teams');
}

async function scrapeRoster(teamId: string, season: number) {
    const url = `https://www.espn.com/soccer/team/squad/_/id/${teamId}/league/USA.1/season/${season}`;
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

            // Extract number - often in a span with class "pl2" or just at the start of the cell
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
    console.log('\n⚽ ESPN MLS Seeding');
    const args = process.argv.slice(2);
    const startYear = parseInt(args[0]) || 2024;
    const endYear = parseInt(args[1]) || startYear;
    const teamFilter = args[2];

    console.log(`📅 ${startYear} - ${endYear}\n`);

    await seedTeams();

    for (const team of MLS_TEAMS) {
        if (teamFilter && !team.slug.includes(teamFilter) && team.id !== teamFilter) continue;

        console.log(`🏆 ${team.name.toUpperCase()}`);
        for (let season = startYear; season <= endYear; season++) {
            console.log(`  📆 Season ${season}`);
            const players = await scrapeRoster(team.id, season);

            if (players.length > 0) {
                const { error } = await supabase.from('mls_rosters').upsert(players, {
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

            // Small delay to be polite to ESPN
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    console.log('\n✅ MLS ESPN Seeding Complete!');
}

main().catch(console.error);
