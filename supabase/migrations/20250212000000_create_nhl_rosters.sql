-- NHL Historical Rosters Schema
-- Stores all NHL players by team and season

-- ============================================
-- NHL TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.nhl_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  display_name TEXT NOT NULL,
  location TEXT NOT NULL,
  espn_id INTEGER,
  primary_color TEXT,
  secondary_color TEXT,
  logo_url TEXT,
  founded_year INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- NHL ROSTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.nhl_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.nhl_teams(id) ON DELETE CASCADE,
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

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nhl_rosters_team_season ON public.nhl_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_nhl_rosters_season ON public.nhl_rosters(season_year);
CREATE INDEX IF NOT EXISTS idx_nhl_rosters_player ON public.nhl_rosters(player_name);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.nhl_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nhl_rosters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Allow public read access to NHL teams
CREATE POLICY "Allow public read of NHL teams" 
ON public.nhl_teams FOR SELECT TO public USING (true);

-- Allow public read access to NHL rosters
CREATE POLICY "Allow public read of NHL rosters" 
ON public.nhl_rosters FOR SELECT TO public USING (true);

-- Allow authenticated users to insert/update rosters
CREATE POLICY "Allow authenticated inserts of NHL rosters" 
ON public.nhl_rosters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated updates of NHL rosters" 
ON public.nhl_rosters FOR UPDATE TO authenticated USING (true);
