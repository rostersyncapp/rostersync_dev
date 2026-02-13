/**
 * NBA StatMuse Roster Seeder
 * Scrapes NBA roster data from StatMuse and saves to Supabase.
 * Usage: npx tsx scripts/seed_nba_statmuse.ts [startYear] [endYear] [teamFilter]
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
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match && !line.trim().startsWith('#')) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                if (!process.env[key]) process.env[key] = value;
            }
        });
        console.log('✅ Loaded .env file');
    }
} catch (e) {
    console.warn('⚠️ Could not load .env file');
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface StatMuseTeam {
    id: string;
    slug: string;
    statmuseId: number;
}

const STATMUSE_NBA_TEAMS: StatMuseTeam[] = [
    { id: "atlanta-hawks", slug: "atlanta-hawks", statmuseId: 22 },
    { id: "boston-celtics", slug: "boston-celtics", statmuseId: 1 },
    { id: "brooklyn-nets", slug: "brooklyn-nets", statmuseId: 33 },
    { id: "charlotte-hornets", slug: "charlotte-hornets", statmuseId: 53 },
    { id: "chicago-bulls", slug: "chicago-bulls", statmuseId: 25 },
    { id: "cleveland-cavaliers", slug: "cleveland-cavaliers", statmuseId: 42 },
    { id: "dallas-mavericks", slug: "dallas-mavericks", statmuseId: 46 },
    { id: "denver-nuggets", slug: "denver-nuggets", statmuseId: 28 },
    { id: "detroit-pistons", slug: "detroit-pistons", statmuseId: 13 },
    { id: "golden-state-warriors", slug: "golden-state-warriors", statmuseId: 6 },
    { id: "houston-rockets", slug: "houston-rockets", statmuseId: 37 },
    { id: "indiana-pacers", slug: "indiana-pacers", statmuseId: 30 },
    { id: "la-clippers", slug: "la-clippers", statmuseId: 41 },
    { id: "los-angeles-lakers", slug: "los-angeles-lakers", statmuseId: 15 },
    { id: "memphis-grizzlies", slug: "memphis-grizzlies", statmuseId: 52 },
    { id: "miami-heat", slug: "miami-heat", statmuseId: 48 },
    { id: "milwaukee-bucks", slug: "milwaukee-bucks", statmuseId: 39 },
    { id: "minnesota-timberwolves", slug: "minnesota-timberwolves", statmuseId: 49 },
    { id: "new-orleans-pelicans", slug: "new-orleans-pelicans", statmuseId: 47 },
    { id: "new-york-knicks", slug: "new-york-knicks", statmuseId: 5 },
    { id: "oklahoma-city-thunder", slug: "oklahoma-city-thunder", statmuseId: 38 },
    { id: "orlando-magic", slug: "orlando-magic", statmuseId: 50 },
    { id: "philadelphia-76ers", slug: "philadelphia-76ers", statmuseId: 21 },
    { id: "phoenix-suns", slug: "phoenix-suns", statmuseId: 40 },
    { id: "portland-trail-blazers", slug: "portland-trail-blazers", statmuseId: 43 },
    { id: "sacramento-kings", slug: "sacramento-kings", statmuseId: 16 },
    { id: "san-antonio-spurs", slug: "san-antonio-spurs", statmuseId: 27 },
    { id: "toronto-raptors", slug: "toronto-raptors", statmuseId: 51 },
    { id: "utah-jazz", slug: "utah-jazz", statmuseId: 45 },
    { id: "washington-wizards", slug: "washington-wizards", statmuseId: 24 }
];

async function fetchNBAStatMuseRoster(team: StatMuseTeam, year: number) {
    const url = `https://www.statmuse.com/nba/team/${team.slug}-${team.statmuseId}/roster/${year}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const players: any[] = [];

        const table = $('table').first();
        if (!table.length) return [];

        const rows = table.find('tbody tr').length ? table.find('tbody tr') : table.find('tr').slice(1);

        rows.each((i, el) => {
            const cells = $(el).find('td');
            if (cells.length < 8) return;

            let jersey = cells.eq(0).text().trim();
            if (jersey && /^\d$/.test(jersey)) jersey = `0${jersey}`;

            let name = cells.eq(2).text().trim();

            // Remove diacritics/accents
            name = name.normalize('NFD').replace(/[\u0300-\u036f]/g, "");

            // Handle StatMuse name redundancy (e.g., "Ryan BurrR. Burr" or "Dominick BarlowD. Barlow")
            const match = name.match(/(.+?)\s?([A-Z]\. .+)$/);
            if (match) {
                let fullName = match[1].trim();
                const abbrev = match[2].trim();
                const initial = abbrev[0];
                const lastNamePart = abbrev.slice(3).trim();
                if (fullName.startsWith(initial) && fullName.endsWith(lastNamePart)) {
                    name = fullName;
                }
            }

            // Clean name logic
            const nameParts = name.split(' ');
            if (nameParts.length >= 3) {
                const lastPart = nameParts[nameParts.length - 1];
                const secondToLast = nameParts[nameParts.length - 2];
                if (secondToLast.includes('.') && lastPart === nameParts[nameParts.length - 3]) {
                    name = nameParts.slice(0, nameParts.length - 2).join(' ');
                }
            }

            const position = cells.eq(3).text().trim();
            const height = cells.eq(4).text().trim();
            const weight = cells.eq(5).text().trim();
            const dob_raw = cells.eq(6).text().trim();
            const college = cells.eq(8).text().trim();

            let birth_date = null;
            if (dob_raw) {
                const parts = dob_raw.split('/');
                if (parts.length === 3) {
                    birth_date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                }
            }

            if (name) {
                players.push({
                    team_id: team.id,
                    season_year: year,
                    player_name: name,
                    jersey_number: jersey || null,
                    position: position || null,
                    height: height || null,
                    weight: weight || null,
                    birth_date: birth_date,
                    college: college || null
                });
            }
        });

        return players.filter((p, index, self) =>
            index === self.findIndex((t) => (
                t.player_name === p.player_name && t.team_id === p.team_id && t.season_year === p.season_year
            ))
        );
    } catch (e) {
        console.error(`    ❌ Error fetching ${team.id} for ${year}:`, e);
        return [];
    }
}

async function seedNBAStatMuse(startYear?: number, endYear?: number, teamFilter?: string) {
    const sYear = startYear || 2026;
    const eYear = endYear || 2026;

    console.log(`\n🏀 StatMuse NBA Seeding\n📅 ${sYear} - ${eYear}\n`);

    const teamsToProcess = teamFilter
        ? STATMUSE_NBA_TEAMS.filter(t => t.id === teamFilter)
        : STATMUSE_NBA_TEAMS;

    for (const team of teamsToProcess) {
        console.log(`🏆 ${team.id.toUpperCase()}`);
        for (let year = sYear; year <= eYear; year++) {
            console.log(`  📆 Season ${year}`);
            const players = await fetchNBAStatMuseRoster(team, year);

            if (players.length > 0) {
                const { error } = await supabase
                    .from('nba_rosters')
                    .upsert(players, { onConflict: 'team_id,season_year,player_name' });

                if (error) {
                    console.error(`    ❌ DB Error:`, error);
                } else {
                    console.log(`    ✅ Saved ${players.length} players`);
                }
            }
            await new Promise(res => setTimeout(res, 800));
        }
    }
}

const args = process.argv.slice(2);
const sYear = args[0] ? parseInt(args[0]) : 2026;
const eYear = args[1] ? parseInt(args[1]) : sYear;
const tFilter = args[2];

seedNBAStatMuse(sYear, eYear, tFilter).then(() => {
    console.log('\n✅ NBA StatMuse Seeding Complete!');
});
