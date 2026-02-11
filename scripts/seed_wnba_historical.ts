#!/usr/bin/env ts-node
/**
 * WNBA Historical Roster Seeding Script - StatsCrew Scraper
 * 
 * Populates the wnba_historical_rosters table with data from StatsCrew.com
 * Covers all WNBA teams from 1997 (inaugural season) to present
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

// WNBA team configuration with StatsCrew abbreviations
const WNBA_TEAMS = [
    // Active teams
    { id: 'atlanta-dream', abbr: 'ATL', startYear: 2008, endYear: null },
    { id: 'chicago-sky', abbr: 'CHI', startYear: 2006, endYear: null },
    { id: 'connecticut-sun', abbr: 'CON', startYear: 1999, endYear: null },
    { id: 'indiana-fever', abbr: 'IND', startYear: 2000, endYear: null },
    { id: 'new-york-liberty', abbr: 'NYL', startYear: 1997, endYear: null },
    { id: 'washington-mystics', abbr: 'WAS', startYear: 1998, endYear: null },
    { id: 'dallas-wings', abbr: 'DAL', startYear: 1998, endYear: null },
    { id: 'las-vegas-aces', abbr: 'LVA', startYear: 1997, endYear: null },
    { id: 'los-angeles-sparks', abbr: ' LAS', startYear: 1997, endYear: null },
    { id: 'minnesota-lynx', abbr: 'MIN', startYear: 1999, endYear: null },
    { id: 'phoenix-mercury', abbr: 'PHO', startYear: 1997, endYear: null },
    { id: 'seattle-storm', abbr: 'SEA', startYear: 2000, endYear: null },
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

async function fetchStatsCrewRoster(teamAbbr: string, seasonYear: number): Promise<WNBARosterEntry[]> {
    const url = `https://www.statscrew.com/womensbasketball/roster/t-${teamAbbr}/y-${seasonYear}`;

    try {
        console.log(`  🔄 Fetching: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`  ⚠️  HTTP ${response.status} for ${teamAbbr}, season ${seasonYear}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const players: WNBARosterEntry[] = [];

        // Find the roster table and extract rows
        $('table.sortable tbody tr').each((index, element) => {
            const $row = $(element);
            const $cells = $row.find('td');

            if ($cells.length >= 7) {
                const playerName = $cells.eq(0).text().trim();
                const position = $cells.eq(1).text().trim() || null;
                const birthDate = $cells.eq(2).attr('sorttable_customkey') || null; // YYYY-MM-DD format
                const height = $cells.eq(3).text().trim() || null;
                const weight = $cells.eq(4).text().trim() || null;
                const college = $cells.eq(5).text().trim() || null;

                if (playerName) {
                    players.push({
                        team_id: '', // Will be filled in by caller
                        season_year: seasonYear,
                        player_name: playerName,
                        player_id: null,
                        jersey_number: null, // StatsCrew doesn't provide jersey numbers
                        position,
                        height,
                        weight,
                        birth_date: birthDate,
                        college: college || null,
                        years_pro: null,
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

async function seedTeamSeason(teamId: string, teamAbbr: string, seasonYear: number): Promise<number> {
    const players = await fetchStatsCrewRoster(teamAbbr, seasonYear);

    if (players.length === 0) {
        console.log(`  ⏭️  No players found, skipping`);
        return 0;
    }

    // Add team_id to each player entry
    const rosterEntries = players.map(p => ({ ...p, team_id: teamId }));

    // Batch insert with conflict handling
    const { data, error } = await supabase
        .from('wnba_historical_rosters')
        .upsert(rosterEntries, {
            onConflict: 'team_id,season_year,player_name',
            ignoreDuplicates: true
        });

    if (error) {
        console.error(`  ❌ Database error:`, error);
        return 0;
    }

    console.log(`  💾 Inserted ${rosterEntries.length} players`);
    return rosterEntries.length;
}

async function seedAllTeams(startYear?: number, endYear?: number) {
    const currentYear = new Date().getFullYear();
    const seedStartYear = startYear || 1997;
    const seedEndYear = endYear || currentYear;

    console.log(`\n🏀 WNBA Historical Roster Seeding (StatsCrew)`);
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
            const playersAdded = await seedTeamSeason(team.id, team.abbr, year);
            totalPlayers += playersAdded;
            totalSeasons++;

            // Rate limiting: delay between requests to be respectful
            await new Promise(resolve => setTimeout(resolve, 1000));
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
