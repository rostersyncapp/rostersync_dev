/**
 * NFL StatMuse Roster Seeder
 * Scrapes NFL roster data from StatMuse and saves to Supabase.
 * Usage: npx tsx scripts/seed_nfl_statmuse.ts [startYear] [endYear] [teamFilter]
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
    name: string;
    abbrev?: string;
    colors?: string[];
    logo?: string;
}

const STATMUSE_NFL_TEAMS: StatMuseTeam[] = [
    { id: "baltimore-ravens", slug: "baltimore-ravens", statmuseId: 85, name: "Baltimore Ravens", abbrev: "BAL", colors: ["#241773", "#000000"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/baltimore-ravens.png" },
    { id: "buffalo-bills", slug: "buffalo-bills", statmuseId: 67, name: "Buffalo Bills", abbrev: "BUF", colors: ["#00338D", "#C60C30"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/buffalo-bills.png" },
    { id: "cincinnati-bengals", slug: "cincinnati-bengals", statmuseId: 80, name: "Cincinnati Bengals", abbrev: "CIN", colors: ["#FB4F14", "#000000"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/cincinnati-bengals.png" },
    { id: "cleveland-browns", slug: "cleveland-browns", statmuseId: 58, name: "Cleveland Browns", abbrev: "CLE", colors: ["#311D00", "#FF3C00"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/cleveland-browns.png" },
    { id: "denver-broncos", slug: "denver-broncos", statmuseId: 68, name: "Denver Broncos", abbrev: "DEN", colors: ["#002244", "#FB4F14"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/denver-broncos.png" },
    { id: "houston-texans", slug: "houston-texans", statmuseId: 86, name: "Houston Texans", abbrev: "HOU", colors: ["#03202F", "#A71930"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/houston-texans.png" },
    { id: "indianapolis-colts", slug: "indianapolis-colts", statmuseId: 66, name: "Indianapolis Colts", abbrev: "IND", colors: ["#002C5F", "#A2AAAD"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/indianapolis-colts.png" },
    { id: "jacksonville-jaguars", slug: "jacksonville-jaguars", statmuseId: 84, name: "Jacksonville Jaguars", abbrev: "JAX", colors: ["#006778", "#9F792C"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/jacksonville-jaguars.png" },
    { id: "kansas-city-chiefs", slug: "kansas-city-chiefs", statmuseId: 69, name: "Kansas City Chiefs", abbrev: "KC", colors: ["#E31837", "#FFB81C"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/kansas-city-chiefs.png" },
    { id: "las-vegas-raiders", slug: "las-vegas-raiders", statmuseId: 73, name: "Las Vegas Raiders", abbrev: "LV", colors: ["#000000", "#A5ACAF"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/las-vegas-raiders.png" },
    { id: "los-angeles-chargers", slug: "los-angeles-chargers", statmuseId: 74, name: "Los Angeles Chargers", abbrev: "LAC", colors: ["#0080C6", "#FFC20E"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/los-angeles-chargers.png" },
    { id: "miami-dolphins", slug: "miami-dolphins", statmuseId: 77, name: "Miami Dolphins", abbrev: "MIA", colors: ["#008E97", "#FC4C02"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/miami-dolphins.png" },
    { id: "new-england-patriots", slug: "new-england-patriots", statmuseId: 70, name: "New England Patriots", abbrev: "NE", colors: ["#002244", "#C60C30"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/new-england-patriots.png" },
    { id: "new-york-jets", slug: "new-york-jets", statmuseId: 71, name: "New York Jets", abbrev: "NYJ", colors: ["#125740", "#FFFFFF"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/new-york-jets.png" },
    { id: "pittsburgh-steelers", slug: "pittsburgh-steelers", statmuseId: 50, name: "Pittsburgh Steelers", abbrev: "PIT", colors: ["#FFB81C", "#101820"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/pittsburgh-steelers.png" },
    { id: "tennessee-titans", slug: "tennessee-titans", statmuseId: 72, name: "Tennessee Titans", abbrev: "TEN", colors: ["#0C2340", "#4B92DB"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/tennessee-titans.png" },
    { id: "arizona-cardinals", slug: "arizona-cardinals", statmuseId: 7, name: "Arizona Cardinals", abbrev: "ARI", colors: ["#97233F", "#000000"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/arizona-cardinals.png" },
    { id: "atlanta-falcons", slug: "atlanta-falcons", statmuseId: 78, name: "Atlanta Falcons", abbrev: "ATL", colors: ["#A71930", "#000000"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/atlanta-falcons.png" },
    { id: "carolina-panthers", slug: "carolina-panthers", statmuseId: 83, name: "Carolina Panthers", abbrev: "CAR", colors: ["#0085CA", "#101820"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/carolina-panthers.png" },
    { id: "chicago-bears", slug: "chicago-bears", statmuseId: 4, name: "Chicago Bears", abbrev: "CHI", colors: ["#0B162A", "#C83803"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/chicago-bears.png" },
    { id: "dallas-cowboys", slug: "dallas-cowboys", statmuseId: 75, name: "Dallas Cowboys", abbrev: "DAL", colors: ["#003594", "#869397"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/dallas-cowboys.png" },
    { id: "detroit-lions", slug: "detroit-lions", statmuseId: 46, name: "Detroit Lions", abbrev: "DET", colors: ["#0076B6", "#B0B7BC"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/detroit-lions.png" },
    { id: "green-bay-packers", slug: "green-bay-packers", statmuseId: 18, name: "Green Bay Packers", abbrev: "GB", colors: ["#204E32", "#FFB81C"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/green-bay-packers.png" },
    { id: "los-angeles-rams", slug: "los-angeles-rams", statmuseId: 53, name: "Los Angeles Rams", abbrev: "LAR", colors: ["#003594", "#FFA300"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/los-angeles-rams.png" },
    { id: "minnesota-vikings", slug: "minnesota-vikings", statmuseId: 76, name: "Minnesota Vikings", abbrev: "MIN", colors: ["#4F2683", "#FFC62F"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/minnesota-vikings.png" },
    { id: "new-orleans-saints", slug: "new-orleans-saints", statmuseId: 79, name: "New Orleans Saints", abbrev: "NO", colors: ["#D3BC8D", "#101820"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/new-orleans-saints.png" },
    { id: "new-york-giants", slug: "new-york-giants", statmuseId: 35, name: "New York Giants", abbrev: "NYG", colors: ["#0B2265", "#A71930"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/new-york-giants.png" },
    { id: "philadelphia-eagles", slug: "philadelphia-eagles", statmuseId: 49, name: "Philadelphia Eagles", abbrev: "PHI", colors: ["#004C54", "#A2AAAD"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/philadelphia-eagles.png" },
    { id: "san-francisco-49ers", slug: "san-francisco-49ers", statmuseId: 63, name: "San Francisco 49ers", abbrev: "SF", colors: ["#AA0000", "#B3995D"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/san-francisco-49ers.png" },
    { id: "seattle-seahawks", slug: "seattle-seahawks", statmuseId: 81, name: "Seattle Seahawks", abbrev: "SEA", colors: ["#002244", "#69BE28"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/seattle-seahawks.png" },
    { id: "tampa-bay-buccaneers", slug: "tampa-bay-buccaneers", statmuseId: 82, name: "Tampa Bay Buccaneers", abbrev: "TB", colors: ["#D50A0A", "#34302B"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/tampa-bay-buccaneers.png" },
    { id: "washington-commanders", slug: "washington-commanders", statmuseId: 48, name: "Washington Commanders", abbrev: "WAS", colors: ["#5A1414", "#FFB612"], logo: "https://rddqcxfalrlmlvirjlca.supabase.co/storage/v1/object/public/logos/nfl/washington-commanders.png" }
];

async function seedNFLTeams() {
    console.log('🏈 Seeding NFL teams...');
    const teams = STATMUSE_NFL_TEAMS.map(team => ({
        id: team.id,
        name: team.name,
        display_name: team.name,
        abbreviation: team.abbrev || team.slug.split('-').map(p => p[0]).join('').toUpperCase(),
        primary_color: team.colors?.[0] || null,
        secondary_color: team.colors?.[1] || null,
        logo_url: team.logo || null
    }));

    const { error } = await supabase
        .from('nfl_teams')
        .upsert(teams, { onConflict: 'id' });

    if (error) {
        console.error('❌ Error seeding NFL teams:', error);
    } else {
        console.log(`✅ Seeded ${teams.length} NFL teams`);
    }
}

async function fetchNFLStatMuseRoster(team: StatMuseTeam, year: number) {
    const url = `https://www.statmuse.com/nfl/team/${team.slug}-${team.statmuseId}/roster/${year}`;

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

            // Handle StatMuse name redundancy
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

async function seedNFLStatMuse(startYear?: number, endYear?: number, teamFilter?: string) {
    await seedNFLTeams();

    const sYear = startYear || 2025;
    const eYear = endYear || 2025;

    console.log(`\n🏈 StatMuse NFL Seeding\n📅 ${sYear} - ${eYear}\n`);

    const teamsToProcess = teamFilter
        ? STATMUSE_NFL_TEAMS.filter(t => t.id === teamFilter)
        : STATMUSE_NFL_TEAMS;

    for (const team of teamsToProcess) {
        console.log(`🏆 ${team.id.toUpperCase()}`);
        for (let year = sYear; year <= eYear; year++) {
            console.log(`  📆 Season ${year}`);
            const players = await fetchNFLStatMuseRoster(team, year);

            if (players.length > 0) {
                const { error } = await supabase
                    .from('nfl_rosters')
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
const sYear = args[0] ? parseInt(args[0]) : 2025;
const eYear = args[1] ? parseInt(args[1]) : sYear;
const tFilter = args[2];

seedNFLStatMuse(sYear, eYear, tFilter).then(() => {
    console.log('\n✅ NFL StatMuse Seeding Complete!');
});
