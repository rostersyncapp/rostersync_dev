import React, { useEffect, useState } from 'react';
import { Users, FileText, DollarSign, Zap } from 'lucide-react';
import MetricCard from './MetricCard';
import SignupChart from '../charts/SignupChart';
import { supabase, setSupabaseToken } from '../../services/supabase';
import { useAuth } from '@clerk/clerk-react';

interface OverviewStats {
  totalUsers: number;
  activeRosters: number;
  monthlyRevenue: number;
  creditsThisMonth: number;
}

const OverviewTab: React.FC = () => {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [signups, setSignups] = useState([]);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();
  
  useEffect(() => {
    fetchOverviewData();
  }, []);
  
  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const token = await getToken({ template: 'supabase' });
      await setSupabaseToken(token);
      
      // Fetch overview stats
      const { data: overviewData, error: overviewError } = await supabase.functions.invoke(
        'admin-analytics/overview'
      );
      
      if (overviewError) throw overviewError;
      setStats(overviewData);
      
      // Fetch signup data
      const { data: signupData, error: signupError } = await supabase.functions.invoke(
        'admin-analytics/signups'
      );
      
      if (signupError) throw signupError;
      setSignups(signupData);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(cents);
  };
  
  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          loading={loading}
          change={12.5}
          trend="up"
        />
        <MetricCard
          title="Active Rosters (30d)"
          value={stats?.activeRosters ?? 0}
          icon={FileText}
          loading={loading}
          change={8.3}
          trend="up"
        />
        <MetricCard
          title="Monthly Revenue"
          value={formatCurrency(stats?.monthlyRevenue ?? 0)}
          icon={DollarSign}
          loading={loading}
          change={15.2}
          trend="up"
        />
        <MetricCard
          title="AI Credits Used"
          value={stats?.creditsThisMonth?.toLocaleString() ?? 0}
          icon={Zap}
          loading={loading}
          change={-5.1}
          trend="down"
        />
      </div>
      
      {/* Charts */}
      <SignupChart data={signups} loading={loading} />
    </div>
  );
};

export default OverviewTab;