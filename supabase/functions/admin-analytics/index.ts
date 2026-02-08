import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1';

serve(async (req) => {
  const { method, url } = req;
  const path = new URL(url).pathname;
  
  // Auth check
  const authHeader = req.headers.get('Authorization');
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  // Check admin status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
    
  if (!profile?.is_admin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }
  
  // Route handlers
  if (path === '/admin-analytics/overview' && method === 'GET') {
    return handleOverview(supabase);
  }
  
  if (path === '/admin-analytics/signups' && method === 'GET') {
    return handleSignups(supabase);
  }
  
  if (path === '/admin-analytics/users' && method === 'GET') {
    return handleUsers(supabase);
  }
  
  if (path === '/admin-analytics/usage' && method === 'GET') {
    return handleUsage(supabase);
  }
  
  if (path === '/admin-analytics/financial' && method === 'GET') {
    return handleFinancial(supabase);
  }
  
  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
});

async function handleOverview(supabase: any) {
  const { data, error } = await supabase
    .from('admin_overview_stats')
    .select('*')
    .single();
    
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  
  return new Response(JSON.stringify({
    totalUsers: data.total_users,
    activeRosters: data.active_rosters,
    monthlyRevenue: data.monthly_revenue_cents / 100,
    creditsThisMonth: data.credits_this_month
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleSignups(supabase: any) {
  const { data, error } = await supabase
    .from('daily_signups')
    .select('*')
    .order('date', { ascending: true });
    
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
  
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUsers(supabase: any) {
  // Get tier distribution
  const { data: tierData, error: tierError } = await supabase
    .from('profiles')
    .select('subscription_tier');
    
  if (tierError) {
    return new Response(JSON.stringify({ error: tierError.message }), { status: 500 });
  }
  
  const tierCounts = tierData.reduce((acc: any, user: any) => {
    const tier = user.subscription_tier || 'BASIC';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {});
  
  const tierDistribution = Object.entries(tierCounts).map(([name, value]) => ({
    name,
    value,
    color: name === 'NETWORK' ? '#5B5FFF' : name === 'STUDIO' ? '#8B5CF6' : name === 'PRO' ? '#10B981' : '#6B7280'
  }));
  
  // Get active users (had activity in last 7 days)
  const { data: activeData, error: activeError } = await supabase
    .from('activity_logs')
    .select('user_id')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .then((res: any) => ({
      data: [...new Set(res.data?.map((log: any) => log.user_id))].length,
      error: res.error
    }));
    
  // Get top users by activity
  const { data: topUsers, error: topError } = await supabase
    .from('activity_logs')
    .select('user_id, count(*)')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .group('user_id')
    .order('count', { ascending: false })
    .limit(10);
    
  if (topUsers && topUsers.length > 0) {
    const userIds = topUsers.map((u: any) => u.user_id);
    const { data: userDetails } = await supabase
      .from('profiles')
      .select('id, full_name, email, subscription_tier')
      .in('id', userIds);
      
    const enrichedTopUsers = topUsers.map((activity: any) => ({
      ...activity,
      user: userDetails?.find((u: any) => u.id === activity.user_id)
    }));
    
    return new Response(JSON.stringify({
      tierDistribution,
      activeUsers: activeData || 0,
      totalUsers: tierData.length,
      topUsers: enrichedTopUsers
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({
    tierDistribution,
    activeUsers: activeData || 0,
    totalUsers: tierData.length,
    topUsers: []
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUsage(supabase: any) {
  // Get roster processing by day
  const { data: rosterData, error: rosterError } = await supabase
    .from('rosters')
    .select('created_at, sport')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true });
    
  if (rosterError) {
    return new Response(JSON.stringify({ error: rosterError.message }), { status: 500 });
  }
  
  // Group by day
  const dailyRosters = rosterData?.reduce((acc: any, roster: any) => {
    const date = new Date(roster.created_at).toISOString().split('T')[0];
    if (!acc[date]) acc[date] = 0;
    acc[date]++;
    return acc;
  }, {});
  
  const rosterTimeline = Object.entries(dailyRosters || {}).map(([date, count]) => ({
    date,
    count
  }));
  
  // Get sport breakdown
  const sportCounts = rosterData?.reduce((acc: any, roster: any) => {
    const sport = roster.sport || 'Unknown';
    acc[sport] = (acc[sport] || 0) + 1;
    return acc;
  }, {});
  
  const sportBreakdown = Object.entries(sportCounts || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 10);
  
  // Get export stats
  const { data: exportData, error: exportError } = await supabase
    .from('activity_logs')
    .select('details')
    .eq('activity_type', 'ROSTER_EXPORT')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    
  const exportCounts = exportData?.reduce((acc: any, log: any) => {
    const format = log.details?.format || 'Unknown';
    acc[format] = (acc[format] || 0) + 1;
    return acc;
  }, {});
  
  const exportBreakdown = Object.entries(exportCounts || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a: any, b: any) => b.value - a.value);
  
  return new Response(JSON.stringify({
    rosterTimeline,
    sportBreakdown,
    exportBreakdown,
    totalRosters: rosterData?.length || 0
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleFinancial(supabase: any) {
  // Get revenue by tier
  const { data: tierData, error: tierError } = await supabase
    .from('profiles')
    .select('subscription_tier, created_at');
    
  if (tierError) {
    return new Response(JSON.stringify({ error: tierError.message }), { status: 500 });
  }
  
  const tierRevenue = {
    PRO: { count: 0, revenue: 0 },
    STUDIO: { count: 0, revenue: 0 },
    NETWORK: { count: 0, revenue: 0 }
  };
  
  tierData?.forEach((user: any) => {
    const tier = user.subscription_tier;
    if (tier === 'PRO') {
      tierRevenue.PRO.count++;
      tierRevenue.PRO.revenue += 79;
    } else if (tier === 'STUDIO') {
      tierRevenue.STUDIO.count++;
      tierRevenue.STUDIO.revenue += 149;
    } else if (tier === 'NETWORK') {
      tierRevenue.NETWORK.count++;
      tierRevenue.NETWORK.revenue += 249;
    }
  });
  
  const revenueByTier = Object.entries(tierRevenue).map(([tier, data]: [string, any]) => ({
    name: tier,
    users: data.count,
    revenue: data.revenue,
    color: tier === 'NETWORK' ? '#5B5FFF' : tier === 'STUDIO' ? '#8B5CF6' : '#10B981'
  }));
  
  // Calculate MRR
  const totalMRR = revenueByTier.reduce((sum, tier) => sum + tier.revenue, 0);
  
  // Get signups by month for growth tracking
  const { data: monthlyData, error: monthlyError } = await supabase
    .from('profiles')
    .select('created_at, subscription_tier');
    
  const monthlySignups = monthlyData?.reduce((acc: any, user: any) => {
    const month = new Date(user.created_at).toISOString().slice(0, 7); // YYYY-MM
    if (!acc[month]) acc[month] = { total: 0, paid: 0 };
    acc[month].total++;
    if (user.subscription_tier !== 'BASIC') {
      acc[month].paid++;
    }
    return acc;
  }, {});
  
  const monthlyGrowth = Object.entries(monthlySignups || {})
    .map(([month, data]: [string, any]) => ({
      month,
      ...data
    }))
    .sort((a: any, b: any) => a.month.localeCompare(b.month))
    .slice(-12); // Last 12 months
  
  return new Response(JSON.stringify({
    revenueByTier,
    totalMRR,
    monthlyGrowth,
    totalPaidUsers: tierData?.filter((u: any) => u.subscription_tier !== 'BASIC').length || 0
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}