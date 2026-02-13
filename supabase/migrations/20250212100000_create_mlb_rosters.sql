-- Create MLB teams table
CREATE TABLE IF NOT EXISTS public.mlb_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  abbreviation TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for mlb_teams
ALTER TABLE public.mlb_teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mlb_teams
CREATE POLICY "Allow public read-only access on mlb_teams" ON public.mlb_teams
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on mlb_teams" ON public.mlb_teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create MLB rosters table
CREATE TABLE IF NOT EXISTS public.mlb_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.mlb_teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,
  jersey_number TEXT,
  position TEXT,
  height TEXT,
  weight TEXT,
  birth_date DATE,
  birthplace TEXT,
  status TEXT DEFAULT 'active',
  phonetic_name TEXT,
  ipa_name TEXT,
  chinese_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, season_year, player_name)
);

-- Enable RLS for mlb_rosters
ALTER TABLE public.mlb_rosters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mlb_rosters
CREATE POLICY "Allow public read-only access on mlb_rosters" ON public.mlb_rosters
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on mlb_rosters" ON public.mlb_rosters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mlb_rosters_team_season ON public.mlb_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_mlb_rosters_player_name ON public.mlb_rosters(player_name);

-- Helper functions (optional, similar to WNBA)
CREATE OR REPLACE FUNCTION get_mlb_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.mlb_rosters AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.mlb_rosters
  WHERE team_id = p_team_id AND season_year = p_season_year
  ORDER BY jersey_number ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
