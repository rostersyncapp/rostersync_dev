-- Migration to create NCAA Football teams and rosters tables
-- Data source: ESPN

-- Create ncaa_teams table
CREATE TABLE IF NOT EXISTS public.ncaa_teams (
    id TEXT PRIMARY KEY, -- ESPN ID
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    slug TEXT NOT NULL,
    abbreviation TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for ncaa_teams
ALTER TABLE public.ncaa_teams ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Enable read access for all users on ncaa_teams'
    ) THEN
        CREATE POLICY "Enable read access for all users on ncaa_teams" ON public.ncaa_teams
            FOR SELECT USING (true);
    END IF;
END $$;

-- Create ncaa_rosters table
CREATE TABLE IF NOT EXISTS public.ncaa_rosters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES public.ncaa_teams(id) ON DELETE CASCADE,
    season_year INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_id TEXT, -- ESPN player ID
    jersey_number TEXT,
    position TEXT,
    height TEXT,
    weight TEXT,
    age INTEGER,
    class TEXT, -- Freshman, Sophomore, etc.
    nationality TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, season_year, player_name, player_id)
);

-- Enable RLS for ncaa_rosters
ALTER TABLE public.ncaa_rosters ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Enable read access for all users on ncaa_rosters'
    ) THEN
        CREATE POLICY "Enable read access for all users on ncaa_rosters" ON public.ncaa_rosters
            FOR SELECT USING (true);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ncaa_rosters_team_season ON public.ncaa_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_ncaa_rosters_player_name ON public.ncaa_rosters(player_name);

-- Helper function to get roster
CREATE OR REPLACE FUNCTION get_ncaa_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.ncaa_rosters AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.ncaa_rosters r
    WHERE r.team_id = p_team_id AND r.season_year = p_season_year
    ORDER BY r.player_name;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get available seasons for a team
CREATE OR REPLACE FUNCTION get_ncaa_team_seasons(p_team_id TEXT)
RETURNS TABLE (season_year INTEGER) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.season_year
    FROM public.ncaa_rosters r
    WHERE r.team_id = p_team_id
    ORDER BY r.season_year DESC;
END;
$$;
