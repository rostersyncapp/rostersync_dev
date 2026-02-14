-- MiLB Triple-A Historical Rosters Schema
-- Stores rosters for International League (IL) and Pacific Coast League (PCL)

-- ============================================
-- MiLB TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.milb_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  league_id TEXT NOT NULL, -- 'IL' or 'PCL'
  cube_id INTEGER, -- The Baseball Cube ID
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- MiLB ROSTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.milb_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.milb_teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  jersey_number TEXT,
  player_position TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, season_year, player_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_milb_rosters_team_season ON public.milb_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_milb_rosters_season ON public.milb_rosters(season_year);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.milb_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milb_rosters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================
CREATE POLICY "Allow public read of MiLB teams" ON public.milb_teams FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read of MiLB rosters" ON public.milb_rosters FOR SELECT TO public USING (true);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Function to get rosters
CREATE OR REPLACE FUNCTION public.get_milb_roster(p_team_id TEXT, p_season_year INTEGER)
RETURNS TABLE (
  player_name TEXT,
  jersey_number TEXT,
  player_pos TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.player_name,
    r.jersey_number,
    r.player_position
  FROM public.milb_rosters r
  WHERE r.team_id = p_team_id AND r.season_year = p_season_year
  ORDER BY 
    CASE 
      WHEN r.jersey_number ~ '^[0-9]+$' THEN r.jersey_number::INTEGER
      ELSE 999
    END,
    r.player_name;
END;
$$ LANGUAGE plpgsql;

-- Function to get available seasons
CREATE OR REPLACE FUNCTION public.get_milb_team_seasons(p_team_id TEXT)
RETURNS TABLE (season_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.season_year
  FROM public.milb_rosters r
  WHERE r.team_id = p_team_id
  ORDER BY r.season_year DESC;
END;
$$ LANGUAGE plpgsql;
