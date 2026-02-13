-- SQL Template for Safe Roster Imports
-- Use this template if you are running raw SQL INSERTs that might overlap with existing data.

-- Option 1: Upsert (Update existing records on name/season match)
INSERT INTO public.nba_rosters (
    team_id, 
    season_year, 
    player_name, 
    jersey_number, 
    position, 
    height, 
    weight, 
    college
)
VALUES 
    -- EXAMPLE ROWS (Replace with your data)
    ('atlanta-hawks', 2020, 'DeAndre'' Bembry', '95', 'G', '6-5', '210', 'Saint Joseph''s'),
    ('atlanta-hawks', 2020, 'Vince Carter', '15', 'F-G', '6-6', '220', 'North Carolina')
ON CONFLICT (team_id, season_year, player_name) 
DO UPDATE SET 
    jersey_number = EXCLUDED.jersey_number,
    position = EXCLUDED.position,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    college = EXCLUDED.college,
    updated_at = NOW();

-- Option 2: Clean Re-import (Delete before insert)
-- Safe to run if you want to replace ALL records for a specific team and season.
-- DELETE FROM public.nba_rosters WHERE team_id = 'atlanta-hawks' AND season_year = 2020;
