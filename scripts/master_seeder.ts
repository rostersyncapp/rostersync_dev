/**
 * Master Roster Seeder
 * Unifies all league seeding scripts (Statmuse, ESPN, Wikipedia, BaseballCube) into a single tool.
 * 
 * Usage:
 *   npx tsx scripts/master_seeder.ts --league=nba --year=2024
 *   npx tsx scripts/master_seeder.ts --league=mls --year=2020-2025
 * 
 * Supported Leagues:
 *   nba, nfl, mlb, nhl, wnba, mls, nwsl, usl, ncaa-football, ncaa-men-basketball, wnba-historical, milb-triplea
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { LEAGUE_CONFIGS, LeagueConfig, TeamConfig } from './config/leagues';

dotenv.config();

// --- Supabase Setup ---

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Global Helpers ---

function normalizeName(name: string): string {
    return name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim();
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Engines ---

/**
 * Statmuse Engine: Handles NBA, NFL, MLB, NHL, WNBA
 */
async function runStatmuse(leagueKey: string, config: LeagueConfig, years: number[]) {
    for (const team of config.teams) {
        console.log(`🏆 [${config.name}] ${team.name.toUpperCase()}`);
        for (const year of years) {
            console.log(`  📆 Season ${year}`);

            // Handle NHL dynamic slug for Utah
            let slug = team.slug;
            if (leagueKey === 'nhl' && team.id === 'utah-hockey-club') {
                slug = year >= 2026 ? 'utah-mammoth' : 'utah-hockey-club';
            }

            const url = `https://www.statmuse.com/${leagueKey}/team/${slug}-${team.statmuseId}/roster/${year}`;

            try {
                const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $ = cheerio.load(response.data);
                const players: any[] = [];
                const table = $('table').first();
                if (!table.length) continue;

                const rows = table.find('tr').slice(1);
                rows.each((_, el) => {
                    const cells = $(el).find('td');
                    if (cells.length < 5) return;

                    let jersey = cells.eq(0).text().trim();
                    if (jersey && /^\d$/.test(jersey)) jersey = `0${jersey}`;

                    let name = normalizeName(cells.eq(2).text().trim());
                    // Deduplicate StatMuse name format "Player NameP. Name"
                    const match = name.match(/^(.+?)([A-Z]\. [A-Z].+)$/);
                    if (match && match[1].includes(match[2].split('. ')[1])) {
                        name = match[1].trim();
                    }

                    const pos = cells.eq(3).text().trim();
                    const height = cells.eq(4).text().trim();
                    const weight = cells.eq(5).text().trim();
                    const dobRaw = cells.eq(6).text().trim();
                    const college = cells.eq(8).text().trim();

                    if (!name || name.toLowerCase() === 'player') return;

                    let birthDate = null;
                    if (dobRaw && dobRaw.includes('/')) {
                        const parts = dobRaw.split('/');
                        if (parts.length === 3) {
                            birthDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                        }
                    }

                    players.push({
                        team_id: team.id,
                        season_year: year,
                        player_name: name,
                        jersey_number: jersey || null,
                        position: pos || null,
                        height: height || null,
                        weight: weight || null,
                        birth_date: birthDate,
                        college: college || null,
                        hardware_safe_name: name.toUpperCase()
                    });
                });

                if (players.length > 0) {
                    const uniquePlayers = players.filter((p, index, self) =>
                        index === self.findIndex((t) => (t.player_name === p.player_name))
                    );
                    const { error } = await supabase.from(config.table).upsert(uniquePlayers, { onConflict: 'team_id,season_year,player_name' });
                    if (error) console.error(`    ❌ DB Error: ${error.message}`);
                    else console.log(`    ✅ Saved ${uniquePlayers.length} players`);
                }
            } catch (err) {
                console.warn(`    ⏭️ No data or error for ${team.id} ${year}`);
            }
            await sleep(800);
        }
    }
}

/**
 * ESPN API Engine: Handles NCAA
 */
async function runEspnApi(config: LeagueConfig, years: number[]) {
    for (const team of config.teams) {
        console.log(`🏆 [${config.name}] ${team.name.toUpperCase()}`);
        for (const year of years) {
            console.log(`  📆 Season ${year}`);
            const url = `https://site.api.espn.com/apis/common/v3/sports/${config.espnSport}/${config.espnLeague}/teams/${team.id}/roster?season=${year}`;

            try {
                const response = await axios.get(url);
                const athleteGroups = response.data.athletes || response.data.positionGroups;
                if (!athleteGroups) continue;

                const players: any[] = [];
                for (const group of athleteGroups) {
                    const list = group.athletes || group.items;
                    if (!list) continue;
                    for (const a of list) {
                        players.push({
                            team_id: team.id,
                            season_year: year,
                            player_id: a.id,
                            player_name: a.fullName || a.name || a.displayName,
                            jersey_number: a.jersey || null,
                            position: a.position?.abbreviation || null,
                            height: a.displayHeight || null,
                            weight: a.displayWeight || null,
                            hardware_safe_name: (a.fullName || a.name).toUpperCase()
                        });
                    }
                }

                if (players.length > 0) {
                    const { error } = await supabase.from(config.table).upsert(players, { onConflict: 'team_id,season_year,player_name,player_id' });
                    if (error) console.error(`    ❌ Error: ${error.message}`);
                    else console.log(`    ✅ Saved ${players.length} players`);
                }
            } catch (err) {
                console.warn(`    ⚠️ Failed ${team.id} ${year}`);
            }
            await sleep(300);
        }
    }
}

/**
 * ESPN HTML Engine: Handles MLS, NWSL, USL
 */
async function runEspnHtml(config: LeagueConfig, years: number[]) {
    for (const team of config.teams) {
        console.log(`🏆 [${config.name}] ${team.name.toUpperCase()}`);
        const teamId = team.espnId || team.id;
        for (const year of years) {
            console.log(`  📆 Season ${year}`);
            const url = `https://www.espn.com/${config.espnSport}/team/squad/_/id/${teamId}/season/${year}`;

            try {
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const $ = cheerio.load(response.data);
                const players: any[] = [];

                $('table.Table tbody tr.Table__TR').each((_, row) => {
                    const cells = $(row).find('td');
                    if (cells.length < 3) return;

                    const nameCell = cells.eq(0);
                    const name = nameCell.find('a').text().trim() || nameCell.text().trim().replace(/^\d+/, '').trim();
                    let jersey = nameCell.find('span').text().trim();
                    if (!jersey) jersey = nameCell.text().trim().match(/^\d+/)?.[0] || '';

                    if (!name || name === 'Name') return;

                    players.push({
                        team_id: teamId,
                        season_year: year,
                        player_name: name,
                        jersey_number: jersey || null,
                        position: cells.eq(1).text().trim(),
                        hardware_safe_name: name.toUpperCase()
                    });
                });

                if (players.length > 0) {
                    const { error } = await supabase.from(config.table).upsert(players, { onConflict: 'team_id,season_year,player_name' });
                    if (error) console.error(`    ❌ Error: ${error.message}`);
                    else console.log(`    ✅ Saved ${players.length} players`);
                }
            } catch (err: any) {
                console.warn(`    ⚠️ Failed ${team.id} ${year}: ${err.message}`);
            }
            await sleep(500);
        }
    }
}

/**
 * BaseballCube Engine: Handles MiLB
 */
async function runBaseballCube(leagueKey: string, config: LeagueConfig, years: number[]) {
    const leaguesToProcess = leagueKey === 'milb-triplea' ? ['IL', 'PCL'] : [leagueKey];

    for (const year of years) {
        console.log(`📅 --- Processing Season: ${year} ---`);
        for (const leagueId of leaguesToProcess) {
            const effectiveLeagueId = year >= 2021 ? `${leagueId}2` : leagueId;
            const url = `https://thebaseballcube.com/content/minor_summary/${year}~${effectiveLeagueId}/`;
            console.log(`🔍 Fetching teams for ${leagueId} in ${year}...`);

            try {
                const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $ = cheerio.load(response.data);
                const foundTeams: TeamConfig[] = [];

                $('a[href*="/content/stats_minor/"]').each((_, link) => {
                    const href = $(link).attr('href') || '';
                    const match = href.match(/stats_minor\/(\d+)~(\d+)\//);
                    const displayName = $(link).text().trim();

                    if (match && match[1] === year.toString() && displayName && !displayName.includes('Logos')) {
                        const cubeId = parseInt(match[2]);
                        const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        foundTeams.push({ id: `${slug}-${cubeId}`, name: displayName, slug, cubeId });
                    }
                });

                console.log(`✅ Found ${foundTeams.length} teams. Upserting teams and fetching rosters...`);

                // Update milb_teams table
                await supabase.from('milb_teams').upsert(foundTeams.map(t => ({
                    id: t.id, name: t.name, display_name: t.name, league_id: leagueId, cube_id: t.cubeId
                })));

                for (const team of foundTeams) {
                    const rosterUrl = `https://thebaseballcube.com/content/stats_minor/${year}~${team.cubeId}/`;
                    const res = await axios.get(rosterUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                    const $$ = cheerio.load(res.data);
                    const players: any[] = [];

                    $$('table').filter((_, el) => $$(el).text().toLowerCase().includes('player') && $$(el).text().toLowerCase().includes('pos')).first().find('tr').each((i, row) => {
                        const cells = $$(row).find('td');
                        if (cells.length >= 4) {
                            const jersey = cells.eq(0).text().trim();
                            const playerName = cells.eq(1).find('a').first().text().trim() || cells.eq(1).text().trim();
                            if (playerName && playerName.toLowerCase() !== 'player' && jersey !== '#') {
                                players.push({
                                    team_id: team.id,
                                    season_year: year,
                                    player_name: playerName,
                                    jersey_number: (jersey !== '-' && jersey !== '#') ? jersey : null,
                                    player_position: cells.eq(3).text().trim() || null
                                });
                            }
                        }
                    });

                    if (players.length > 0) {
                        const { error } = await supabase.from('milb_rosters').upsert(players, { onConflict: 'team_id,season_year,player_name' });
                        if (!error) console.log(`    💾 Saved ${players.length} players for ${team.name}`);
                    }
                    await sleep(1000);
                }

            } catch (err) {
                console.warn(`    ⚠️ Error processing ${leagueId} ${year}`);
            }
        }
    }
}

/**
 * Wikipedia Engine: Handles Historical WNBA
 */
async function runWikipedia(config: LeagueConfig, years: number[]) {
    for (const team of config.teams) {
        console.log(`🏆 [${config.name}] ${team.name.toUpperCase()}`);
        for (const year of years) {
            const mapping = team.wikiMappings?.find(m => !m.untilYear || year <= m.untilYear) || team.wikiMappings?.[team.wikiMappings.length - 1];
            const wikiName = mapping?.name || team.name.replace(/ /g, '_');
            const url = `https://en.wikipedia.org/wiki/${year}_${wikiName}_season`;
            console.log(`  🔍 Fetching ${url}`);

            try {
                const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
                const $ = cheerio.load(response.data);
                const players: any[] = [];

                // Simplified wiki parsing (Logic from seed_wnba_historical.ts)
                const table = $('.toccolours').first().length ? $('.toccolours').first() : $('table.wikitable').first();
                table.find('tr').each((_, row) => {
                    const cells = $(row).find('td');
                    if (cells.length < 5) return;

                    const nameCell = cells.find('a').first();
                    const name = nameCell.text().trim();
                    if (!name) return;

                    players.push({
                        team_id: team.id,
                        season_year: year,
                        player_name: name,
                        hardware_safe_name: name.toUpperCase()
                    });
                });

                if (players.length > 0) {
                    const { error } = await supabase.from(config.table).upsert(players, { onConflict: 'team_id,season_year,player_name' });
                    if (!error) console.log(`    ✅ Saved ${players.length} players`);
                }
            } catch (err) {
                console.warn(`    ⚠️ Failed ${url}`);
            }
            await sleep(1000);
        }
    }
}

// --- Main Runner ---

async function main() {
    const args = process.argv.slice(2);
    const leagueArg = args.find(a => a.startsWith('--league='))?.split('=')[1];
    const yearArg = args.find(a => a.startsWith('--year='))?.split('=')[1];
    const teamArg = args.find(a => a.startsWith('--team='))?.split('=')[1];

    if (!leagueArg || !yearArg) {
        console.log('Usage: npx tsx scripts/master_seeder.ts --league=[league] --year=[YYYY or YYYY-YYYY] [--team=slug]');
        console.log('Available Leagues:', Object.keys(LEAGUE_CONFIGS).join(', '));
        process.exit(1);
    }

    const config = LEAGUE_CONFIGS[leagueArg];
    if (!config) {
        console.error(`❌ League ${leagueArg} not supported.`);
        process.exit(1);
    }

    const years: number[] = [];
    if (yearArg.includes('-')) {
        const [start, end] = yearArg.split('-').map(Number);
        for (let y = start; y <= end; y++) years.push(y);
    } else {
        years.push(parseInt(yearArg));
    }

    if (teamArg) {
        config.teams = config.teams.filter(t => t.id === teamArg || t.slug === teamArg);
    }

    console.log(`🚀 Starting Master Seeder for ${config.name}`);
    console.log(`📅 Years: ${years.join(', ')}`);

    switch (config.source) {
        case 'statmuse':
            await runStatmuse(leagueArg, config, years);
            break;
        case 'espn-api':
            await runEspnApi(config, years);
            break;
        case 'espn-html':
            await runEspnHtml(config, years);
            break;
        case 'baseball-cube':
            await runBaseballCube(leagueArg, config, years);
            break;
        case 'wikipedia':
            await runWikipedia(config, years);
            break;
        default:
            console.error('❌ Engine not yet implemented in master.');
    }

    console.log('\n🏁 Seeding Complete!');
}

main().catch(console.error);
