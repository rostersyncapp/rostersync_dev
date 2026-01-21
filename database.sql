
-- 0. Global Site Configuration (Singleton)
CREATE TABLE IF NOT EXISTS public.site_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  site_name TEXT DEFAULT 'RosterSync',
  logo_url TEXT, -- Can store a URL OR a raw Base64 Data URL (data:image/png;base64,...)
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert initial default config
INSERT INTO public.site_config (id, site_name, logo_url)
VALUES ('default', 'RosterSync', NULL)
ON CONFLICT (id) DO NOTHING;

-- Clerk Auth Helper
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS TEXT AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::text;
$$ LANGUAGE SQL STABLE;

-- 1. User Profiles (Using Clerk IDs)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  full_name TEXT,
  organization_name TEXT,
  org_logo_url TEXT, -- Workspace custom branding
  subscription_tier TEXT DEFAULT 'BASIC' CHECK (subscription_tier IN ('BASIC', 'PRO', 'NETWORK'))
);

-- 1.5 Projects (Folders)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#5B5FFF'
);

-- 2. Rosters (Stored Athlete Data)
CREATE TABLE IF NOT EXISTS public.rosters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  team_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  season_year TEXT NOT NULL,
  athlete_count INTEGER DEFAULT 0,
  roster_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  team_metadata JSONB DEFAULT '{}'::jsonb,
  version_description TEXT,
  is_noc_mode BOOLEAN DEFAULT false
);

-- 3. AI Usage Tracking (Credits)
CREATE TABLE IF NOT EXISTS public.user_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  operation_type TEXT NOT NULL,
  model_name TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  search_queries INTEGER DEFAULT 0,
  total_cost_usd NUMERIC(10, 5) DEFAULT 0
);

-- 3.5 Activity Logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT
);

-- 4. Demo Requests
CREATE TABLE IF NOT EXISTS public.demo (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  use_case TEXT
);

-- 5. Support Tickets
CREATE TABLE IF NOT EXISTS public.support (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL
);

-- 6. Release Notes
CREATE TABLE IF NOT EXISTS public.release_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  release_date TEXT NOT NULL,
  is_latest BOOLEAN DEFAULT false,
  features JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 7. Enable RLS
ALTER TABLE public.site_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_notes ENABLE ROW LEVEL SECURITY;

-- 8. Policies
CREATE POLICY "Allow public read of site config" ON public.site_config FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated update of site config" ON public.site_config FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = public.requesting_user_id());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = public.requesting_user_id());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = public.requesting_user_id());

CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT TO authenticated USING (user_id = public.requesting_user_id());
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (user_id = public.requesting_user_id());
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated USING (user_id = public.requesting_user_id());

CREATE POLICY "Users can view own rosters" ON public.rosters FOR SELECT TO authenticated USING (user_id = public.requesting_user_id());
CREATE POLICY "Users can insert own rosters" ON public.rosters FOR INSERT TO authenticated WITH CHECK (user_id = public.requesting_user_id());
CREATE POLICY "Users can update own rosters" ON public.rosters FOR UPDATE TO authenticated USING (user_id = public.requesting_user_id());
CREATE POLICY "Users can delete own rosters" ON public.rosters FOR DELETE TO authenticated USING (user_id = public.requesting_user_id());

CREATE POLICY "Users can view own usage" ON public.user_usage FOR SELECT TO authenticated USING (user_id = public.requesting_user_id());
CREATE POLICY "Allow authenticated inserts for usage" ON public.user_usage FOR INSERT TO authenticated WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "Users can view own activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (user_id = public.requesting_user_id());
CREATE POLICY "Allow authenticated inserts for activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = public.requesting_user_id());

CREATE POLICY "Allow public demo inserts" ON public.demo FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow public support inserts" ON public.support FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can view own support" ON public.support FOR SELECT TO authenticated USING (user_id = public.requesting_user_id());

CREATE POLICY "Allow public read of release notes" ON public.release_notes FOR SELECT TO public USING (true);

-- 14. Initial Seed Data
INSERT INTO public.release_notes (version, title, release_date, is_latest, features)
VALUES (
  'v2.1.0', 
  'The Intelligence Update', 
  'February 2026', 
  true, 
  '[
    {"icon": "zap", "label": "Dynamic Credit System", "text": "Improved monthly usage tracking and tiered credit limits."},
    {"icon": "cpu", "label": "Resilient Processing", "text": "Enhanced retry logic and model switching for better uptime."},
    {"icon": "shield", "label": "Broadcast Safe", "text": "Automatic sanitization for Vizrt and Ross hardware."}
  ]'::jsonb
) ON CONFLICT DO NOTHING;
