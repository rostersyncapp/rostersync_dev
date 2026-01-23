
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
  FolderX
} from 'lucide-react';

interface Props {
  profile: Profile;
  rosters: Roster[];
  onUpdate: (updates: Partial<Profile>) => void;
}

const ACTIVITY_ICONS: Record<ActivityType, React.ReactNode> = {
  LOGIN: <LogIn size={16} className="text-green-500" />,
  LOGOUT: <LogOut size={16} className="text-gray-500" />,
  ROSTER_DELETE: <Trash2 size={16} className="text-red-500" />,
  PLAYER_DELETE: <UserX size={16} className="text-orange-500" />,
  PROJECT_FOLDER_DELETE: <FolderX size={16} className="text-pink-500" />,
  ROSTER_UPDATE: <Edit size={16} className="text-blue-500" />
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
  const [activeTab, setActiveTab] = useState<'subscription' | 'roi' | 'activity'>('subscription');
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
            <button onClick={() => setActiveTab('subscription')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'subscription' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <div className="flex items-center gap-4"><CreditCard size={20} /> Subscription</div>
              {activeTab === 'subscription' && <ChevronRight size={18} />}
            </button>
            <button onClick={() => setActiveTab('activity')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'activity' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <div className="flex items-center gap-4"><History size={20} /> Activity Log</div>
              {activeTab === 'activity' && <ChevronRight size={18} />}
            </button>
            <button onClick={() => setActiveTab('roi')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'roi' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
              <div className="flex items-center gap-4"><BarChart4 size={20} /> Performance ROI</div>
              {activeTab === 'roi' && <ChevronRight size={18} />}
            </button>
          </aside>

        <div className="flex-1 space-y-10">
          {activeTab === 'subscription' && (
            <div className="space-y-10">
              {/* Usage Card */}
              <div className="bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 p-10 shadow-sm">
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
                      className={`relative p-8 rounded-[36px] border transition-all ${
                        isCurrent 
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
                        <div className="w-full py-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 text-sm font-bold text-center uppercase tracking-widest">
                          Manage Plan
                        </div>
                      ) : (
                        <a 
                          href={tier.polarCheckoutUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="w-full py-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm font-bold text-center uppercase tracking-widest hover:bg-[#5B5FFF] hover:text-white hover:border-[#5B5FFF] transition-all flex items-center justify-center gap-2.5"
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
               <div className="bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 p-10 shadow-sm min-h-[400px]">
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
                    <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-800/30 rounded-[32px] border border-dashed border-gray-100 dark:border-gray-700">
                       <Clock size={40} className="mx-auto text-gray-300 mb-4" />
                       <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Recent Activity</p>
                    </div>
                   ) : (
                     <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                        {activities.map((log) => (
                          <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all group">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="bg-white dark:bg-gray-900 p-8 rounded-[36px] border border-gray-100 dark:border-gray-800 shadow-sm">
                   <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Net Savings</div>
                   <div className="text-4xl font-black text-emerald-500">${netSavings.toFixed(2)}</div>
                 </div>
                 <div className="bg-white dark:bg-gray-900 p-8 rounded-[36px] border border-gray-100 dark:border-gray-800 shadow-sm">
                   <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Time Saved</div>
                   <div className="text-4xl font-black text-[#5B5FFF]">{(totalAthletes * 4 / 60).toFixed(1)} hrs</div>
                 </div>
                 <div className="bg-white dark:bg-gray-900 p-8 rounded-[36px] border border-gray-100 dark:border-gray-800 shadow-sm">
                   <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 font-mono">Total Syncs</div>
                   <div className="text-4xl font-black text-gray-900 dark:text-white">{totalAthletes}</div>
                 </div>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-[48px] border border-gray-100 dark:border-gray-800 p-10 shadow-sm">
                 <h3 className="text-2xl font-extrabold mb-5 flex items-center gap-4 text-gray-900 dark:text-white"><BarChart4 size={24} className="text-[#5B5FFF]" /> Efficiency Breakdown</h3>
                 <p className="text-base text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                   Production benchmarks estimate manual entry takes ~4 minutes per athlete. At an industry rate of $45/hr, RosterSync has significantly reduced overhead for your broadcast workflow.
                 </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
