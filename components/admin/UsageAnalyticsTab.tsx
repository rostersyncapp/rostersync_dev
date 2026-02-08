import React, { useEffect, useState } from 'react';
import { FileText, Cpu, Download, TrendingUp, RefreshCw } from 'lucide-react';
import MetricCard from './MetricCard';
import SignupChart from '../charts/SignupChart';
import { supabase, setSupabaseToken } from '../../services/supabase';
import { useAuth } from '@clerk/clerk-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface UsageStats {
  rosterTimeline: { date: string; count: number }[];
  sportBreakdown: { name: string; value: number }[];
  exportBreakdown: { name: string; value: number }[];
  totalRosters: number;
}

const SPORT_COLORS = [
  '#5B5FFF', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

const UsageAnalyticsTab: React.FC = () => {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();
  
  useEffect(() => {
    fetchUsageData();
  }, []);
  
  const fetchUsageData = async () => {
    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      await setSupabaseToken(token);
      
      const { data, error } = await supabase.functions.invoke('admin-analytics/usage');
      
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Error fetching usage analytics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const getTotalExports = () => {
    return stats?.exportBreakdown?.reduce((sum, item) => sum + item.value, 0) || 0;
  };
  
  const getTopSport = () => {
    if (!stats?.sportBreakdown?.length) return 'N/A';
    return stats.sportBreakdown[0].name;
  };
  
  const getTopExportFormat = () => {
    if (!stats?.exportBreakdown?.length) return 'N/A';
    return stats.exportBreakdown[0].name;
  };

  const handleRefresh = async () => {
    await fetchUsageData();
  };
  
  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Usage Analytics</h2>
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
          title="Rosters Created (30d)"
          value={stats?.totalRosters?.toLocaleString() ?? 0}
          icon={FileText}
          loading={loading}
          change={18.5}
          trend="up"
        />
        <MetricCard
          title="Total Exports"
          value={getTotalExports().toLocaleString()}
          icon={Download}
          loading={loading}
          change={22.3}
          trend="up"
        />
        <MetricCard
          title="Top Sport"
          value={getTopSport()}
          icon={Cpu}
          loading={loading}
        />
        <MetricCard
          title="Top Export Format"
          value={getTopExportFormat()}
          icon={TrendingUp}
          loading={loading}
        />
      </div>
      
      {/* Roster Timeline Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
          Roster Creation Timeline (Last 30 Days)
        </h3>
        <div className="h-80">
          {loading ? (
            <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.rosterTimeline || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={(date) => new Date(date).toLocaleDateString()}
                />
                <Bar dataKey="count" fill="#5B5FFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sport Breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
            Top Sports
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.sportBreakdown || []}
                  layout="vertical"
                  margin={{ left: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#9CA3AF"
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {stats?.sportBreakdown?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={SPORT_COLORS[index % SPORT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        {/* Export Breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
            Export Format Popularity
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : stats?.exportBreakdown?.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No export data available yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.exportBreakdown || []}
                  layout="vertical"
                  margin={{ left: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#9CA3AF"
                    fontSize={10}
                    width={100}
                    tickFormatter={(value) => value.replace(/_/g, ' ')}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [`${value} exports`, 'Count']}
                  />
                  <Bar dataKey="value" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageAnalyticsTab;