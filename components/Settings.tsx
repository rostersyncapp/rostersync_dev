
import React, { useState, useEffect } from 'react';
import { Profile, SubscriptionTier, Roster } from '../types.ts';
import { PRICING_TIERS } from '../constants.tsx';
import { getActivityLogs, setSupabaseToken, ActivityType } from '../services/supabase.ts';
import { useUser, useAuth } from '@clerk/clerk-react';
import {
  CreditCard,
  Loader2,
  BarChart4,
  ChevronRight,
  CheckCircle2,
  Zap,
  ArrowRight,
  History,
  Clock,
  LogIn,
  LogOut,
  Trash2,
  Edit,
  Activity,
  UserX,
  FolderX,
  UserPlus,
  Save,
  Download,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  DollarSign,
  Users,
  Info,
  AlertCircle,
  Database
} from 'lucide-react';

interface Props {
  profile: Profile;
  rosters: Roster[];
  onUpdate: (updates: Partial<Profile>) => void;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  LOGIN: <LogIn size={16} className="text-green-500" />,
  LOGOUT: <LogOut size={16} className="text-gray-500" />,
  ROSTER_SAVE: <Save size={16} className="text-yellow-500" />,
  ROSTER_DELETE: <Trash2 size={16} className="text-red-500" />,
  ROSTER_EXPORT: <Download size={16} className="text-blue-500" />,
  PLAYER_ADD: <UserPlus size={16} className="text-cyan-500" />,
  PLAYER_DELETE: <UserX size={16} className="text-orange-500" />,
  PROJECT_FOLDER_DELETE: <FolderX size={16} className="text-pink-500" />,
  ROSTER_UPDATE: <Edit size={16} className="text-purple-500" />
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
};

const Settings: React.FC<Props> = ({ profile, rosters, onUpdate }) => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState<'subscription' | 'roi' | 'activity' | 'api'>('subscription');
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivities();
    }
  }, [activeTab]);

  const fetchActivities = async () => {
    setIsLoadingActivities(true);

    // Force refresh the Clerk token before fetching activities
    try {
      if (user) {
        console.log('Refreshing Supabase token...');
        const token = await getToken({ template: 'supabase', forceRefresh: true } as any);
        if (token) {
          await setSupabaseToken(token);
          console.log('Token refreshed successfully');
        }
      }
    } catch (tokenError) {
      console.error('Failed to refresh token:', tokenError);
    }

    // First attempt with current client - use user.id directly for consistency
    const currentUserId = user?.id || profile.id;
    let logs = await getActivityLogs(currentUserId);
    console.log('First query activities fetched:', logs);

    // If empty, retry with fresh token/client (handles re-auth timing issues)
    if (logs.length === 0 && user) {
      console.log('Initial query returned empty, refreshing token and retrying...');
      const token = await getToken({ template: 'supabase', forceRefresh: true } as any);
      if (token) {
        await setSupabaseToken(token);
        await new Promise(resolve => setTimeout(resolve, 200));
        logs = await getActivityLogs(user.id);
        console.log('Retry activities fetched:', logs);
      }
    }

    setActivities(logs);
    setIsLoadingActivities(false);
  };

  // Iconik Configuration State
  const [iconikConfig, setIconikConfig] = useState({
    username: '',
    password: '',
    appId: '',
    authToken: '',
    fieldLabel: ''
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  const handleSaveConfig = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('Connecting to Iconik...');

    // Scenario A: Login with Username/Password
    if (iconikConfig.username && iconikConfig.password) {
      try {
        setConnectionMessage('Authenticating with Iconik...');
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rddqcxfalrlmlvirjlca.supabase.co';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/iconik-proxy`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            action: 'login',
            username: iconikConfig.username,
            password: iconikConfig.password,
            appId: iconikConfig.appId // Required for login
          })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.app_id && data.token) {
          // Update state with credentials
          setIconikConfig(prev => ({
            ...prev,
            appId: data.app_id,
            authToken: data.token
          }));

          setConnectionStatus('success');
          setConnectionMessage(`Login successful! App ID and Token retrieved.`);
          return;
        } else {
          let errorMessage = data.detail || data.error || response.statusText;
          if (data.upstream_data && data.upstream_data.errors) {
            errorMessage = data.upstream_data.errors.join(', ');
          }
          throw new Error(errorMessage || 'Login failed');
        }
      } catch (error: any) {
        setConnectionStatus('error');
        setConnectionMessage(`Login failed: ${error.message}`);
        return;
      }
    }

    // Scenario B: Test existing App ID / Token
    if (!iconikConfig.appId || !iconikConfig.authToken) {
      setConnectionStatus('error');
      setConnectionMessage('Please provide Username/Password OR App ID/Auth Token.');
      return;
    }

    try {
      setConnectionMessage('Verifying connection...');
      // Use Supabase Edge Function proxy to avoid CORS
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rddqcxfalrlmlvirjlca.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/iconik-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          appId: iconikConfig.appId,
          authToken: iconikConfig.authToken
        })
      });

      if (response.ok) {
        setConnectionStatus('success');
        setConnectionMessage('Connection successful! Settings saved.');
      } else {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = errorData.error || errorData.detail || response.statusText;

        // Handle Iconik specific error format from proxy wrapper
        if (errorData.upstream_data && errorData.upstream_data.errors) {
          errorMessage = errorData.upstream_data.errors.join(', ');
        } else if (errorData.errors && Array.isArray(errorData.errors)) {
          errorMessage = errorData.errors.join(', ');
        }

        // Provide user-friendly messages for common codes
        if (response.status === 401) {
          errorMessage = `Unauthorized (401): ${errorMessage || 'Invalid App ID or Auth Token'}`;
        } else if (response.status === 404) {
          errorMessage = `Not Found (404): ${errorMessage || 'Invalid App ID, Auth Token, or User Context'}`;
        } else {
          errorMessage = `${errorMessage} (${response.status})`;
        }

        setConnectionStatus('error');
        setConnectionMessage(`Connection failed: ${errorMessage}`);
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setConnectionMessage(`Network error: ${error.message}`);
    }

    // Clear success message after 5 seconds
    setTimeout(() => {
      if (connectionStatus === 'success') {
        setConnectionStatus('idle');
        setConnectionMessage('');
      }
    }, 5000);
  };

  // ROI Stats
  const totalRosters = rosters.length;
  const totalAthletes = rosters.reduce((acc, r) => acc + r.athleteCount, 0);
  const netSavings = (totalAthletes * 4 / 60 * 45) - (totalRosters * 0.04);

  // Subscription Logic
  const currentTier = PRICING_TIERS.find(t => t.id === profile.subscriptionTier) || PRICING_TIERS[0];
  const usageLimit = currentTier.monthlyCredits;
  const usagePercent = Math.min(100, Math.round((profile.creditsUsed / usageLimit) * 100));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 text-gray-900 dark:text-white">Settings</h1>
        <p className="text-base text-gray-500 dark:text-gray-400 font-medium">Manage your organization's metadata and preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        <aside className="w-full md:w-64 space-y-1.5 shrink-0">
          <button onClick={() => setActiveTab('subscription')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-lg text-base font-bold transition-all ${activeTab === 'subscription' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <div className="flex items-center gap-4"><CreditCard size={20} /> Subscription</div>
            {activeTab === 'subscription' && <ChevronRight size={18} />}
          </button>
          <button onClick={() => setActiveTab('activity')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-lg text-base font-bold transition-all ${activeTab === 'activity' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <div className="flex items-center gap-4"><History size={20} /> Activity Log</div>
            {activeTab === 'activity' && <ChevronRight size={18} />}
          </button>
          <button onClick={() => setActiveTab('roi')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-lg text-base font-bold transition-all ${activeTab === 'roi' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <div className="flex items-center gap-4"><BarChart4 size={20} /> Performance ROI</div>
            {activeTab === 'roi' && <ChevronRight size={18} />}
          </button>
          <button onClick={() => setActiveTab('api')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-lg text-base font-bold transition-all ${activeTab === 'api' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
            <div className="flex items-center gap-4"><Database size={20} /> MAM/DAM API</div>
            {activeTab === 'api' && <ChevronRight size={18} />}
          </button>
        </aside>

        <div className="flex-1 space-y-10">
          {activeTab === 'subscription' && (
            <div className="space-y-10">
              {/* Usage Card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 shadow-sm">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-2xl font-extrabold flex items-center gap-4 text-gray-900 dark:text-white">
                    <Zap size={24} className="text-[#5B5FFF]" /> Current Usage
                  </h3>
                  <div className="flex items-center gap-3 bg-[#5B5FFF]/10 px-5 py-2 rounded-full">
                    <span className="text-sm font-black text-[#5B5FFF] uppercase tracking-widest">{profile.subscriptionTier} PLAN</span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-4xl font-black text-gray-900 dark:text-white tracking-tight">{profile.creditsUsed}</span>
                      <span className="text-base text-gray-400 font-bold ml-3 uppercase tracking-widest">/ {usageLimit} Credits Used</span>
                    </div>
                    <span className="text-base font-bold text-gray-400 uppercase tracking-widest">{usagePercent}%</span>
                  </div>

                  <div className="w-full h-4 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full primary-gradient transition-all duration-1000 ease-out"
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>

                  <p className="text-sm text-gray-400 font-medium italic mt-3">
                    Credits reset on the 1st of every month. Upgrade your plan to unlock higher limits.
                  </p>
                </div>
              </div>

              {/* Plan Selection Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {PRICING_TIERS.map((tier) => {
                  const isCurrent = tier.id === profile.subscriptionTier;
                  return (
                    <div
                      key={tier.id}
                      className={`relative p-8 rounded-2xl border transition-all ${isCurrent
                        ? 'border-[#5B5FFF] bg-[#5B5FFF]/[0.02] ring-1 ring-[#5B5FFF]'
                        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
                        }`}
                    >
                      {isCurrent && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-5 py-1.5 primary-gradient text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-md">
                          Active Plan
                        </div>
                      )}

                      <div className="mb-8">
                        <h4 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">{tier.name}</h4>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-black text-gray-900 dark:text-white">{tier.price}</span>
                          <span className="text-sm text-gray-400 font-bold">/mo</span>
                        </div>
                      </div>

                      <div className="space-y-4 mb-10">
                        {tier.features.slice(0, 4).map((feat, i) => (
                          <div key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
                            <CheckCircle2 size={18} className="text-[#5B5FFF] shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>

                      {isCurrent ? (
                        <div className="w-full py-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm font-bold text-center uppercase tracking-widest">
                          Manage Plan
                        </div>
                      ) : (
                        <a
                          href={tier.polarCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-bold text-center uppercase tracking-widest hover:bg-[#5B5FFF] hover:text-white hover:border-[#5B5FFF] transition-all flex items-center justify-center gap-2.5"
                        >
                          Upgrade <ArrowRight size={16} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 shadow-sm min-h-[400px]">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-extrabold flex items-center gap-4 text-gray-900 dark:text-white">
                    <History size={24} className="text-[#5B5FFF]" /> Activity Log
                  </h3>
                  <button onClick={fetchActivities} className="p-2 text-gray-400 hover:text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-lg transition-all">
                    <Zap size={18} className={isLoadingActivities ? 'animate-spin' : ''} />
                  </button>
                </div>

                {isLoadingActivities ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-gray-300" size={40} />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Querying Logs...</span>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-100 dark:border-gray-700">
                    <Clock size={40} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Recent Activity</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {activities.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all group">
                        <div className="mt-0.5 w-9 h-9 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm shrink-0">
                          {ACTIVITY_ICONS[log.action_type as ActivityType] || <Activity size={16} className="text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">{log.action_type.replace(/_/g, ' ')}</span>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-tight font-mono whitespace-nowrap">
                              {formatTimeAgo(log.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed truncate">{log.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roi' && (
            <div className="space-y-8">
              {/* Hero Savings Card */}
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-10 rounded-2xl shadow-lg">
                <div className="text-emerald-100 text-sm font-bold uppercase tracking-widest mb-2">
                  Total Cost Savings
                </div>
                <div className="text-6xl font-black text-white mb-4">
                  ${netSavings.toFixed(2)}
                </div>
                <div className="flex items-center gap-6 text-emerald-100">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} />
                    <span className="text-sm font-bold">vs ${(totalAthletes * 4 / 60 * 45).toFixed(2)} manual cost</span>
                  </div>
                  <div className="h-4 w-px bg-emerald-400"></div>
                  <div className="text-sm font-bold">
                    {totalAthletes > 0 ? (((netSavings / (totalAthletes * 4 / 60 * 45)) * 100).toFixed(0)) : '0'}% reduction
                  </div>
                </div>
              </div>

              {/* Supporting Metrics - 3 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Time Saved */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <Clock size={20} className="text-blue-500" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Efficiency</span>
                  </div>
                  <div className="text-3xl font-black text-gray-900 dark:text-white">
                    {(totalAthletes * 4 / 60).toFixed(1)} hrs
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Time saved vs manual entry</div>
                </div>

                {/* Rosters Processed */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <Users size={20} className="text-purple-500" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Volume</span>
                  </div>
                  <div className="text-3xl font-black text-gray-900 dark:text-white">
                    {totalRosters}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Rosters ({totalAthletes} athletes)
                  </div>
                </div>

                {/* Cost Per Athlete */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <DollarSign size={20} className="text-emerald-500" />
                    <span className="text-xs font-bold text-gray-400 uppercase">Unit Cost</span>
                  </div>
                  <div className="text-3xl font-black text-gray-900 dark:text-white">
                    $0.04
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Per athlete vs $3.00 manual
                  </div>
                </div>
              </div>

              {/* Enhanced Comparison Chart */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 shadow-sm">
                <h3 className="text-xl font-extrabold mb-6 text-gray-900 dark:text-white">
                  Cost Breakdown
                </h3>

                <div className="space-y-6">
                  {/* Manual Entry */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                          <UserX size={20} className="text-red-500" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">Manual Entry</div>
                          <div className="text-xs text-gray-500">4 min/athlete @ $45/hr</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-red-500">
                          ${(totalAthletes * 4 / 60 * 45).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">{(totalAthletes * 4 / 60).toFixed(1)} hrs</div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400" style={{ width: '100%' }}></div>
                    </div>
                  </div>

                  {/* RosterSync */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                          <Zap size={20} className="text-emerald-500" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-white">RosterSync</div>
                          <div className="text-xs text-gray-500">$0.04/athlete automated</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-emerald-500">
                          ${(totalRosters * 0.04).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-400">Instant processing</div>
                      </div>
                    </div>
                    <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                        style={{ width: `${totalAthletes > 0 ? Math.min(((totalRosters * 0.04) / (totalAthletes * 4 / 60 * 45)) * 100, 100) : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Savings Summary */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">Net Savings</span>
                      <div className="flex items-center gap-2">
                        <TrendingDown size={16} className="text-emerald-500" />
                        <span className="text-xl font-black text-emerald-500">
                          ${netSavings.toFixed(2)}
                        </span>
                        <span className="text-xs text-gray-400">
                          ({totalAthletes > 0 ? (((totalAthletes * 4 / 60 * 45 - totalRosters * 0.04) / (totalAthletes * 4 / 60 * 45)) * 100).toFixed(0) : '0'}% reduction)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Optimization Insights */}
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 rounded-2xl border border-blue-200 dark:border-blue-800 p-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                    <Lightbulb size={24} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-3">
                      Optimization Insights
                    </h3>
                    <div className="space-y-2">
                      {usagePercent > 80 && (
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">
                            You're using {usagePercent}% of your credits. Consider upgrading to avoid hitting limits.
                          </span>
                        </div>
                      )}
                      {totalRosters > 0 && totalAthletes / totalRosters < 20 && (
                        <div className="flex items-start gap-2 text-sm">
                          <TrendingUp size={16} className="text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">
                            Avg {(totalAthletes / totalRosters).toFixed(0)} athletes/roster. Larger rosters maximize your ROI.
                          </span>
                        </div>
                      )}
                      {totalRosters > 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">
                            You're saving ${(netSavings / totalRosters).toFixed(2)} per roster on average.
                          </span>
                        </div>
                      )}
                      {totalRosters === 0 && (
                        <div className="flex items-start gap-2 text-sm">
                          <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300">
                            Process your first roster to see personalized ROI insights and savings calculations.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          )}

          {activeTab === 'api' && (
            <div className="space-y-8">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 shadow-sm">
                <h3 className="text-2xl font-extrabold flex items-center gap-4 text-gray-900 dark:text-white mb-8">
                  <Database size={24} className="text-[#5B5FFF]" /> MAM/DAM Configuration
                </h3>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-xl bg-[#5B5FFF]/10 flex items-center justify-center shrink-0">
                      <Database size={28} className="text-[#5B5FFF]" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-gray-900 dark:text-white">Iconik</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Configure connection to Iconik Media Gathering.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Username</label>
                      <input
                        type="text"
                        placeholder="Enter Username"
                        value={iconikConfig.username}
                        onChange={(e) => setIconikConfig(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 focus:border-[#5B5FFF] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                      <input
                        type="password"
                        placeholder="Enter Password"
                        value={iconikConfig.password}
                        onChange={(e) => setIconikConfig(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 focus:border-[#5B5FFF] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Application ID</label>
                      <input
                        type="text"
                        placeholder="Enter App ID"
                        value={iconikConfig.appId}
                        onChange={(e) => setIconikConfig(prev => ({ ...prev, appId: e.target.value }))}
                        className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 focus:border-[#5B5FFF] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Auth Token</label>
                      <input
                        type="password"
                        placeholder="Enter Auth Token"
                        value={iconikConfig.authToken}
                        onChange={(e) => setIconikConfig(prev => ({ ...prev, authToken: e.target.value }))}
                        className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 focus:border-[#5B5FFF] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Field Label</label>
                      <input
                        type="text"
                        placeholder="Enter Field Label"
                        value={iconikConfig.fieldLabel}
                        onChange={(e) => setIconikConfig(prev => ({ ...prev, fieldLabel: e.target.value }))}
                        className="w-full p-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 focus:border-[#5B5FFF] outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <div className="flex-1 mr-4">
                      {connectionStatus === 'error' && (
                        <div className="flex items-center gap-2 text-red-500 text-sm font-bold animate-pulse">
                          <AlertCircle size={16} />
                          {connectionMessage}
                        </div>
                      )}
                      {connectionStatus === 'success' && (
                        <div className="flex items-center gap-2 text-emerald-500 text-sm font-bold">
                          <CheckCircle2 size={16} />
                          {connectionMessage}
                        </div>
                      )}
                      {connectionStatus === 'testing' && (
                        <div className="flex items-center gap-2 text-[#5B5FFF] text-sm font-bold">
                          <Loader2 size={16} className="animate-spin" />
                          Testing connection...
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleSaveConfig}
                      disabled={connectionStatus === 'testing'}
                      className="px-8 py-3 bg-[#5B5FFF] text-white font-bold rounded-xl hover:bg-[#4a4eff] transition-all shadow-lg shadow-[#5B5FFF]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {connectionStatus === 'testing' ? 'Testing...' : 'Save Configuration'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div >
  );
};

export default Settings;
