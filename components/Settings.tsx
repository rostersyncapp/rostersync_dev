
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
  const [iconikConfig, setIconikConfig] = useState(() => {
    const saved = localStorage.getItem('iconikConfig');
    return saved ? JSON.parse(saved) : {
      username: '',
      password: '',
      appId: '',
      authToken: '',
    };
  });
  const [catdvConfig, setCatdvConfig] = useState(() => {
    const saved = localStorage.getItem('catdvConfig');
    return saved ? JSON.parse(saved) : {
      username: '',
      password: '',
      sessionId: '',
      ipAddress: '',
    };
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [catdvStatus, setCatdvStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [catdvMessage, setCatdvMessage] = useState('');
  const [isConnectingCatdv, setIsConnectingCatdv] = useState(false);

  const handleSaveConfig = async () => {
    setConnectionStatus('testing');
    setConnectionMessage('Connecting to Iconik...');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rddqcxfalrlmlvirjlca.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Scenario A: Test existing App ID / Token (Prioritize this if provided)
    if (iconikConfig.appId && iconikConfig.authToken) {
      try {
        setConnectionMessage('Verifying connection...');
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
          const userData = await response.json().catch(() => ({}));
          const userEmail = userData.email || userData.first_name ? `${userData.first_name} ${userData.last_name} (${userData.email})` : 'User';

          setConnectionStatus('success');
          setConnectionMessage(`Connected successfully as ${userEmail}`);
          localStorage.setItem('iconikConfig', JSON.stringify(iconikConfig));
          return;
        }

        // If verification fails, log it and continue to login attempt
        console.log('Token verification failed, attempting login flow...');
      } catch (error) {
        console.log('Token verification network error, attempting login flow...');
      }
    }

    // Scenario B: Login with Username/Password
    if (iconikConfig.username && iconikConfig.password) {
      try {
        setConnectionMessage('Authenticating with Iconik...');
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
            appId: iconikConfig.appId
          })
        });

        const data = await response.json().catch(() => ({}));

        if (response.ok && (data.token || data.auth_token)) {
          const newToken = data.token || data.auth_token;
          const newConfig = {
            ...iconikConfig,
            authToken: newToken
          };

          setIconikConfig(newConfig);
          localStorage.setItem('iconikConfig', JSON.stringify(newConfig));

          setConnectionStatus('success');
          setConnectionMessage(`Login successful! Token retrieved.`);
          return;
        }


        let errorMessage = data.detail || data.error || response.statusText;
        if (data.upstream_data && data.upstream_data.errors) {
          errorMessage = data.upstream_data.errors.join(', ');
        }
        const receivedKeys = Object.keys(data).join(', ');
        throw new Error(errorMessage || `Login failed. Received keys: [${receivedKeys}]`);

      } catch (error: any) {
        setConnectionStatus('error');
        setConnectionMessage(`Login failed: ${error.message}`);
        return;
      }
    }

    // Fallback if no scenarios matched or succeeded
    setConnectionStatus('error');
    setConnectionMessage('Connection failed. Please check your credentials.');
  };

  const handleSaveCatdvConfig = () => {
    try {
      localStorage.setItem('catdvConfig', JSON.stringify(catdvConfig));
      setCatdvStatus('success');
      setCatdvMessage('CatDV configuration saved locally.');
      setTimeout(() => setCatdvStatus('idle'), 3000);
    } catch (e) {
      setCatdvStatus('error');
      setCatdvMessage('Failed to save configuration.');
    }
  };

  const handleCatdvLogin = async () => {
    if (!catdvConfig.username || !catdvConfig.password || !catdvConfig.ipAddress) {
      setCatdvStatus('error');
      setCatdvMessage('Please enter Username, Password, and IP Address.');
      return;
    }

    setIsConnectingCatdv(true);
    setCatdvMessage('Connecting to CatDV...');
    setCatdvStatus('idle');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rddqcxfalrlmlvirjlca.supabase.co';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/catdv-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'login',
          username: catdvConfig.username,
          password: catdvConfig.password,
          server: catdvConfig.ipAddress
        })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.sessionId) {
        const newConfig = {
          ...catdvConfig,
          sessionId: data.sessionId
        };
        setCatdvConfig(newConfig);
        localStorage.setItem('catdvConfig', JSON.stringify(newConfig));

        setCatdvStatus('success');
        setCatdvMessage('Login successful! Session ID retrieved.');
      } else {
        const errorMsg = data.error || data.details || 'Login failed';
        setCatdvStatus('error');
        setCatdvMessage(errorMsg);
      }

    } catch (error: any) {
      setCatdvStatus('error');
      setCatdvMessage(`Network error: ${error.message}`);
    } finally {
      setIsConnectingCatdv(false);
    }
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
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-gray-900 dark:text-white">Settings</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Manage your organization's metadata and preferences.</p>
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
            <div className="flex items-center gap-4"><Database size={20} /> MAM/DAM Sync</div>
            {activeTab === 'api' && <ChevronRight size={18} />}
          </button>
        </aside>

        <div className="flex-1 space-y-10">
          {activeTab === 'subscription' && (
            <div className="space-y-10">
              {/* Usage Card */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-extrabold flex items-center gap-3 text-gray-900 dark:text-white">
                    <Zap size={20} className="text-[#5B5FFF]" /> Usage
                  </h3>
                  <div className="flex items-center gap-2 bg-[#5B5FFF]/10 px-3 py-1 rounded-full">
                    <span className="text-[10px] font-black text-[#5B5FFF] uppercase tracking-widest">{currentTier.name}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{profile.creditsUsed}</span>
                      <span className="text-xs text-gray-400 font-bold ml-2 uppercase tracking-widest">/ {usageLimit} Credits</span>
                    </div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{usagePercent}%</span>
                  </div>

                  <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
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

                      <div className="mb-4">
                        <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1">{tier.name}</h4>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-gray-900 dark:text-white">{tier.price}</span>
                          <span className="text-[10px] text-gray-400 font-bold">/mo</span>
                        </div>
                      </div>

                      <div className="space-y-2.5 mb-6">
                        {tier.features.slice(0, 4).map((feat, i) => (
                          <div key={i} className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                            <CheckCircle2 size={14} className="text-[#5B5FFF] shrink-0 mt-0.5" />
                            <span className="leading-tight">{feat}</span>
                          </div>
                        ))}
                      </div>

                      {isCurrent ? (
                        <div className="w-full py-2.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-400 text-[10px] font-bold text-center uppercase tracking-widest">
                          Manage
                        </div>
                      ) : (
                        <a
                          href={tier.polarCheckoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-[10px] font-bold text-center uppercase tracking-widest hover:bg-[#5B5FFF] hover:text-white hover:border-[#5B5FFF] transition-all flex items-center justify-center gap-2"
                        >
                          Upgrade <ArrowRight size={14} />
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
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Hero Savings Card */}
                <div className="lg:col-span-2 bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-lg border border-emerald-400/20">
                  <div className="text-emerald-100 text-[10px] font-black uppercase tracking-widest mb-1">
                    Total Cost Savings
                  </div>
                  <div className="text-4xl font-black text-white mb-3">
                    ${netSavings.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-4 text-emerald-100">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} />
                      <span className="text-xs font-bold">vs ${(totalAthletes * 4 / 60 * 45).toFixed(2)} manual</span>
                    </div>
                    <div className="h-3 w-px bg-emerald-400/50"></div>
                    <div className="text-xs font-bold">
                      {totalAthletes > 0 ? (((netSavings / (totalAthletes * 4 / 60 * 45)) * 100).toFixed(0)) : '0'}% improved
                    </div>
                  </div>
                </div>

                {/* Compact Optimization Insights */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 flex flex-col justify-center">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                      <Lightbulb size={16} className="text-white" />
                    </div>
                    <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      Insights
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {usagePercent > 80 && (
                      <div className="flex items-start gap-2 text-[11px]">
                        <AlertCircle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                        <span className="text-gray-600 dark:text-gray-400 leading-tight">High usage ({usagePercent}%). Upgrade soon.</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-[11px]">
                      <TrendingUp size={12} className="text-blue-500 mt-0.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400 leading-tight">${(netSavings / Math.max(1, totalRosters)).toFixed(2)} saved per roster.</span>
                    </div>
                    <div className="flex items-start gap-2 text-[11px]">
                      <CheckCircle2 size={12} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-gray-600 dark:text-gray-400 leading-tight">Processing is now 100% automated.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supporting Metrics - 3 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Time Saved */}
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
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
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
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
                <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
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
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                <h3 className="text-lg font-extrabold mb-4 text-gray-900 dark:text-white">
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
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-extrabold flex items-center gap-4 text-gray-900 dark:text-white">
                    <Database size={24} className="text-[#5B5FFF]" /> MAM/DAM Sync
                  </h3>
                  <div className="px-3 py-1 bg-[#5B5FFF]/10 text-[#5B5FFF] text-[10px] font-black uppercase tracking-widest rounded-full">
                    Enterprise
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Iconik Configuration Card */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-[#5B5FFF]/10 flex items-center justify-center shrink-0">
                        <Database size={20} className="text-[#5B5FFF]" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-gray-900 dark:text-white">Iconik</h4>
                        <p className="text-[11px] text-gray-500 font-medium">Cloud Media Gathering.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 flex-1">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Username</label>
                        <input
                          type="text"
                          placeholder="Username"
                          value={iconikConfig.username}
                          onChange={(e) => setIconikConfig(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                        <input
                          type="password"
                          placeholder="Password"
                          value={iconikConfig.password}
                          onChange={(e) => setIconikConfig(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">App ID</label>
                          <input
                            type="text"
                            placeholder="App ID"
                            value={iconikConfig.appId}
                            onChange={(e) => setIconikConfig(prev => ({ ...prev, appId: e.target.value }))}
                            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Token</label>
                          <input
                            type="password"
                            placeholder="Token"
                            value={iconikConfig.authToken}
                            onChange={(e) => setIconikConfig(prev => ({ ...prev, authToken: e.target.value }))}
                            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#5B5FFF]/20 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <button
                        onClick={handleSaveConfig}
                        disabled={connectionStatus === 'testing'}
                        className="w-full py-2.5 bg-[#5B5FFF] text-white text-xs font-bold rounded-lg hover:bg-[#4a4eff] transition-all shadow-md active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                      >
                        {connectionStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : 'Connect Iconik'}
                      </button>
                      {(connectionStatus === 'error' || connectionStatus === 'success') && (
                        <div className={`mt-2 text-[10px] font-bold text-center ${connectionStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
                          {connectionMessage}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CatDV Configuration Card */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Database size={20} className="text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-gray-900 dark:text-white">CatDV</h4>
                        <p className="text-[11px] text-gray-500 font-medium">Local Asset Tracking.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 flex-1">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Username</label>
                        <input
                          type="text"
                          placeholder="Username"
                          value={catdvConfig.username}
                          onChange={(e) => setCatdvConfig(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Password</label>
                        <input
                          type="password"
                          placeholder="Password"
                          value={catdvConfig.password}
                          onChange={(e) => setCatdvConfig(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Server IP</label>
                          <input
                            type="text"
                            placeholder="Server IP"
                            value={catdvConfig.ipAddress}
                            onChange={(e) => setCatdvConfig(prev => ({ ...prev, ipAddress: e.target.value }))}
                            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Session ID</label>
                          <input
                            type="text"
                            placeholder="Session ID"
                            value={catdvConfig.sessionId}
                            onChange={(e) => setCatdvConfig(prev => ({ ...prev, sessionId: e.target.value }))}
                            className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex gap-2">
                      <button
                        onClick={handleCatdvLogin}
                        disabled={isConnectingCatdv}
                        className="flex-1 py-2.5 bg-white border border-emerald-500 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                      >
                        {isConnectingCatdv ? <Loader2 size={14} className="animate-spin" /> : 'Login'}
                      </button>
                      <button
                        onClick={handleSaveCatdvConfig}
                        className="flex-1 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-md active:scale-[0.98]"
                      >
                        Save Local
                      </button>
                    </div>
                    {catdvStatus !== 'idle' && (
                      <div className={`mt-2 text-[10px] font-bold text-center ${catdvStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>
                        {catdvMessage}
                      </div>
                    )}
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
