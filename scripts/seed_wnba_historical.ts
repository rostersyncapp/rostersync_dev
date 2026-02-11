#!/usr/bin/env ts-node
/**
 * WNBA Historical Roster Seeding Script
 * 
 * Populates the wnba_historical_rosters table with data from ESPN API
 * Covers all WNBA teams from 1997 (inaugural season) to present
 */

import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials. Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// WNBA team configuration with ESPN IDs and active date ranges
const WNBA_TEAMS = [
    // Active teams
    { id: 'atlanta-dream', espnId: 16, startYear: 2008, endYear: null },
    { id: 'chicago-sky', espnId: 17, startYear: 2006, endYear: null },
    { id: 'connecticut-sun', espnId: 18, startYear: 1999, endYear: null },
    { id: 'indiana-fever', espnId: 19, startYear: 2000, endYear: null },
    { id: 'new-york-liberty', espnId: 20, startYear: 1997, endYear: null },
    { id: 'washington-mystics', espnId: 21, startYear: 1998, endYear: null },
    { id: 'dallas-wings', espnId: 22, startYear: 1998, endYear: null },
    { id: 'las-vegas-aces', espnId: 23, startYear: 1997, endYear: null },
    { id: 'los-angeles-sparks', espnId: 24, startYear: 1997, endYear: null },
    { id: 'minnesota-lynx', espnId: 25, startYear: 1999, endYear: null },
    { id: 'phoenix-mercury', espnId: 26, startYear: 1997, endYear: null },
    { id: 'seattle-storm', espnId: 27, startYear: 2000, endYear: null },

    // Historical teams (no longer active)
    { id: 'charlotte-sting', espnId: 28, startYear: 1997, endYear: 2006 },
    { id: 'cleveland-rockers', espnId: 29, startYear: 1997, endYear: 2003 },
    { id: 'detroit-shock', espnId: 30, startYear: 1998, endYear: 2009 },
    { id: 'houston-comets', espnId: 31, startYear: 1997, endYear: 2008 },
    { id: 'miami-sol', espnId: 32, startYear: 2000, endYear: 2002 },
    { id: 'orlando-miracle', espnId: 33, startYear: 1999, endYear: 2002 },
    { id: 'portland-fire', espnId: 34, startYear: 2000, endYear: 2002 },
    { id: 'sacramento-monarchs', espnId: 35, startYear: 1997, endYear: 2009 },
    { id: 'san-antonio-stars', espnId: 36, startYear: 2003, endYear: 2017 },
    { id: 'tulsa-shock', espnId: 37, startYear: 2010, endYear: 2015 },
    { id: 'utah-starzz', espnId: 38, startYear: 1997, endYear: 2002 },
];

interface ESPNPlayer {
    id?: string;
    displayName?: string;
    fullName?: string;
    jersey?: string;
    position?: {
        abbreviation?: string;
        name?: string;
    };
    height?: string;
    weight?: string;
    college?: {
        name?: string;
    };
    experience?: {
        years?: number;
    };
    dateOfBirth?: string;
}

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

async function fetchESPNWNBARoster(espnId: number, seasonYear: number): Promise<ESPNPlayer[]> {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${espnId}/roster?season=${seasonYear}`;

    try {
        console.log(`  🔄 Fetching: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`  ⚠️  HTTP ${response.status} for ESPN ID ${espnId}, season ${seasonYear}`);
            return [];
        }

        const data = await response.json();
        const players: ESPNPlayer[] = [];

        // ESPN WNBA roster structure: data.athletes is array of groups
        if (data.athletes && Array.isArray(data.athletes)) {
            for (const group of data.athletes) {
                if (group.items && Array.isArray(group.items)) {
                    players.push(...group.items);
                }
                // Sometimes athletes are directly in the group
                else if (group.displayName || group.fullName) {
                    players.push(group);
                }
            }
        }

        console.log(`  ✅ Found ${players.length} players`);
        return players;
    } catch (error) {
        console.error(`  ❌ Error fetching roster:`, error);
        return [];
    }
}

function convertESPNPlayerToRosterEntry(
    player: ESPNPlayer,
    teamId: string,
    seasonYear: number
): WNBARosterEntry | null {
    const name = player.fullName || player.displayName;
    if (!name) {
        console.warn('  ⚠️  Skipping player with no name');
        return null;
    }

    return {
        team_id: teamId,
        season_year: seasonYear,
        player_name: name,
        player_id: player.id?.toString() || null,
        jersey_number: player.jersey || null,
        position: player.position?.abbreviation || player.position?.name || null,
        height: player.height || null,
        weight: player.weight ? `${player.weight}` : null,
        birth_date: player.dateOfBirth || null,
        college: player.college?.name || null,
        years_pro: player.experience?.years ?? null,
    };
}

async function seedTeamSeason(teamId: string, espnId: number, seasonYear: number): Promise<number> {
    const players = await fetchESPNWNBARoster(espnId, seasonYear);

    if (players.length === 0) {
        console.log(`  ⏭️  No players found, skipping`);
        return 0;
    }

    const rosterEntries = players
        .map(p => convertESPNPlayerToRosterEntry(p, teamId, seasonYear))
        .filter((entry): entry is WNBARosterEntry => entry !== null);

    if (rosterEntries.length === 0) {
        return 0;
    }

    // Batch insert with conflict handling (ON CONFLICT DO NOTHING handled by UNIQUE constraint)
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

    console.log(`\n🏀 WNBA Historical Roster Seeding`);
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
            const playersAdded = await seedTeamSeason(team.id, team.espnId, year);
            totalPlayers += playersAdded;
            totalSeasons++;

            // Rate limiting: small delay to avoid hammering ESPN
            await new Promise(resolve => setTimeout(resolve, 500));
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
