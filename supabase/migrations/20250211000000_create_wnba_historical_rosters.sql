-- WNBA Historical Rosters Schema
-- Stores all WNBA players by team and season from 1997 to present

-- ============================================
-- WNBA TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.wnba_teams (
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

-- Seed WNBA Teams (current and historical)
INSERT INTO public.wnba_teams (id, name, abbreviation, display_name, location, espn_id, primary_color, secondary_color, logo_url, founded_year, is_active) VALUES
  ('atlanta-dream', 'Dream', 'ATL', 'Atlanta Dream', 'Atlanta', 16, '#E31837', '#000000', 'https://a.espncdn.com/i/teamlogos/wnba/500/atl.png', 2008, true),
  ('chicago-sky', 'Sky', 'CHI', 'Chicago Sky', 'Chicago', 17, '#418FDE', '#FFD100', 'https://a.espncdn.com/i/teamlogos/wnba/500/chi.png', 2006, true),
  ('connecticut-sun', 'Sun', 'CON', 'Connecticut Sun', 'Uncasville', 18, '#F05023', '#FFFFFF', 'https://a.espncdn.com/i/teamlogos/wnba/500/con.png', 1999, true),
  ('indiana-fever', 'Fever', 'IND', 'Indiana Fever', 'Indianapolis', 19, '#002D62', '#E31837', 'https://a.espncdn.com/i/teamlogos/wnba/500/ind.png', 2000, true),
  ('new-york-liberty', 'Liberty', 'NYL', 'New York Liberty', 'Brooklyn', 20, '#000000', '#6ECEB2', 'https://a.espncdn.com/i/teamlogos/wnba/500/nyl.png', 1997, true),
  ('washington-mystics', 'Mystics', 'WAS', 'Washington Mystics', 'Washington', 21, '#002B5C', '#E31837', 'https://a.espncdn.com/i/teamlogos/wnba/500/was.png', 1998, true),
  ('dallas-wings', 'Wings', 'DAL', 'Dallas Wings', 'Dallas', 22, '#002B5C', '#C4D600', 'https://a.espncdn.com/i/teamlogos/wnba/500/dal.png', 1998, true),
  ('las-vegas-aces', 'Aces', 'LVA', 'Las Vegas Aces', 'Las Vegas', 23, '#000000', '#A7A9AC', 'https://a.espncdn.com/i/teamlogos/wnba/500/lva.png', 1997, true),
  ('los-angeles-sparks', 'Sparks', 'LAS', 'Los Angeles Sparks', 'Los Angeles', 24, '#552583', '#FDB927', 'https://a.espncdn.com/i/teamlogos/wnba/500/las.png', 1997, true),
  ('minnesota-lynx', 'Lynx', 'MIN', 'Minnesota Lynx', 'Minneapolis', 25, '#002B5C', '#236192', 'https://a.espncdn.com/i/teamlogos/wnba/500/min.png', 1999, true),
  ('phoenix-mercury', 'Mercury', 'PHO', 'Phoenix Mercury', 'Phoenix', 26, '#1D1160', '#E56020', 'https://a.espncdn.com/i/teamlogos/wnba/500/pho.png', 1997, true),
  ('seattle-storm', 'Storm', 'SEA', 'Seattle Storm', 'Seattle', 27, '#2E8B57', '#FDB927', 'https://a.espncdn.com/i/teamlogos/wnba/500/sea.png', 2000, true),
  -- Historical teams (no longer active)
  ('charlotte-sting', 'Sting', 'CHA', 'Charlotte Sting', 'Charlotte', 28, '#00848E', '#800080', 'https://a.espncdn.com/i/teamlogos/wnba/500/cha.png', 1997, false),
  ('cleveland-rockers', 'Rockers', 'CLE', 'Cleveland Rockers', 'Cleveland', 29, '#B22222', '#FFD700', 'https://a.espncdn.com/i/teamlogos/wnba/500/cle.png', 1997, false),
  ('detroit-shock', 'Shock', 'DET', 'Detroit Shock', 'Detroit', 30, '#006BB6', '#ED174C', 'https://a.espncdn.com/i/teamlogos/wnba/500/det.png', 1998, false),
  ('houston-comets', 'Comets', 'HOU', 'Houston Comets', 'Houston', 31, '#CE1141', '#000000', 'https://a.espncdn.com/i/teamlogos/wnba/500/hou.png', 1997, false),
  ('miami-sol', 'Sol', 'MIA', 'Miami Sol', 'Miami', 32, '#006400', '#FFD700', 'https://a.espncdn.com/i/teamlogos/wnba/500/mia.png', 2000, false),
  ('orlando-miracle', 'Miracle', 'ORL', 'Orlando Miracle', 'Orlando', 33, '#1C39BB', '#000000', 'https://a.espncdn.com/i/teamlogos/wnba/500/orl.png', 1999, false),
  ('portland-fire', 'Fire', 'POR', 'Portland Fire', 'Portland', 34, '#FF0000', '#000000', 'https://a.espncdn.com/i/teamlogos/wnba/500/por.png', 2000, false),
  ('sacramento-monarchs', 'Monarchs', 'SAC', 'Sacramento Monarchs', 'Sacramento', 35, '#5B2F83', '#000000', 'https://a.espncdn.com/i/teamlogos/wnba/500/sac.png', 1997, false),
  ('san-antonio-stars', 'Stars', 'SAS', 'San Antonio Stars', 'San Antonio', 36, '#000000', '#C4CED4', 'https://a.espncdn.com/i/teamlogos/wnba/500/sas.png', 2003, false),
  ('tulsa-shock', 'Shock', 'TUL', 'Tulsa Shock', 'Tulsa', 37, '#FF6600', '#000000', 'https://a.espncdn.com/i/teamlogos/wnba/500/tul.png', 2010, false),
  ('utah-starzz', 'Starzz', 'UTA', 'Utah Starzz', 'Salt Lake City', 38, '#4B0082', '#00CED1', 'https://a.espncdn.com/i/teamlogos/wnba/500/uta.png', 1997, false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- WNBA HISTORICAL ROSTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.wnba_historical_rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES public.wnba_teams(id) ON DELETE CASCADE,
  season_year INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  player_id TEXT,
  jersey_number TEXT,
  position TEXT,
  height TEXT,
  weight TEXT,
  birth_date DATE,
  college TEXT,
  years_pro INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(team_id, season_year, player_name)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_wnba_rosters_team_season ON public.wnba_historical_rosters(team_id, season_year);
CREATE INDEX IF NOT EXISTS idx_wnba_rosters_season ON public.wnba_historical_rosters(season_year);
CREATE INDEX IF NOT EXISTS idx_wnba_rosters_player ON public.wnba_historical_rosters(player_name);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.wnba_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wnba_historical_rosters ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Allow public read access to WNBA teams
CREATE POLICY "Allow public read of WNBA teams" 
ON public.wnba_teams FOR SELECT TO public USING (true);

-- Allow public read access to historical rosters
CREATE POLICY "Allow public read of WNBA rosters" 
ON public.wnba_historical_rosters FOR SELECT TO public USING (true);

-- Allow authenticated users to insert/update rosters (for data population)
CREATE POLICY "Allow authenticated inserts of WNBA rosters" 
ON public.wnba_historical_rosters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated updates of WNBA rosters" 
ON public.wnba_historical_rosters FOR UPDATE TO authenticated USING (true);

-- ============================================
-- FUNCTION TO GET WNBA ROSTER BY TEAM AND YEAR
-- ============================================
CREATE OR REPLACE FUNCTION public.get_wnba_roster(team_id TEXT, season_year INTEGER)
RETURNS TABLE (
  player_name TEXT,
  jersey_number TEXT,
  position TEXT,
  height TEXT,
  college TEXT,
  years_pro INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.player_name,
    r.jersey_number,
    r.position,
    r.height,
    r.college,
    r.years_pro
  FROM public.wnba_historical_rosters r
  WHERE r.team_id = $1 AND r.season_year = $2
  ORDER BY 
    CASE 
      WHEN r.jersey_number ~ '^[0-9]+$' THEN r.jersey_number::INTEGER
      ELSE 999
    END,
    r.player_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION TO GET AVAILABLE SEASONS FOR A TEAM
-- ============================================
CREATE OR REPLACE FUNCTION public.get_wnba_team_seasons(team_id TEXT)
RETURNS TABLE (season_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT r.season_year
  FROM public.wnba_historical_rosters r
  WHERE r.team_id = $1
  ORDER BY r.season_year DESC;
END;
$$ LANGUAGE plpgsql;
