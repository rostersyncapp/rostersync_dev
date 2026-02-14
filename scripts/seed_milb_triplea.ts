import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface MilbTeam {
    id: string;
    name: string;
    display_name: string;
    league_id: string;
    cube_id: number;
}

interface MilbRosterEntry {
    team_id: string;
    season_year: number;
    player_name: string;
    jersey_number: string | null;
    player_position: string | null;
}

const LEAGUES = [
    { id: 'IL', cube_id: 'IL' },
    { id: 'PCL', cube_id: 'PCL' }
];

async function fetchTeamsForLeague(leagueId: string, year: number): Promise<MilbTeam[]> {
    const url = `https://thebaseballcube.com/content/minor_summary/${year}~${leagueId}/`;
    console.log(`🔍 Fetching teams for ${leagueId} in ${year}...`);

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        const $ = cheerio.load(html);
        const teamsMap = new Map<string, MilbTeam>();

        // Standings table rows contain the team links
        $('table.standings-table tr, table tr').each((i, row) => {
            const link = $(row).find('a[href*="/content/stats_minor/"]').first();
            if (link.length) {
                const href = link.attr('href') || '';
                const match = href.match(/stats_minor\/(\d+)~(\d+)\//);
                if (match) {
                    const yearInUrl = match[1];
                    const cubeId = match[2];
                    const displayName = link.text().trim();
                    const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                    const teamId = `${slug}-${cubeId}`;

                    if (yearInUrl === year.toString() && !teamsMap.has(teamId)) {
                        teamsMap.set(teamId, {
                            id: teamId,
                            name: displayName,
                            display_name: displayName,
                            league_id: leagueId,
                            cube_id: parseInt(cubeId)
                        });
                    }
                }
            }
        });

        const teams = Array.from(teamsMap.values());
        console.log(`✅ Found ${teams.length} unique teams in ${leagueId}`);
        return teams;
    } catch (error) {
        console.error(`❌ Error fetching league ${leagueId}:`, error);
        return [];
    }
}

async function fetchTeamRoster(team: MilbTeam, year: number): Promise<MilbRosterEntry[]> {
    const url = `https://thebaseballcube.com/content/stats_minor/${year}~${team.cube_id}/`;
    console.log(`  📅 [${year}] Scrapping Roster: ${team.display_name}...`);

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);

        // The site uses tables for rosters. We look for a table after a "Season Roster" heading.
        // Based on research, the table lives in a grid-content div or just after a header.
        const rosterTable = $('table').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            return text.includes('player') && text.includes('pos');
        }).first();

        if (!rosterTable.length) {
            console.log(`    ⚠️ No roster table found for ${team.display_name}`);
            return [];
        }

        const rosterMap = new Map<string, MilbRosterEntry>();
        rosterTable.find('tr').each((i, row) => {
            const cells = $(row).find('td');
            if (cells.length >= 4) {
                const jersey = cells.eq(0).text().trim();
                const playerName = cells.eq(1).find('a').first().text().trim() || cells.eq(1).text().trim();
                const position = cells.eq(3).text().trim();

                if (playerName && playerName !== 'Player' && !rosterMap.has(playerName)) {
                    rosterMap.set(playerName, {
                        team_id: team.id,
                        season_year: year,
                        player_name: playerName,
                        jersey_number: jersey !== '-' ? jersey : null,
                        player_position: position || null
                    });
                }
            }
        });

        const roster = Array.from(rosterMap.values());
        console.log(`    ✅ Found ${roster.length} unique players`);
        return roster;
    } catch (error) {
        console.error(`    ❌ Error fetching roster for ${team.display_name}:`, error);
        return [];
    }
}

async function seedMilbTripleA(startYear: number = 2000, endYear: number = startYear, tFilter?: string) {
    console.log(`\n⚾ MiLB Triple-A Seeding Process (${startYear === endYear ? startYear : `${startYear} - ${endYear}`})\n`);

    for (let year = startYear; year <= endYear; year++) {
        console.log(`\n📅 --- Processing Season: ${year} ---`);
        for (const league of LEAGUES) {
            let teams = await fetchTeamsForLeague(league.id, year);

            if (tFilter) {
                teams = teams.filter(t => t.id.toLowerCase().includes(tFilter.toLowerCase()) || t.name.toLowerCase().includes(tFilter.toLowerCase()));
            }

            if (teams.length > 0) {
                const { error: teamError } = await supabase
                    .from('milb_teams')
                    .upsert(teams.map(t => ({
                        id: t.id,
                        name: t.name,
                        display_name: t.display_name,
                        league_id: t.league_id,
                        cube_id: t.cube_id
                    })));

                if (teamError) {
                    console.error(`❌ Error saving teams for ${league.id}:`, teamError);
                    continue;
                }

                // 2. Fetch and Save Rosters
                for (const team of teams) {
                    const roster = await fetchTeamRoster(team, year);
                    if (roster.length > 0) {
                        const { error: rosterError } = await supabase
                            .from('milb_rosters')
                            .upsert(roster, { onConflict: 'team_id,season_year,player_name' });

                        if (rosterError) {
                            console.error(`    ❌ Database error saving roster:`, rosterError);
                        } else {
                            console.log(`    💾 Saved ${roster.length} players to database`);
                        }
                    }
                    // Sleep to be polite to the server
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
        }

    }

    console.log('\n✅ MiLB Seeding Complete!');
}

const args = process.argv.slice(2);
const sYear = args[0] ? parseInt(args[0]) : 2000;
const eYear = args[1] ? parseInt(args[1]) : sYear;
const teamFilter = args[2];

seedMilbTripleA(sYear, eYear, teamFilter).catch(console.error);
