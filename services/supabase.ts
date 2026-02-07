
import { createClient } from '@supabase/supabase-js';

// Robust environment variable retrieval
export const getEnvVar = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key] || import.meta.env[`VITE_${key}`];
    }
  } catch (e) { }
  return undefined;
};

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseUrl !== 'https://placeholder-project.supabase.co' &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'placeholder-anon-key'
);

const finalUrl = isSupabaseConfigured ? supabaseUrl! : 'https://placeholder-project.supabase.co';
const finalKey = isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-anon-key';

export const supabase = createClient(finalUrl, finalKey);

/**
 * Updates the Supabase client with a Clerk JWT
 */
export const setSupabaseToken = async (token: string | null) => {
  if (token) {
    // Standard RLS Injection for Clerk + Supabase
    (supabase as any).rest.headers['Authorization'] = `Bearer ${token}`;
    // Also inject into other sub-clients if they exist
    if ((supabase as any).storage) {
      (supabase as any).storage.headers['Authorization'] = `Bearer ${token}`;
    }
  } else {
    delete (supabase as any).rest.headers['Authorization'];
    if ((supabase as any).storage) {
      delete (supabase as any).storage.headers['Authorization'];
    }
  }
};

export interface SiteConfig {
  site_name: string;
  logo_url: string | null;
}

/**
 * Converts a File object to a Base64 Data URL string
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Fetches global site branding configuration
 */
export async function getSiteConfig(): Promise<SiteConfig> {
  if (!isSupabaseConfigured) return { site_name: 'rosterSync', logo_url: null };

  const { data, error } = await supabase
    .from('site_config')
    .select('site_name, logo_url')
    .eq('id', 'default')
    .single();

  if (error || !data) {
    return { site_name: 'rosterSync', logo_url: null };
  }

  return data;
}

/**
 * Updates global site branding configuration
 */
export async function updateSiteConfig(updates: Partial<SiteConfig>) {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('site_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'default');

  if (error) throw error;
}

/**
 * Uploads an image to Supabase Storage (branding bucket)
 * Used for user workspace logos
 */
export async function uploadOrgLogo(userId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");

  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `logos/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('branding')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('branding').getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Records AI usage metrics
 */
export async function recordUsage(
  userId: string,
  metrics: {
    operationType: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    searchQueries: number;
    total_cost_usd: number;
  }
) {
  if (!isSupabaseConfigured) return;

  await supabase.from('user_usage').insert({
    user_id: userId,
    operation_type: metrics.operationType,
    model_name: metrics.modelName,
    input_tokens: metrics.inputTokens,
    output_tokens: metrics.outputTokens,
    search_queries: metrics.searchQueries,
    total_cost_usd: metrics.total_cost_usd
  });
}

/**
 * Gets monthly usage
 */
export async function getMonthlyUsage(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const { count } = await supabase
    .from('user_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('operation_type', 'ROSTER_IMPORT')
    .gte('created_at', firstDay);
  return count || 0;
}

/**
 * Activity Types
 */
export type ActivityType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'ROSTER_SAVE'
  | 'ROSTER_DELETE'
  | 'ROSTER_EXPORT'
  | 'PLAYER_ADD'
  | 'PLAYER_DELETE'
  | 'PROJECT_FOLDER_DELETE'
  | 'ROSTER_UPDATE';

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: ActivityType;
  description: string;
  created_at: string;
}

/**
 * Log specific user activities
 */
export async function logActivity(
  userId: string,
  actionType: ActivityType,
  description: string
): Promise<void> {
  if (!isSupabaseConfigured) {
    console.log('[Activity] (Supabase not configured):', actionType, description);
    return;
  }

  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action_type: actionType,
        description: description
      });

    if (error) {
      console.error('[Activity] Error logging:', actionType, error);
    } else {
      console.log('[Activity] Logged:', actionType);
    }
  } catch (err) {
    console.error('[Activity] Exception:', err);
  }
}

/**
 * Fetch recent activity logs
 */
export async function getActivityLogs(userId: string): Promise<ActivityLog[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, user_id, action_type, description, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[Activity] Fetch error:', error);
    return [];
  }

  return data || [];
}

/**
 * Branding Cache Interface
 */
export interface BrandingCache {
  id?: string;
  team_name: string;
  sport: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  abbreviation: string | null;
  // Additional color formats
  primary_rgb: string | null;
  secondary_rgb: string | null;
  primary_pantone: string | null;
  secondary_pantone: string | null;
  primary_cmyk: string | null;
  secondary_cmyk: string | null;
}

/**
 * Get cached branding for a team
 */
export async function getBrandingCache(teamName: string, sport: string): Promise<BrandingCache | null> {
  if (!isSupabaseConfigured || !teamName || !sport) return null;

  try {
    const { data, error } = await supabase
      .from('team_branding_cache')
      .select('*')
      .ilike('team_name', teamName)
      .ilike('sport', sport)
      .single();

    if (error || !data) {
      console.log('[BrandingCache] Cache miss for:', teamName, sport);
      return null;
    }

    console.log('[BrandingCache] Cache hit for:', teamName, sport);
    return data as BrandingCache;
  } catch (err) {
    console.error('[BrandingCache] Lookup error:', err);
    return null;
  }
}

/**
 * Save branding to cache
 */
export async function saveBrandingCache(branding: BrandingCache): Promise<void> {
  if (!isSupabaseConfigured || !branding.team_name || !branding.sport) {
    console.log('[BrandingCache] Skipping save - not configured or missing data:', {
      configured: isSupabaseConfigured,
      team: branding.team_name,
      sport: branding.sport
    });
    return;
  }

  // Do not cache Unknown or poisoned entries
  const nameLower = branding.team_name.toLowerCase();
  const logoLower = branding.logo_url?.toLowerCase() || '';
  const primaryLower = branding.primary_color?.toLowerCase() || '';

  const isPoisoned = nameLower === 'unknown team' || nameLower === 'unknown' || nameLower === 'unknown noc' ||
    logoLower === 'unknown' || logoLower === 'logourl' ||
    primaryLower === 'unknown';

  if (isPoisoned) {
    console.log('[BrandingCache] Skipping save - data is placeholder/poisoned:', {
      team: branding.team_name,
      logo: branding.logo_url,
      primary: branding.primary_color
    });
    return;
  }

  console.log('[BrandingCache] Attempting to save:', branding);

  try {
    // First try to check if entry exists
    const { data: existing } = await supabase
      .from('team_branding_cache')
      .select('id')
      .ilike('team_name', branding.team_name)
      .ilike('sport', branding.sport)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('team_branding_cache')
        .update({
          logo_url: branding.logo_url,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          abbreviation: branding.abbreviation,
          primary_rgb: branding.primary_rgb,
          secondary_rgb: branding.secondary_rgb,
          primary_pantone: branding.primary_pantone,
          secondary_pantone: branding.secondary_pantone,
          primary_cmyk: branding.primary_cmyk,
          secondary_cmyk: branding.secondary_cmyk,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[BrandingCache] Update error:', error);
      } else {
        console.log('[BrandingCache] Updated existing entry for:', branding.team_name);
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('team_branding_cache')
        .insert({
          team_name: branding.team_name.toUpperCase(),
          sport: branding.sport.toUpperCase(),
          logo_url: branding.logo_url,
          primary_color: branding.primary_color,
          secondary_color: branding.secondary_color,
          abbreviation: branding.abbreviation,
          primary_rgb: branding.primary_rgb,
          secondary_rgb: branding.secondary_rgb,
          primary_pantone: branding.primary_pantone,
          secondary_pantone: branding.secondary_pantone,
          primary_cmyk: branding.primary_cmyk,
          secondary_cmyk: branding.secondary_cmyk
        });

      if (error) {
        console.error('[BrandingCache] Insert error:', error);
      } else {
        console.log('[BrandingCache] Saved new entry for:', branding.team_name, branding.sport);
      }
    }
  } catch (err) {
    console.error('[BrandingCache] Save exception:', err);
  }
}


/**
 * Fetch all supported leagues
 */
export async function getLeagues() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching leagues:', error);
    return [];
  }
  return data || [];
}

/**
 * Fetch conferences for a league
 */
export async function getConferences(leagueId: string, division?: string) {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('conferences')
    .select('*')
    .eq('league_id', leagueId)
    .order('name');

  if (division) {
    query = query.eq('division', division);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conferences:', error);
    return [];
  }
  return data || [];
}
