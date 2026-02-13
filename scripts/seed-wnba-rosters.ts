/**
 * WNBA Historical Roster Data Seeding Script
 * 
 * This script fetches WNBA roster data from ESPN API for all teams
 * and seasons from 1997 to present and populates the database.
 * 
 * Usage:
 *   npx ts-node scripts/seed-wnba-rosters.ts
 * 
 * Or with specific parameters:
 *   npx ts-node scripts/seed-wnba-rosters.ts --team=atlanta-dream --season=2024
 *   npx ts-node scripts/seed-wnba-rosters.ts --season=2024
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// WNBA Team ESPN IDs mapping
const TEAM_ESPN_IDS: Record<string, number> = {
  'atlanta-dream': 16,
  'chicago-sky': 17,
  'connecticut-sun': 18,
  'indiana-fever': 19,
  'new-york-liberty': 20,
  'washington-mystics': 21,
  'dallas-wings': 22,
  'las-vegas-aces': 23,
  'los-angeles-sparks': 24,
  'minnesota-lynx': 25,
  'phoenix-mercury': 26,
  'seattle-storm': 27,
  'charlotte-sting': 28,
  'cleveland-rockers': 29,
  'detroit-shock': 30,
  'houston-comets': 31,
  'miami-sol': 32,
  'orlando-miracle': 33,
  'portland-fire': 34,
  'sacramento-monarchs': 35,
  'san-antonio-stars': 36,
  'tulsa-shock': 37,
  'utah-starzz': 38,
};

interface ESPNPlayer {
  id?: string;
  fullName?: string;
  displayName?: string;
  jersey?: string | number;
  position?: {
    abbreviation?: string;
    name?: string;
  };
  displayHeight?: string;
  height?: string;
  displayWeight?: string;
  weight?: string;
  dateOfBirth?: string;
  birthPlace?: {
    city?: string;
    state?: string;
    country?: string;
  };
  college?: {
    name?: string;
    shortName?: string;
  };
  experience?: {
    years?: number;
    displayValue?: string;
  };
}

interface ESPNRosterResponse {
  team?: {
    id?: string;
    name?: string;
    displayName?: string;
  };
  athletes?: ESPNPlayer[];
  year?: number;
  season?: {
    year?: number;
  };
}

async function fetchRosterFromESPN(teamId: string, season: number): Promise<ESPNPlayer[]> {
  const espnId = TEAM_ESPN_IDS[teamId];
  if (!espnId) {
    console.warn(`No ESPN ID found for team: ${teamId}`);
    return [];
  }

  // ESPN API endpoint for WNBA rosters
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${espnId}/roster?season=${season}`;

  try {
    console.log(`  Fetching: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  No data available for ${teamId} in ${season}`);
        return [];
      }
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data: ESPNRosterResponse = await response.json();

    if (!data.athletes || !Array.isArray(data.athletes)) {
      console.log(`  No athletes data for ${teamId} in ${season}`);
      return [];
    }

    return data.athletes;
  } catch (error) {
    console.error(`  Error fetching ${teamId} ${season}:`, error);
    return [];
  }
}

async function saveRosterToDatabase(
  teamId: string,
  season: number,
  players: ESPNPlayer[]
): Promise<number> {
  if (players.length === 0) {
    return 0;
  }

  const records = players.map(player => ({
    team_id: teamId,
    season_year: season,
    player_name: player.fullName || player.displayName || 'Unknown',
    player_id: player.id || null,
    jersey_number: player.jersey?.toString() || null,
    position: player.position?.abbreviation || player.position?.name || null,
    height: player.displayHeight || player.height || null,
    weight: player.displayWeight || player.weight || null,
    birth_date: player.dateOfBirth ? new Date(player.dateOfBirth).toISOString().split('T')[0] : null,
    college: player.college?.name || player.college?.shortName || null,
    years_pro: player.experience?.years || null,
    status: 'active'
  }));

  const { error } = await supabase
    .from('wnba_rosters')
    .upsert(records, {
      onConflict: 'team_id,season_year,player_name',
      ignoreDuplicates: false
    });

  if (error) {
    console.error(`  Database error for ${teamId} ${season}:`, error);
    throw error;
  }

  return records.length;
}

async function getTeamsFromDatabase(): Promise<string[]> {
  const { data, error } = await supabase
    .from('wnba_teams')
    .select('id');

  if (error) {
    throw error;
  }

  return data?.map(t => t.id) || [];
}

async function seedTeamRosters(
  teamId: string,
  startYear: number = 1997,
  endYear: number = new Date().getFullYear()
): Promise<{ team: string; seasonsProcessed: number; totalPlayers: number }> {
  console.log(`\nProcessing team: ${teamId}`);
  let totalPlayers = 0;
  let seasonsProcessed = 0;

  for (let year = endYear; year >= startYear; year--) {
    // Skip years before team was founded (you could add this logic)

    const players = await fetchRosterFromESPN(teamId, year);

    if (players.length > 0) {
      const saved = await saveRosterToDatabase(teamId, year, players);
      totalPlayers += saved;
      seasonsProcessed++;
      console.log(`  ${year}: ${saved} players`);
    } else {
      console.log(`  ${year}: No data`);
    }

    // Rate limiting - be nice to ESPN API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return { team: teamId, seasonsProcessed, totalPlayers };
}

async function main() {
  console.log('🏀 WNBA Historical Roster Seeding Script');
  console.log('========================================\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const teamArg = args.find(arg => arg.startsWith('--team='))?.split('=')[1];
  const seasonArg = args.find(arg => arg.startsWith('--season='))?.split('=')[1];
  const singleSeason = seasonArg ? parseInt(seasonArg) : null;

  try {
    let teams: string[];

    if (teamArg) {
      teams = [teamArg];
      console.log(`Mode: Single team (${teamArg})`);
    } else {
      teams = await getTeamsFromDatabase();
      console.log(`Mode: All teams (${teams.length} teams)`);
    }

    if (singleSeason) {
      console.log(`Season: ${singleSeason} only`);
    } else {
      console.log('Seasons: 1997 to present');
    }

    const startYear = singleSeason || 1997;
    const endYear = singleSeason || new Date().getFullYear();

    console.log('\nStarting data fetch...\n');

    const results = [];

    for (const teamId of teams) {
      try {
        const result = await seedTeamRosters(teamId, startYear, endYear);
        results.push(result);
      } catch (error) {
        console.error(`Failed to process ${teamId}:`, error);
        results.push({ team: teamId, seasonsProcessed: 0, totalPlayers: 0 });
      }

      // Pause between teams
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n\n📊 Seeding Summary');
    console.log('==================');

    const totalSeasons = results.reduce((sum, r) => sum + r.seasonsProcessed, 0);
    const totalPlayersAll = results.reduce((sum, r) => sum + r.totalPlayers, 0);

    console.log(`\nTotal Teams: ${results.length}`);
    console.log(`Total Seasons: ${totalSeasons}`);
    console.log(`Total Players: ${totalPlayersAll}`);

    console.log('\nPer Team Breakdown:');
    results.forEach(r => {
      console.log(`  ${r.team}: ${r.seasonsProcessed} seasons, ${r.totalPlayers} players`);
    });

    console.log('\n✅ Seeding complete!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main();
