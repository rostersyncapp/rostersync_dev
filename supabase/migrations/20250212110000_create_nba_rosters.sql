-- Create NBA teams table
CREATE TABLE IF NOT EXISTS public.nba_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  abbreviation TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for nba_teams
ALTER TABLE public.nba_teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for nba_teams
CREATE POLICY "Allow public read-only access on nba_teams" ON public.nba_teams
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on nba_teams" ON public.nba_teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create NBA rosters table
CREATE TABLE IF NOT EXISTS public.nba_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.nba_teams(id) ON DELETE CASCADE,
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

-- Enable RLS for nba_rosters
ALTER TABLE public.nba_rosters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for nba_rosters
CREATE POLICY "Allow public read-only access on nba_rosters" ON public.nba_rosters
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on nba_rosters" ON public.nba_rosters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_rosters_team_season ON public.nba_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_nba_rosters_player_name ON public.nba_rosters(player_name);

-- Helper functions
CREATE OR REPLACE FUNCTION get_nba_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.nba_rosters AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.nba_rosters
  WHERE team_id = p_team_id AND season_year = p_season_year
  ORDER BY jersey_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
