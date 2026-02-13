-- Migration to create NWSL teams and rosters tables
-- NWSL: USA.NWSL on ESPN

-- Create nwsl_teams table
CREATE TABLE IF NOT EXISTS public.nwsl_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    abbreviation TEXT,
    primary_color TEXT,
    secondary_color TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for nwsl_teams
ALTER TABLE public.nwsl_teams ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Enable read access for all users on nwsl_teams'
    ) THEN
        CREATE POLICY "Enable read access for all users on nwsl_teams" ON public.nwsl_teams
            FOR SELECT USING (true);
    END IF;
END $$;

-- Create nwsl_rosters table
CREATE TABLE IF NOT EXISTS public.nwsl_rosters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES public.nwsl_teams(id) ON DELETE CASCADE,
    season_year INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    player_id TEXT, -- ESPN player ID
    jersey_number TEXT,
    position TEXT,
    height TEXT,
    weight TEXT,
    age INTEGER,
    nationality TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, season_year, player_name)
);

-- Enable RLS for nwsl_rosters
ALTER TABLE public.nwsl_rosters ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Enable read access for all users on nwsl_rosters'
    ) THEN
        CREATE POLICY "Enable read access for all users on nwsl_rosters" ON public.nwsl_rosters
            FOR SELECT USING (true);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nwsl_rosters_team_season ON public.nwsl_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_nwsl_rosters_player_name ON public.nwsl_rosters(player_name);

-- Helper function to get roster
CREATE OR REPLACE FUNCTION get_nwsl_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.nwsl_rosters AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.nwsl_rosters r
    WHERE r.team_id = p_team_id AND r.season_year = p_season_year
    ORDER BY r.player_name;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get available seasons for a team
CREATE OR REPLACE FUNCTION get_nwsl_team_seasons(p_team_id TEXT)
RETURNS TABLE (season_year INTEGER) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.season_year
    FROM public.nwsl_rosters r
    WHERE r.team_id = p_team_id
    ORDER BY r.season_year DESC;
END;
$$;
