-- Migration to create USL Championship teams and rosters tables
-- USL Championship: USA.USL.1 on ESPN

-- Create usl_teams table
CREATE TABLE IF NOT EXISTS public.usl_teams (
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

-- Enable RLS for usl_teams
ALTER TABLE public.usl_teams ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Enable read access for all users on usl_teams'
    ) THEN
        CREATE POLICY "Enable read access for all users on usl_teams" ON public.usl_teams
            FOR SELECT USING (true);
    END IF;
END $$;

-- Create usl_rosters table
CREATE TABLE IF NOT EXISTS public.usl_rosters (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES public.usl_teams(id) ON DELETE CASCADE,
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

-- Enable RLS for usl_rosters
ALTER TABLE public.usl_rosters ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policy WHERE polname = 'Enable read access for all users on usl_rosters'
    ) THEN
        CREATE POLICY "Enable read access for all users on usl_rosters" ON public.usl_rosters
            FOR SELECT USING (true);
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_usl_rosters_team_season ON public.usl_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_usl_rosters_player_name ON public.usl_rosters(player_name);

-- Helper function to get roster
CREATE OR REPLACE FUNCTION get_usl_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.usl_rosters AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.usl_rosters r
    WHERE r.team_id = p_team_id AND r.season_year = p_season_year
    ORDER BY r.player_name;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get available seasons for a team
CREATE OR REPLACE FUNCTION get_usl_team_seasons(p_team_id TEXT)
RETURNS TABLE (season_year INTEGER) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.season_year
    FROM public.usl_rosters r
    WHERE r.team_id = p_team_id
    ORDER BY r.season_year DESC;
END;
$$;
