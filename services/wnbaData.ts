import { supabase } from './supabase';
import { Athlete, TeamMetadata } from '../types';

export interface WNBATeam {
  id: string;
  name: string;
  abbreviation: string;
  display_name: string;
  location: string;
  espn_id?: number;
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string;
  founded_year?: number;
  is_active: boolean;
}

export interface WNBAPlayer {
  player_name: string;
  jersey_number?: string;
  position?: string;
  height?: string;
  college?: string;
  years_pro?: number;
  weight?: string;
  birth_date?: string;
}

export interface WNBARosterData {
  team: WNBATeam;
  season: number;
  players: WNBAPlayer[];
}

/**
 * Fetch all WNBA teams (active and historical)
 */
export async function getWNBATeams(): Promise<WNBATeam[]> {
  const { data, error } = await supabase
    .from('wnba_teams')
    .select('*')
    .order('is_active', { ascending: false })
    .order('name');

  if (error) {
    console.error('Error fetching WNBA teams:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch available seasons for a specific WNBA team
 */
export async function getWNBATeamSeasons(teamId: string): Promise<number[]> {
  const { data, error } = await supabase
    .rpc('get_wnba_team_seasons', { team_id: teamId });

  if (error) {
    console.error('Error fetching team seasons:', error);
    throw error;
  }

  return (data || []).map((row: any) => row.season_year);
}

/**
 * Fetch roster for a specific team and season
 */
export async function getWNBARoster(teamId: string, seasonYear: number): Promise<WNBAPlayer[]> {
  const { data, error } = await supabase
    .from('wnba_rosters')
    .select('*')
    .eq('team_id', teamId)
    .eq('season_year', seasonYear)
    .order('jersey_number');

  if (error) {
    console.error('Error fetching WNBA roster:', error);
    throw error;
  }

  return (data || []).map(row => ({
    player_name: row.player_name,
    jersey_number: row.jersey_number,
    position: row.position,
    height: row.height,
    college: row.college,
    years_pro: row.years_pro,
    weight: row.weight,
    birth_date: row.birth_date
  }));
}

/**
 * Fetch complete roster data including team info
 */
export async function getWNBARosterData(teamId: string, seasonYear: number): Promise<WNBARosterData> {
  const [teamResult, rosterResult] = await Promise.all([
    supabase.from('wnba_teams').select('*').eq('id', teamId).single(),
    getWNBARoster(teamId, seasonYear)
  ]);

  if (teamResult.error) {
    console.error('Error fetching team:', teamResult.error);
    throw teamResult.error;
  }

  return {
    team: teamResult.data,
    season: seasonYear,
    players: rosterResult
  };
}

/**
 * Convert WNBA players to Athlete format for export
 */
export function convertWNBAPlayersToAthletes(players: WNBAPlayer[], seasonYear: number): Athlete[] {
  return players.map((player, index) => {
    // Generate display name (ALL CAPS, no accents)
    const displayNameSafe = player.player_name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase();

    return {
      id: `wnba-${seasonYear}-${index}`,
      originalName: player.player_name,
      fullName: player.player_name,
      displayNameSafe: displayNameSafe,
      jerseyNumber: player.jersey_number || '',
      position: player.position || '',
      phoneticIPA: '',
      phoneticSimplified: '',
      nilStatus: 'Active',
      seasonYear: seasonYear.toString(),
      bioStats: player.college ? `College: ${player.college}` : '',
      socialHandle: '',
      metadata: {
        height: player.height,
        yearsPro: player.years_pro,
        college: player.college
      }
    };
  });
}

/**
 * Get team metadata for exports
 */
export function getWNBATeamMetadata(team: WNBATeam): TeamMetadata {
  return {
    primaryColor: team.primary_color || '#000000',
    secondaryColor: team.secondary_color || '#FFFFFF',
    conference: '',
    abbreviation: team.abbreviation,
    logoUrl: team.logo_url
  };
}

/**
 * Get all available seasons (1997 to current year)
 */
export function getAvailableSeasons(): number[] {
  const currentYear = new Date().getFullYear();
  const seasons: number[] = [];

  for (let year = currentYear; year >= 1997; year--) {
    seasons.push(year);
  }

  return seasons;
}

/**
 * Fetch roster from ESPN API (for real-time data population)
 */
export async function fetchRosterFromESPN(teamId: string, seasonYear: number): Promise<WNBAPlayer[]> {
  // WNBA ESPN API endpoint
  // Note: ESPN API structure for WNBA: /wnba/teams/{team_id}/roster
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${teamId}/roster?season=${seasonYear}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.athletes || !Array.isArray(data.athletes)) {
      return [];
    }

    return data.athletes.map((athlete: any) => ({
      player_name: athlete.fullName || athlete.displayName,
      jersey_number: athlete.jersey?.toString() || '',
      position: athlete.position?.abbreviation || athlete.position?.name || '',
      height: athlete.displayHeight || athlete.height || '',
      weight: athlete.displayWeight || athlete.weight || '',
      college: athlete.college?.name || '',
      years_pro: athlete.experience?.years || 0,
      birth_date: athlete.dateOfBirth || null
    }));
  } catch (error) {
    console.error('Error fetching from ESPN:', error);
    return [];
  }
}

/**
 * Save roster data to database (for data population)
 */
export async function saveRosterToDatabase(
  teamId: string,
  seasonYear: number,
  players: WNBAPlayer[]
): Promise<void> {
  const records = players.map(player => ({
    team_id: teamId,
    season_year: seasonYear,
    player_name: player.player_name,
    jersey_number: player.jersey_number,
    position: player.position,
    height: player.height,
    weight: player.weight,
    college: player.college,
    years_pro: player.years_pro,
    birth_date: player.birth_date
  }));

  const { error } = await supabase
    .from('wnba_rosters')
    .upsert(records, {
      onConflict: 'team_id,season_year,player_name',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Error saving roster to database:', error);
    throw error;
  }
}
