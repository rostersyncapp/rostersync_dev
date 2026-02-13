-- Rename ncaa_teams to ncaa_football_teams
ALTER TABLE public.ncaa_teams RENAME TO ncaa_football_teams;

-- Rename ncaa_rosters to ncaa_football_rosters
ALTER TABLE public.ncaa_rosters RENAME TO ncaa_football_rosters;

-- Rename unique constraint (not strictly necessary but good for consistency)
ALTER TABLE public.ncaa_football_rosters RENAME CONSTRAINT ncaa_rosters_team_id_season_year_player_name_player_id_key TO ncaa_football_rosters_unique_identity;

-- Update/Rename RPC functions

-- Drop old functions first
DROP FUNCTION IF EXISTS get_ncaa_roster(TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_ncaa_team_seasons(TEXT);

-- Create new functions with specific names

-- Helper function to get roster
CREATE OR REPLACE FUNCTION get_ncaa_football_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.ncaa_football_rosters AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.ncaa_football_rosters r
    WHERE r.team_id = p_team_id AND r.season_year = p_season_year
    ORDER BY r.player_name;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get available seasons for a team
CREATE OR REPLACE FUNCTION get_ncaa_football_team_seasons(p_team_id TEXT)
RETURNS TABLE (season_year INTEGER) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.season_year
    FROM public.ncaa_football_rosters r
    WHERE r.team_id = p_team_id
    ORDER BY r.season_year DESC;
END;
$$;
