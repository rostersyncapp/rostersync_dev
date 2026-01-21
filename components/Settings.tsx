
import React, { useState, useEffect, useRef } from 'react';
import { Profile, SubscriptionTier, Roster } from '../types.ts';
import { PRICING_TIERS } from '../constants.tsx';
import { uploadOrgLogo, getActivityLogs } from '../services/supabase.ts';
import { 
  Building2, 
  CreditCard, 
  Save,
  Loader2,
  BarChart4,
  Palette,
  Upload,
  User,
  ChevronRight,
  CheckCircle2,
  Zap,
  ArrowRight,
  History,
  Clock,
  LogIn,
  LogOut,
  Database,
  Download,
  Trash2,
  Edit,
  Globe
} from 'lucide-react';

interface Props {
  profile: Profile;
  rosters: Roster[];
  onUpdate: (updates: Partial<Profile>) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  LOGIN: <LogIn size={14} className="text-blue-500" />,
  LOGOUT: <LogOut size={14} className="text-gray-400" />,
  ROSTER_SAVE: <Save size={14} className="text-emerald-500" />,
  ROSTER_DELETE: <Trash2 size={14} className="text-red-500" />,
  ROSTER_EXPORT: <Download size={14} className="text-purple-500" />,
  ROSTER_UPDATE: <Edit size={14} className="text-blue-500" />,
  WORKSPACE_UPDATE: <Building2 size={14} className="text-indigo-500" />
};

const Settings: React.FC<Props> = ({ profile, rosters, onUpdate }) => {
  const [orgName, setOrgName] = useState(profile.organizationName);
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [orgLogoUrl, setOrgLogoUrl] = useState(profile.orgLogoUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'org' | 'subscription' | 'roi' | 'activity'>('org');
  const [activities, setActivities] = useState<any[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setOrgName(profile.organizationName);
    setFullName(profile.fullName || '');
    setOrgLogoUrl(profile.orgLogoUrl || '');
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivities();
    }
  }, [activeTab]);

  const fetchActivities = async () => {
    setIsLoadingActivities(true);
    const logs = await getActivityLogs(profile.id);
    setActivities(logs);
    setIsLoadingActivities(false);
  };

  const handleSaveOrg = () => {
    setIsSaving(true);
    setTimeout(() => {
      onUpdate({ organizationName: orgName, fullName: fullName, orgLogoUrl: orgLogoUrl });
      setIsSaving(false);
      alert("Workspace settings saved.");
    }, 600);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const publicUrl = await uploadOrgLogo(profile.id, file);
      setOrgLogoUrl(publicUrl);
      onUpdate({ ...profile, orgLogoUrl: publicUrl });
      alert("Workspace logo uploaded successfully.");
    } catch (err: any) {
      alert("Upload failed: " + err.message);
    } finally { setIsUploading(false); }
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
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 text-gray-900 dark:text-white">Settings</h1>
        <p className="text-base text-gray-500 dark:text-gray-400 font-medium">Manage your organization's metadata and preferences.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-10">
        <aside className="w-full md:w-64 space-y-1.5 shrink-0">
          <button onClick={() => setActiveTab('org')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'org' ? 'bg-white dark:bg-gray-800 shadow-sm text-[#5B5FFF] border border-gray-100 dark:border-gray-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <div className="flex items-center gap-4"><Building2 size={20} /> Organization</div>
            {activeTab === 'org' && <ChevronRight size={18} />}
          </button>
          <button onClick={() => setActiveTab('subscription')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'subscription' ? 'bg-white dark:bg-gray-800 shadow-sm text-[#5B5FFF] border border-gray-100 dark:border-gray-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <div className="flex items-center gap-4"><CreditCard size={20} /> Subscription</div>
            {activeTab === 'subscription' && <ChevronRight size={18} />}
          </button>
          <button onClick={() => setActiveTab('activity')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'activity' ? 'bg-white dark:bg-gray-800 shadow-sm text-[#5B5FFF] border border-gray-100 dark:border-gray-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <div className="flex items-center gap-4"><History size={20} /> Activity Log</div>
            {activeTab === 'activity' && <ChevronRight size={18} />}
          </button>
          <button onClick={() => setActiveTab('roi')} className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl text-base font-bold transition-all ${activeTab === 'roi' ? 'bg-white dark:bg-gray-800 shadow-sm text-[#5B5FFF] border border-gray-100 dark:border-gray-700' : 'text-gray-500 hover:text-gray-900'}`}>
            <div className="flex items-center gap-4"><BarChart4 size={20} /> Performance ROI</div>
            {activeTab === 'roi' && <ChevronRight size={18} />}
          </button>
        </aside>

        <div className="flex-1 space-y-10">
          {activeTab === 'org' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-gray-900 rounded-[40px] border border-gray-100 dark:border-gray-800 p-10 shadow-sm">
                <h3 className="text-2xl font-extrabold mb-8 flex items-center gap-4 text-gray-900 dark:text-white"><Building2 size={24} className="text-[#5B5FFF]" /> Workspace Identity</h3>
                <div className="space-y-6 max-w-lg mb-12">
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input type="text" className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 transition-all text-lg text-gray-900 dark:text-white" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Workspace Name</label>
                    <input type="text" className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 transition-all text-lg text-gray-900 dark:text-white" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                  </div>
                </div>
                <div className="mt-12 pt-12 border-t border-gray-100 dark:border-gray-800">
                  <h3 className="text-2xl font-extrabold mb-8 flex items-center gap-4 text-gray-900 dark:text-white"><Palette size={24} className="text-[#5B5FFF]" /> Workspace Logo</h3>
                  <div className="flex flex-col md:flex-row gap-10 items-start">
                    <div className="relative group">
                      <div className="w-32 h-32 rounded-[32px] primary-gradient flex items-center justify-center text-white shadow-lg overflow-hidden border-4 border-white dark:border-gray-800">
                        {isUploading ? <Loader2 size={32} className="animate-spin" /> : orgLogoUrl ? <img src={orgLogoUrl} alt="Org Logo" className="w-full h-full object-cover" /> : <Building2 size={48} />}
                      </div>
                      <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-3 -right-3 p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 text-[#5B5FFF] hover:scale-110 transition-transform"><Upload size={22} /></button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                    </div>
                    <div className="flex-1 space-y-5">
                       <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Logo URL Override</label>
                       <input type="text" className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 rounded-2xl outline-none text-sm font-mono border border-transparent focus:border-gray-200 dark:focus:border-gray-700" value={orgLogoUrl} onChange={(e) => setOrgLogoUrl(e.target.value)} />
                       <p className="text-sm text-gray-400 font-medium italic">High-definition source recommended (512px+).</p>
                    </div>
                  </div>
                </div>
                <div className="mt-12 pt-8 border-t border-gray-50 dark:border-gray-800">
                  <button onClick={handleSaveOrg} disabled={isSaving || isUploading} className="flex items-center gap-4 px-10 py-4.5 rounded-[24px] primary-gradient text-white font-bold text-base hover:shadow-lg disabled:opacity-50 transition-all uppercase tracking-widest">
                    {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Save Workspace
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
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
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
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
                    <div className="space-y-3">
                       {activities.map((log) => (
                         <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all group">
                            <div className="mt-1 w-8 h-8 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm shrink-0">
                               {ACTION_ICONS[log.action_type] || <CheckCircle2 size={14} className="text-gray-400" />}
                            </div>
                            <div className="flex-1">
                               <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-bold text-gray-900 dark:text-white">{log.action_type.replace(/_/g, ' ')}</span>
                                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight font-mono whitespace-nowrap">
                                     {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                               </div>
                               <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">{log.description}</p>
                            </div>
                         </div>
                       ))}
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'roi' && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
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
