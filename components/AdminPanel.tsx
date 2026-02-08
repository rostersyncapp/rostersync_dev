import React, { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { LayoutDashboard, Users, Activity, DollarSign, Settings } from 'lucide-react';
import OverviewTab from './admin/OverviewTab';
import UserAnalyticsTab from './admin/UserAnalyticsTab';
import UsageAnalyticsTab from './admin/UsageAnalyticsTab';
import FinancialTab from './admin/FinancialTab';
import { supabase, setSupabaseToken } from '../services/supabase';

interface Props {
  profile: any;
}

const AdminPanel: React.FC<Props> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'usage' | 'financial'>('overview');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();
  
  useEffect(() => {
    checkAdminStatus();
  }, []);
  
  const checkAdminStatus = async () => {
    try {
      const token = await getToken({ template: 'supabase' });
      await setSupabaseToken(token);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .single();
        
      if (error) throw error;
      setIsAdmin(data?.is_admin || false);
    } catch (err) {
      console.error('Error checking admin status:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5B5FFF]" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-red-900 dark:text-red-200 mb-2">Access Denied</h2>
          <p className="text-red-700 dark:text-red-300">You don't have permission to view this page.</p>
        </div>
      </div>
    );
  }
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'usage', label: 'Usage', icon: Activity },
    { id: 'financial', label: 'Financial', icon: DollarSign },
  ];
  
  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#5B5FFF]/10 rounded-lg">
            <Settings className="w-6 h-6 text-[#5B5FFF]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
              <span className="px-3 py-1 bg-[#5B5FFF] text-white text-xs font-black uppercase tracking-wider rounded-full">
                Admin Mode
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              System analytics and management
            </p>
          </div>
        </div>
      </div>
      
      {/* Tabbed Layout */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-[#5B5FFF]/10 text-[#5B5FFF]'
                      : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5B5FFF]" />}
                </button>
              );
            })}
          </nav>
        </aside>
        
        {/* Content */}
        <div className="flex-1">
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'users' && <UserAnalyticsTab />}
          {activeTab === 'usage' && <UsageAnalyticsTab />}
          {activeTab === 'financial' && <FinancialTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;