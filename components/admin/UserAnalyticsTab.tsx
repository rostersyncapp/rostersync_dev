import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, Crown, Activity, RefreshCw } from 'lucide-react';
import MetricCard from './MetricCard';
import { supabase, setSupabaseToken } from '../../services/supabase';
import { useAuth } from '@clerk/clerk-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface TierDistribution {
  name: string;
  value: number;
  color: string;
}

interface TopUser {
  user_id: string;
  count: number;
  user?: {
    full_name: string;
    email: string;
    subscription_tier: string;
  };
}

interface UserStats {
  tierDistribution: TierDistribution[];
  activeUsers: number;
  totalUsers: number;
  topUsers: TopUser[];
}

const COLORS = {
  ENTERPRISE: '#5B5FFF',
  PRO: '#8B5CF6',
  STARTER: '#10B981',
  FREE: '#6B7280'
};

const UserAnalyticsTab: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      await setSupabaseToken(token);

      const { data, error } = await supabase.functions.invoke('admin-analytics/users');

      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Error fetching user analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRetentionRate = () => {
    if (!stats) return 0;
    return stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0;
  };

  const getPaidUsers = () => {
    if (!stats) return 0;
    return stats.tierDistribution
      .filter(t => t.name !== 'FREE')
      .reduce((sum, t) => sum + t.value, 0);
  };

  const getPaidPercentage = () => {
    if (!stats || stats.totalUsers === 0) return 0;
    return Math.round((getPaidUsers() / stats.totalUsers) * 100);
  };

  const handleRefresh = async () => {
    await fetchUserData();
  };

  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">User Analytics</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#5B5FFF] bg-[#5B5FFF]/10 hover:bg-[#5B5FFF]/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() ?? 0}
          icon={Users}
          loading={loading}
          change={8.2}
          trend="up"
        />
        <MetricCard
          title="Active Users (7d)"
          value={stats?.activeUsers?.toLocaleString() ?? 0}
          icon={Activity}
          loading={loading}
          change={12.5}
          trend="up"
        />
        <MetricCard
          title="Retention Rate"
          value={`${getRetentionRate()}%`}
          icon={TrendingUp}
          loading={loading}
          change={3.1}
          trend="up"
        />
        <MetricCard
          title="Paid Users"
          value={`${getPaidUsers()} (${getPaidPercentage()}%)`}
          icon={Crown}
          loading={loading}
          change={15.3}
          trend="up"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
            Subscription Distribution
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.tierDistribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats?.tierDistribution?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number, name: string) => [
                      `${value} users (${Math.round((value / (stats?.totalUsers || 1)) * 100)}%)`,
                      name
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value: string) => (
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Users Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
            Top Active Users (30d)
          </h3>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : stats?.topUsers?.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No activity data available yet</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left py-3 px-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      User
                    </th>
                    <th className="text-left py-3 px-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Tier
                    </th>
                    <th className="text-right py-3 px-2 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.topUsers?.map((user, index) => (
                    <tr key={user.user_id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">
                            {user.user?.full_name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user.user?.email || user.user_id}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${user.user?.subscription_tier === 'NETWORK' ? 'bg-[#5B5FFF]/10 text-[#5B5FFF]' :
                            user.user?.subscription_tier === 'STUDIO' ? 'bg-purple-100 text-purple-700' :
                              user.user?.subscription_tier === 'PRO' ? 'bg-emerald-100 text-emerald-700' :
                                'bg-gray-100 text-gray-600'
                          }`}>
                          {user.user?.subscription_tier || 'BASIC'}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <span className="text-2xl font-extrabold text-[#5B5FFF]">
                          {user.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAnalyticsTab;