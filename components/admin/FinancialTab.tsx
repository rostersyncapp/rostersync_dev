import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Users, CreditCard, RefreshCw } from 'lucide-react';
import MetricCard from './MetricCard';
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
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

interface RevenueByTier {
  name: string;
  users: number;
  revenue: number;
  color: string;
}

interface MonthlyGrowth {
  month: string;
  total: number;
  paid: number;
}

interface FinancialStats {
  revenueByTier: RevenueByTier[];
  totalMRR: number;
  monthlyGrowth: MonthlyGrowth[];
  totalPaidUsers: number;
}

const FinancialTab: React.FC = () => {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();
  
  useEffect(() => {
    fetchFinancialData();
  }, []);
  
  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      await setSupabaseToken(token);
      
      const { data, error } = await supabase.functions.invoke('admin-analytics/financial');
      
      if (error) throw error;
      setStats(data);
    } catch (err) {
      console.error('Error fetching financial analytics:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount);
  };
  
  const getARPU = () => {
    if (!stats || stats.totalPaidUsers === 0) return 0;
    return stats.totalMRR / stats.totalPaidUsers;
  };
  
  const getConversionRate = () => {
    if (!stats) return 0;
    const totalUsers = stats.monthlyGrowth[stats.monthlyGrowth.length - 1]?.total || 1;
    return Math.round((stats.totalPaidUsers / totalUsers) * 100);
  };

  const handleRefresh = async () => {
    await fetchFinancialData();
  };
  
  return (
    <div className="space-y-6">
      {/* Header with Refresh Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Financial Analytics</h2>
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
          title="Monthly Recurring Revenue"
          value={formatCurrency(stats?.totalMRR || 0)}
          icon={DollarSign}
          loading={loading}
          change={12.8}
          trend="up"
        />
        <MetricCard
          title="Paid Subscribers"
          value={stats?.totalPaidUsers?.toLocaleString() ?? 0}
          icon={Users}
          loading={loading}
          change={8.5}
          trend="up"
        />
        <MetricCard
          title="Average Revenue Per User"
          value={formatCurrency(getARPU())}
          icon={CreditCard}
          loading={loading}
          change={3.2}
          trend="up"
        />
        <MetricCard
          title="Free-to-Paid Conversion"
          value={`${getConversionRate()}%`}
          icon={TrendingUp}
          loading={loading}
          change={1.5}
          trend="up"
        />
      </div>
      
      {/* MRR Growth Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
        <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
          User Growth (Last 12 Months)
        </h3>
        <div className="h-80">
          {loading ? (
            <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyGrowth || []}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5B5FFF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#5B5FFF" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(month) => {
                    const [year, monthNum] = month.split('-');
                    return `${monthNum}/${year.slice(2)}`;
                  }}
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
                  labelFormatter={(month) => {
                    const [year, monthNum] = month.split('-');
                    return `${monthNum}/${year}`;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#5B5FFF"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  name="Total Users"
                />
                <Area
                  type="monotone"
                  dataKey="paid"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPaid)"
                  name="Paid Users"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Tier */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
            Revenue by Tier
          </h3>
          <div className="h-80">
            {loading ? (
              <div className="h-full w-full bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.revenueByTier || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {stats?.revenueByTier?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {stats?.revenueByTier?.map((tier) => (
              <div key={tier.name} className="text-center">
                <p className="text-2xl font-extrabold" style={{ color: tier.color }}>
                  {tier.users}
                </p>
                <p className="text-xs text-gray-500 font-medium">{tier.name} users</p>
              </div>
            ))}
          </div>
        </div>
        
        {/* Revenue Details Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white mb-6">
            Revenue Breakdown
          </h3>
          <div className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {stats?.revenueByTier?.map((tier) => (
                  <div
                    key={tier.name}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tier.color }}
                      />
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {tier.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {tier.users} subscribers
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-gray-900 dark:text-white">
                        {formatCurrency(tier.revenue)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {Math.round((tier.revenue / (stats?.totalMRR || 1)) * 100)}% of MRR
                      </p>
                    </div>
                  </div>
                ))}
                
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900 dark:text-white">Total MRR</p>
                    <p className="text-2xl font-extrabold text-[#5B5FFF]">
                      {formatCurrency(stats?.totalMRR || 0)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Annual Run Rate: {formatCurrency((stats?.totalMRR || 0) * 12)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialTab;