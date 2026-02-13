-- Create NFL teams table
CREATE TABLE IF NOT EXISTS public.nfl_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  abbreviation TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for nfl_teams
ALTER TABLE public.nfl_teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for nfl_teams
CREATE POLICY "Allow public read-only access on nfl_teams" ON public.nfl_teams
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on nfl_teams" ON public.nfl_teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create NFL rosters table
CREATE TABLE IF NOT EXISTS public.nfl_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.nfl_teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,
  jersey_number TEXT,
  position TEXT,
  height TEXT,
  weight TEXT,
  birth_date DATE,
  college TEXT,
  status TEXT DEFAULT 'active',
  phonetic_name TEXT,
  ipa_name TEXT,
  chinese_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, season_year, player_name)
);

-- Enable RLS for nfl_rosters
ALTER TABLE public.nfl_rosters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for nfl_rosters
CREATE POLICY "Allow public read-only access on nfl_rosters" ON public.nfl_rosters
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on nfl_rosters" ON public.nfl_rosters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nfl_rosters_team_season ON public.nfl_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_nfl_rosters_player_name ON public.nfl_rosters(player_name);

-- Helper functions
CREATE OR REPLACE FUNCTION get_nfl_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.nfl_rosters AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.nfl_rosters
  WHERE team_id = p_team_id AND season_year = p_season_year
  ORDER BY jersey_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available seasons for a team
CREATE OR REPLACE FUNCTION get_nfl_team_seasons(team_id TEXT)
RETURNS TABLE (season_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.season_year
  FROM nfl_rosters r
  WHERE r.team_id = get_nfl_team_seasons.team_id
  ORDER BY r.season_year DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
