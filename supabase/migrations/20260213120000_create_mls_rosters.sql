-- Create MLS teams table
CREATE TABLE IF NOT EXISTS public.mls_teams (
  id TEXT PRIMARY KEY, -- ESPN ID as string
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  slug TEXT,
  abbreviation TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for mls_teams
ALTER TABLE public.mls_teams ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mls_teams
CREATE POLICY "Allow public read-only access on mls_teams" ON public.mls_teams
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on mls_teams" ON public.mls_teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create MLS rosters table
CREATE TABLE IF NOT EXISTS public.mls_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.mls_teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT, -- ESPN player ID
  jersey_number TEXT,
  position TEXT,
  age INTEGER,
  height TEXT,
  weight TEXT,
  nationality TEXT,
  status TEXT DEFAULT 'active',
  phonetic_name TEXT,
  ipa_name TEXT,
  chinese_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, season_year, player_name)
);

-- Enable RLS for mls_rosters
ALTER TABLE public.mls_rosters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mls_rosters
CREATE POLICY "Allow public read-only access on mls_rosters" ON public.mls_rosters
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert/update on mls_rosters" ON public.mls_rosters
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mls_rosters_team_season ON public.mls_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_mls_rosters_player_name ON public.mls_rosters(player_name);

-- Helper functions
CREATE OR REPLACE FUNCTION get_mls_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS SETOF public.mls_rosters AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.mls_rosters
  WHERE team_id = p_team_id AND season_year = p_season_year
  ORDER BY 
    CASE WHEN jersey_number ~ '^\d+$' THEN jersey_number::integer ELSE 999 END ASC,
    player_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get available seasons for a team
CREATE OR REPLACE FUNCTION get_mls_team_seasons(p_team_id TEXT)
RETURNS TABLE (season_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.season_year
  FROM mls_rosters r
  WHERE r.team_id = p_team_id
  ORDER BY r.season_year DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
