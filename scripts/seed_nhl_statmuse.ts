/**
 * NHL StatMuse Roster Seeder
 * Scrapes NHL roster data from StatMuse and saves to Supabase.
 * Usage: npx tsx scripts/seed_nhl_statmuse.ts [startYear] [endYear]
 * Default: Seed 2025 (2024-25 season)
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

const STATMUSE_NHL_TEAMS: StatMuseTeam[] = [
    { id: "anaheim-ducks", slug: "anaheim-ducks", statmuseId: 32 },
    { id: "boston-bruins", slug: "boston-bruins", statmuseId: 6 },
    { id: "buffalo-sabres", slug: "buffalo-sabres", statmuseId: 19 },
    { id: "calgary-flames", slug: "calgary-flames", statmuseId: 21 },
    { id: "carolina-hurricanes", slug: "carolina-hurricanes", statmuseId: 26 },
    { id: "chicago-blackhawks", slug: "chicago-blackhawks", statmuseId: 11 },
    { id: "colorado-avalanche", slug: "colorado-avalanche", statmuseId: 27 },
    { id: "columbus-blue-jackets", slug: "columbus-blue-jackets", statmuseId: 36 },
    { id: "dallas-stars", slug: "dallas-stars", statmuseId: 15 },
    { id: "detroit-red-wings", slug: "detroit-red-wings", statmuseId: 12 },
    { id: "edmonton-oilers", slug: "edmonton-oilers", statmuseId: 25 },
    { id: "florida-panthers", slug: "florida-panthers", statmuseId: 33 },
    { id: "los-angeles-kings", slug: "los-angeles-kings", statmuseId: 14 },
    { id: "minnesota-wild", slug: "minnesota-wild", statmuseId: 37 },
    { id: "montreal-canadiens", slug: "montreal-canadiens", statmuseId: 1 },
    { id: "nashville-predators", slug: "nashville-predators", statmuseId: 34 },
    { id: "new-jersey-devils", slug: "new-jersey-devils", statmuseId: 23 },
    { id: "new-york-islanders", slug: "new-york-islanders", statmuseId: 22 },
    { id: "new-york-rangers", slug: "new-york-rangers", statmuseId: 10 },
    { id: "ottawa-senators", slug: "ottawa-senators", statmuseId: 30 },
    { id: "philadelphia-flyers", slug: "philadelphia-flyers", statmuseId: 16 },
    { id: "pittsburgh-penguins", slug: "pittsburgh-penguins", statmuseId: 17 },
    { id: "san-jose-sharks", slug: "san-jose-sharks", statmuseId: 29 },
    { id: "seattle-kraken", slug: "seattle-kraken", statmuseId: 39 },
    { id: "st-louis-blues", slug: "st-louis-blues", statmuseId: 18 },
    { id: "tampa-bay-lightning", slug: "tampa-bay-lightning", statmuseId: 31 },
    { id: "toronto-maple-leafs", slug: "toronto-maple-leafs", statmuseId: 5 },
    { id: "utah-hockey-club", slug: "utah-hockey-club", statmuseId: 40 }, // Mapped to our DB id
    { id: "vancouver-canucks", slug: "vancouver-canucks", statmuseId: 20 },
    { id: "vegas-golden-knights", slug: "vegas-golden-knights", statmuseId: 38 },
    { id: "washington-capitals", slug: "washington-capitals", statmuseId: 24 },
    { id: "winnipeg-jets", slug: "winnipeg-jets", statmuseId: 35 }
];

async function fetchNHLStatMuseRoster(team: StatMuseTeam, year: number) {
    let slug = team.slug;

    // Dynamic slug handling for Utah
    if (team.id === "utah-hockey-club") {
        slug = year >= 2026 ? "utah-mammoth" : "utah-hockey-club";
    }

    const url = `https://www.statmuse.com/nhl/team/${slug}-${team.statmuseId}/roster/${year}`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                return [];
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const players: any[] = [];

        // StatMuse rosters are typically in a table. The first table is usually the roster.
        const rowSelectors = [
            'table.min-w-full tr',
            'table.w-full tr',
            'div.flex.flex-col table tr'
        ];

        let rows: any = null;
        for (const selector of rowSelectors) {
            const r = $(selector);
            if (r.length > 1) {
                rows = r;
                break;
            }
        }

        if (!rows) return [];

        rows.each((i: number, el: any) => {
            if (i === 0) return; // Skip header

            const cells = $(el).find('td');
            if (cells.length < 8) return;

            let jersey = cells.eq(0).text().trim();
            // Pad jersey number if it's a single digit (1-9)
            if (jersey && /^\d$/.test(jersey)) {
                jersey = `0${jersey}`;
            }

            // StatMuse NHL roster has an image column at index 1, shifting indices by 1
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

            // Clean name: StatMuse often appends abbreviated name at the end (e.g. "Cam Atkinson C. Atkinson")
            // We want to strip the "C. Atkinson" part.
            // Pattern: Name + Space + [A-Z]. + Space + Name
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
            const birth_date_raw = cells.eq(6).text().trim();
            const birthplace = cells.eq(8).text().trim(); // Birthplace is at index 8

            // Basic birth date parsing (MM/DD/YYYY to YYYY-MM-DD)
            let birth_date = null;
            if (birth_date_raw) {
                const parts = birth_date_raw.split('/');
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
                    birthplace: birthplace || null
                });
            }
        });

        return players;
    } catch (e) {
        console.error(`    ❌ Error fetching ${team.id} for ${year}:`, e);
        return [];
    }
}

async function seedNHLStatMuse(startYear?: number, endYear?: number, teamFilter?: string) {
    const sYear = startYear || 2025;
    const eYear = endYear || 2025;

    console.log(`\n🏒 StatMuse NHL Seeding\n📅 ${sYear} - ${eYear}\n`);

    const summary: any[] = [];
    const teamsToProcess = teamFilter
        ? STATMUSE_NHL_TEAMS.filter(t => t.id === teamFilter)
        : STATMUSE_NHL_TEAMS;

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
            const players = await fetchNHLStatMuseRoster(team, year);

            if (players.length > 0) {
                // Filter duplicates in the local batch to avoid ON CONFLICT errors
                const uniquePlayers = players.filter((p, index, self) =>
                    index === self.findIndex((t) => (
                        t.player_name === p.player_name && t.team_id === p.team_id && t.season_year === p.season_year
                    ))
                );

                const { error } = await supabase
                    .from('nhl_rosters')
                    .upsert(uniquePlayers, { onConflict: 'team_id,season_year,player_name' });

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

    // Final Summary Report
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
const startYearArg = args[0] ? parseInt(args[0]) : 2025;
const endYearArg = args[1] ? parseInt(args[1]) : startYearArg;
const teamFilterArg = args[2];

seedNHLStatMuse(startYearArg, endYearArg, teamFilterArg).then(() => {
    console.log('\n✅ NHL StatMuse Seeding Complete!');
});
