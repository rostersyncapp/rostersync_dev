-- Create teams table
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  league text not null, -- 'milb', 'mlb', 'nfl', etc.
  logo_url text not null,
  alt_names text[] default '{}'::text[], -- For fuzzy matching if needed
  unique(name, league)
);

-- Enable RLS
alter table public.teams enable row level security;

-- Create Policy: Allow public read access (logos are public info)
create policy "Allow public read access"
  on public.teams
  for select
  using (true);

-- Create Policy: Allow authenticated upload/insert (for admin tools)
create policy "Allow authenticated insert"
  on public.teams
  for insert
  with check (auth.role() = 'authenticated');

-- SEED DATA: 30 Triple-A MiLB Teams (International & Pacific Coast Leagues)
insert into public.teams (name, league, logo_url, alt_names) values
  ('Buffalo Bisons', 'milb', 'https://www.mlbstatic.com/team-logos/422.svg', ARRAY['Buffalo']),
  ('Charlotte Knights', 'milb', 'https://www.mlbstatic.com/team-logos/494.svg', ARRAY['Knights']),
  ('Columbus Clippers', 'milb', 'https://www.mlbstatic.com/team-logos/445.svg', ARRAY['Clippers']),
  ('Durham Bulls', 'milb', 'https://www.mlbstatic.com/team-logos/234.svg', ARRAY['Bulls']),
  ('Gwinnett Stripers', 'milb', 'https://www.mlbstatic.com/team-logos/431.svg', ARRAY['Gwinnett', 'Stripers']),
  ('Indianapolis Indians', 'milb', 'https://www.mlbstatic.com/team-logos/484.svg', ARRAY['Indianapolis']),
  ('Iowa Cubs', 'milb', 'https://www.mlbstatic.com/team-logos/451.svg', ARRAY['Iowa']),
  ('Jacksonville Jumbo Shrimp', 'milb', 'https://www.mlbstatic.com/team-logos/564.svg', ARRAY['Jumbo Shrimp']),
  ('Lehigh Valley IronPigs', 'milb', 'https://www.mlbstatic.com/team-logos/1410.svg', ARRAY['IronPigs']),
  ('Louisville Bats', 'milb', 'https://www.mlbstatic.com/team-logos/416.svg', ARRAY['Bats']),
  ('Memphis Redbirds', 'milb', 'https://www.mlbstatic.com/team-logos/235.svg', ARRAY['Redbirds']),
  ('Nashville Sounds', 'milb', 'https://www.mlbstatic.com/team-logos/556.svg', ARRAY['Sounds']),
  ('Norfolk Tides', 'milb', 'https://www.mlbstatic.com/team-logos/568.svg', ARRAY['Tides']),
  ('Omaha Storm Chasers', 'milb', 'https://www.mlbstatic.com/team-logos/541.svg', ARRAY['Storm Chasers']),
  ('Rochester Red Wings', 'milb', 'https://www.mlbstatic.com/team-logos/534.svg', ARRAY['Red Wings']),
  ('Scranton/Wilkes-Barre RailRiders', 'milb', 'https://www.mlbstatic.com/team-logos/531.svg', ARRAY['RailRiders', 'SWB']),
  ('St. Paul Saints', 'milb', 'https://www.mlbstatic.com/team-logos/1960.svg', ARRAY['St. Paul']),
  ('Syracuse Mets', 'milb', 'https://www.mlbstatic.com/team-logos/552.svg', ARRAY['Syracuse']),
  ('Toledo Mud Hens', 'milb', 'https://www.mlbstatic.com/team-logos/512.svg', ARRAY['Mud Hens']),
  ('Worcester Red Sox', 'milb', 'https://www.mlbstatic.com/team-logos/533.svg', ARRAY['Worcester', 'WooSox']),
  ('Albuquerque Isotopes', 'milb', 'https://www.mlbstatic.com/team-logos/342.svg', ARRAY['Isotopes']),
  ('El Paso Chihuahuas', 'milb', 'https://www.mlbstatic.com/team-logos/4904.svg', ARRAY['Chihuahuas']),
  ('Las Vegas Aviators', 'milb', 'https://www.mlbstatic.com/team-logos/400.svg', ARRAY['Aviators']),
  ('Oklahoma City Comets', 'milb', 'https://www.mlbstatic.com/team-logos/238.svg', ARRAY['OKC', 'Comets']),
  ('Reno Aces', 'milb', 'https://www.mlbstatic.com/team-logos/2310.svg', ARRAY['Aces']),
  ('Round Rock Express', 'milb', 'https://www.mlbstatic.com/team-logos/102.svg', ARRAY['Round Rock', 'Express']),
  ('Sacramento River Cats', 'milb', 'https://www.mlbstatic.com/team-logos/105.svg', ARRAY['River Cats']),
  ('Salt Lake Bees', 'milb', 'https://www.mlbstatic.com/team-logos/561.svg', ARRAY['Bees']),
  ('Sugar Land Space Cowboys', 'milb', 'https://www.mlbstatic.com/team-logos/5434.svg', ARRAY['Space Cowboys']),
  ('Tacoma Rainiers', 'milb', 'https://www.mlbstatic.com/team-logos/529.svg', ARRAY['Rainiers'])
on conflict (name, league) do nothing;
