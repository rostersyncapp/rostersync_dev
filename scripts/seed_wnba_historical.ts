#!/usr/bin/env ts-node
/**
 * WNBA Historical Roster Seeding Script - Wikipedia Scraper
 * 
 * Populates the wnba_historical_rosters table with data from Wikipedia
 * Covers all WNBA teams from 1997 (inaugural season) to present
 * Includes jersey numbers, which StatsCrew lacks!
 */

import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// WNBA team configuration with Wikipedia naming
const WNBA_TEAMS = [
    // Active teams
    { id: 'atlanta-dream', wiki: 'Atlanta_Dream', startYear: 2008, endYear: null },
    { id: 'chicago-sky', wiki: 'Chicago_Sky', startYear: 2006, endYear: null },
    { id: 'connecticut-sun', wiki: 'Connecticut_Sun', startYear: 1999, endYear: null },
    { id: 'indiana-fever', wiki: 'Indiana_Fever', startYear: 2000, endYear: null },
    { id: 'new-york-liberty', wiki: 'New_York_Liberty', startYear: 1997, endYear: null },
    { id: 'washington-mystics', wiki: 'Washington_Mystics', startYear: 1998, endYear: null },
    { id: 'dallas-wings', wiki: 'Dallas_Wings', startYear: 2018, endYear: null },
    { id: 'las-vegas-aces', wiki: 'Las_Vegas_Aces', startYear: 2018, endYear: null },
    { id: 'los-angeles-sparks', wiki: 'Los_Angeles_Sparks', startYear: 1997, endYear: null },
    { id: 'minnesota-lynx', wiki: 'Minnesota_Lynx', startYear: 1999, endYear: null },
    { id: 'phoenix-mercury', wiki: 'Phoenix_Mercury', startYear: 1997, endYear: null },
    { id: 'seattle-storm', wiki: 'Seattle_Storm', startYear: 2000, endYear: null },
];

interface WNBARosterEntry {
    team_id: string;
    season_year: number;
    player_name: string;
    player_id: string | null;
    jersey_number: string | null;
    position: string | null;
    height: string | null;
    weight: string | null;
    birth_date: string | null;
    college: string | null;
    years_pro: number | null;
}

async function fetchWikipediaRoster(teamName: string, seasonYear: number): Promise<WNBARosterEntry[]> {
    const url = `https://en.wikipedia.org/wiki/${seasonYear}_${teamName}_season`;

    try {
        console.log(`  🔄 Fetching: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.log(`  ⏭️  Page not found (may not exist for this year)`);
            } else {
                console.warn(`  ⚠️  HTTP ${response.status}`);
            }
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const players: WNBARosterEntry[] = [];

        // Find the roster table - it contains "roster" in the caption
        let rosterTable = $('table').filter((i, el) => {
            const caption = $(el).find('caption').text();
            return caption.toLowerCase().includes('roster');
        }).first();

        // If not found by caption, try finding by table structure (has Pos., No., Name columns)
        if (rosterTable.length === 0) {
            rosterTable = $('table').filter((i, el) => {
                const headers = $(el).find('th').map((i, th) => $(th).text().trim()).get();
                return headers.includes('Pos.') && headers.includes('No.') && headers.includes('Name');
            }).first();
        }

        if (rosterTable.length === 0) {
            console.log(`  ⏭️  No roster table found`);
            return [];
        }

        // Parse roster table rows
        rosterTable.find('tbody tr').each((index, row) => {
            const $row = $(row);
            const cells = $row.find('td');

            // Roster table structure: Pos, No, Nat (flag), Name, Height, Weight, DOB, From, Yrs
            if (cells.length >= 8) {
                const position = cells.eq(0).text().trim() || null;
                const jerseyNum = cells.eq(1).text().trim() || null;
                // Skip nationality cell (index 2)
                const playerName = cells.eq(3).text().trim();
                const height = cells.eq(4).text().trim() || null;
                const weight = cells.eq(5).text().trim() || null;
                const dob = cells.eq(6).text().trim() || null;
                const college = cells.eq(7).text().trim() || null;
                const yearsText = cells.eq(8).text().trim();

                // Parse years pro (could be "R" for rookie, or a number)
                let yearsPro: number | null = null;
                if (yearsText === 'R') {
                    yearsPro = 0;
                } else if (/^\d+$/.test(yearsText)) {
                    yearsPro = parseInt(yearsText);
                }

                if (playerName) {
                    players.push({
                        team_id: '', // Will be filled by caller
                        season_year: seasonYear,
                        player_name: playerName,
                        player_id: null,
                        jersey_number: jerseyNum,
                        position,
                        height,
                        weight: weight || null,
                        birth_date: dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
                        college: college || null,
                        years_pro: yearsPro,
                    });
                }
            }
        });

        console.log(`  ✅ Found ${players.length} players`);
        return players;
    } catch (error) {
        console.error(`  ❌ Error fetching roster:`, error);
        return [];
    }
}

async function seedTeamSeason(teamId: string, teamWiki: string, seasonYear: number): Promise<number> {
    const players = await fetchWikipediaRoster(teamWiki, seasonYear);

    if (players.length === 0) {
        return 0;
    }

    // Add team_id to each player entry
    const rosterEntries = players.map(p => ({ ...p, team_id: teamId }));

    // Batch insert with conflict handling
    const { data, error } = await supabase
        .from('wnba_historical_rosters')
        .upsert(rosterEntries, {
            onConflict: 'team_id,season_year,player_name',
            ignoreDuplicates: false  // Update if exists
        });

    if (error) {
        console.error(`  ❌ Database error:`, error);
        return 0;
    }

    console.log(`  💾 Inserted/updated ${rosterEntries.length} players`);
    return rosterEntries.length;
}

async function seedAllTeams(startYear?: number, endYear?: number) {
    const currentYear = new Date().getFullYear();
    const seedStartYear = startYear || 1997;
    const seedEndYear = endYear || currentYear - 1; // Wikipedia usually lags by 1 year

    console.log(`\n🏀 WNBA Historical Roster Seeding (Wikipedia)`);
    console.log(`📅 Years: ${seedStartYear} - ${seedEndYear}`);
    console.log(`📊 Teams: ${WNBA_TEAMS.length}\n`);

    let totalPlayers = 0;
    let totalSeasons = 0;

    for (const team of WNBA_TEAMS) {
        const teamStartYear = Math.max(team.startYear, seedStartYear);
        const teamEndYear = team.endYear
            ? Math.min(team.endYear, seedEndYear)
            : seedEndYear;

        console.log(`\n🏆 ${team.id.toUpperCase()} (${teamStartYear}-${teamEndYear || 'present'})`);

        for (let year = teamStartYear; year <= teamEndYear; year++) {
            console.log(`\n  📆 Season ${year}`);
            const playersAdded = await seedTeamSeason(team.id, team.wiki, year);
            totalPlayers += playersAdded;
            if (playersAdded > 0) totalSeasons++;

            // Rate limiting: be respectful to Wikipedia
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    console.log(`\n✅ Seeding Complete!`);
    console.log(`📈 Total Seasons: ${totalSeasons}`);
    console.log(`👥 Total Players: ${totalPlayers}`);
}

// CLI interface
const args = process.argv.slice(2);
const startYearArg = args[0] ? parseInt(args[0]) : undefined;
const endYearArg = args[1] ? parseInt(args[1]) : undefined;

seedAllTeams(startYearArg, endYearArg)
    .then(() => {
        console.log('\n🎉 Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
