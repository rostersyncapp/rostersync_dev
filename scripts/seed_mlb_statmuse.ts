/**
 * MLB StatMuse Roster Seeder
 * Scrapes MLB roster data from StatMuse and saves to Supabase.
 * Usage: npx tsx scripts/seed_mlb_statmuse.ts [startYear] [endYear] [teamFilter]
 * Default: Seed 2025
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
                const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
                if (!process.env[key]) {
                    process.env[key] = value;
                }
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

const STATMUSE_MLB_TEAMS: StatMuseTeam[] = [
    { id: "arizona-diamondbacks", slug: "arizona-diamondbacks", statmuseId: 97 },
    { id: "atlanta-braves", slug: "atlanta-braves", statmuseId: 1 },
    { id: "baltimore-orioles", slug: "baltimore-orioles", statmuseId: 73 },
    { id: "boston-red-sox", slug: "boston-red-sox", statmuseId: 69 },
    { id: "chicago-cubs", slug: "chicago-cubs", statmuseId: 2 },
    { id: "chicago-white-sox", slug: "chicago-white-sox", statmuseId: 70 },
    { id: "cincinnati-reds", slug: "cincinnati-reds", statmuseId: 19 },
    { id: "cleveland-guardians", slug: "cleveland-guardians", statmuseId: 71 },
    { id: "colorado-rockies", slug: "colorado-rockies", statmuseId: 95 },
    { id: "detroit-tigers", slug: "detroit-tigers", statmuseId: 72 },
    { id: "houston-astros", slug: "houston-astros", statmuseId: 87 },
    { id: "kansas-city-royals", slug: "kansas-city-royals", statmuseId: 89 },
    { id: "los-angeles-angels", slug: "los-angeles-angels", statmuseId: 85 },
    { id: "los-angeles-dodgers", slug: "los-angeles-dodgers", statmuseId: 31 },
    { id: "miami-marlins", slug: "miami-marlins", statmuseId: 96 },
    { id: "milwaukee-brewers", slug: "milwaukee-brewers", statmuseId: 92 },
    { id: "minnesota-twins", slug: "minnesota-twins", statmuseId: 75 },
    { id: "new-york-mets", slug: "new-york-mets", statmuseId: 88 },
    { id: "new-york-yankees", slug: "new-york-yankees", statmuseId: 76 },
    { id: "oakland-athletics", slug: "oakland-athletics", statmuseId: 74 },
    { id: "philadelphia-phillies", slug: "philadelphia-phillies", statmuseId: 27 },
    { id: "pittsburgh-pirates", slug: "pittsburgh-pirates", statmuseId: 22 },
    { id: "san-diego-padres", slug: "san-diego-padres", statmuseId: 91 },
    { id: "san-francisco-giants", slug: "san-francisco-giants", statmuseId: 25 },
    { id: "seattle-mariners", slug: "seattle-mariners", statmuseId: 93 },
    { id: "st-louis-cardinals", slug: "st-louis-cardinals", statmuseId: 67 },
    { id: "tampa-bay-rays", slug: "tampa-bay-rays", statmuseId: 98 },
    { id: "texas-rangers", slug: "texas-rangers", statmuseId: 86 },
    { id: "toronto-blue-jays", slug: "toronto-blue-jays", statmuseId: 94 },
    { id: "washington-nationals", slug: "washington-nationals", statmuseId: 90 }
];

async function fetchMLBStatMuseRoster(team: StatMuseTeam, year: number) {
    const url = `https://www.statmuse.com/mlb/team/${team.slug}-${team.statmuseId}/roster/${year}`;

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
            const match = name.match(/(.+?)([A-Z]\. .+)$/);
            if (match) {
                const [, fullName, abbrev] = match;
                const initial = abbrev[0];
                const lastNamePart = abbrev.slice(3);
                if (fullName.startsWith(initial) && fullName.endsWith(lastNamePart)) {
                    name = fullName;
                }
            }

            // Clean name (strip abbreviated version if present) - Fallback for space cases
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
            const birthplace = cells.eq(8).text().trim();

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
                    birthplace: birthplace || null,
                    hardware_safe_name: name.toUpperCase()
                });
            }
        });

        // Filter duplicates
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

async function seedMLBStatMuse(startYear?: number, endYear?: number, teamFilter?: string) {
    const sYear = startYear || 2025;
    const eYear = endYear || 2025;

    console.log(`\n⚾ StatMuse MLB Seeding\n📅 ${sYear} - ${eYear}\n`);

    const summary: any[] = [];
    const teamsToProcess = teamFilter
        ? STATMUSE_MLB_TEAMS.filter(t => t.id === teamFilter)
        : STATMUSE_MLB_TEAMS;

    if (teamsToProcess.length === 0) {
        console.error(`❌ Team ${teamFilter} not found in mapping.`);
        return;
    }

    for (const team of teamsToProcess) {
        console.log(`🏆 ${team.id.toUpperCase()}`);
        let teamSaved = 0;
        let teamMissingYears: number[] = [];

        for (let year = sYear; year <= eYear; year++) {
            console.log(`  📆 Season ${year}`);
            const players = await fetchMLBStatMuseRoster(team, year);

            if (players.length > 0) {
                const { error } = await supabase
                    .from('mlb_rosters')
                    .upsert(players, { onConflict: 'team_id,season_year,player_name' });

                if (error) {
                    console.error(`    ❌ DB Error:`, error);
                } else {
                    console.log(`    ✅ Saved ${players.length} players`);
                    teamSaved += players.length;
                }
            } else {
                teamMissingYears.push(year);
            }
            await new Promise(res => setTimeout(res, 800));
        }

        summary.push({
            team: team.id,
            totalSaved: teamSaved,
            missing: teamMissingYears
        });
    }

    console.log('\n' + '='.repeat(60));
    console.log(`📊 SEEDING SUMMARY REPORT (${sYear}-${eYear})`);
    console.log('='.repeat(60));
    summary.forEach(s => {
        const missingStr = s.missing.length > 0 ? `❌ Missing: ${s.missing.join(', ')}` : '✅ All seasons present';
        console.log(`${s.team.padEnd(25)} | 👥 ${s.totalSaved.toString().padStart(4)} players | ${missingStr}`);
    });
    console.log('='.repeat(60));
}

const args = process.argv.slice(2);
const sYear = args[0] ? parseInt(args[0]) : 2025;
const eYear = args[1] ? parseInt(args[1]) : sYear;
const tFilter = args[2];

seedMLBStatMuse(sYear, eYear, tFilter).then(() => {
    console.log('\n✅ MLB StatMuse Seeding Complete!');
});
