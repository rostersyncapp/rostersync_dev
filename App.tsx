
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import Engine from './components/Engine.tsx';
import Settings from './components/Settings.tsx';
import Auth from './components/Auth.tsx';
import LandingPage from './components/LandingPage.tsx';
import { Roster, Profile, Project } from './types.ts';
import { processRosterRawText, ProcessedRoster } from './services/gemini.ts';
import { supabase, isSupabaseConfigured, getMonthlyUsage, getSiteConfig, SiteConfig, logActivity, setSupabaseToken } from './services/supabase.ts';
import { useUser, useAuth, useClerk, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import { PRICING_TIERS, getTierLimit, BRAND_CONFIG } from './constants.tsx';
import {
  LayoutDashboard,
  Cpu,
  Settings as SettingsIcon,
  LogOut,
  Disc,
  Sun,
  Moon,
  Loader2,
  ScrollText,
  X,
  Sparkles,
  Zap,
  Globe,
  ShieldCheck,
  HelpCircle,
  Mail,
  User,
  MessageSquare,
  Send,
  CheckCircle2,
  FolderOpen,
  Plus,
  Check,
  Trash2,
  ChevronRight,
  Headphones,
  Clock,
  History,
  ChevronDown
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  zap: Zap,
  sparkle: Sparkles,
  shield: ShieldCheck,
  globe: Globe,
  mail: Mail,
  cpu: Cpu,
  history: History,
  clock: Clock
};

// BrandLogo component that uses Database Branding
const BrandLogo: React.FC<{ siteConfig?: SiteConfig; size?: 'sm' | 'md' }> = ({ siteConfig, size = 'md' }) => {
  const containerClasses = size === 'md'
    ? "w-8 h-8 rounded-xl shrink-0"
    : "w-6 h-6 rounded-lg shrink-0";

  const logoSrc = siteConfig?.logo_url;

  return (
    <div className={`${containerClasses} primary-gradient flex items-center justify-center text-white shadow-lg shadow-[#5B5FFF]/20 overflow-hidden`}>
      {logoSrc ? (
        <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
      ) : (
        React.cloneElement(BRAND_CONFIG.icon as React.ReactElement<any>, { size: size === 'md' ? 18 : 14 })
      )}
    </div>
  );
};

const getRecursiveRosterCount = (projectId: string, projects: Project[], rosters: Roster[]): number => {
  const directRosters = rosters.filter(r => r.projectId === projectId).length;
  const childProjects = projects.filter(p => p.parentId === projectId);
  const subRosters = childProjects.reduce((acc, child) => acc + getRecursiveRosterCount(child.id, projects, rosters), 0);
  return directRosters + subRosters;
};

const FolderInput: React.FC<{
  parentId?: string;
  newProjectName: string;
  setNewProjectName: (val: string) => void;
  handleCreateProject: (parentId?: string) => void;
  setCreatingFolderInId: (id: string | 'root' | null) => void;
  isSavingProject: boolean;
}> = ({ parentId, newProjectName, setNewProjectName, handleCreateProject, setCreatingFolderInId, isSavingProject }) => (
  <div className="px-2 pb-2 animate-in slide-in-from-top-2 duration-300">
    <div className="relative group">
      <input autoFocus type="text" placeholder="Folder Name..." value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => {
        if (e.key === 'Enter') handleCreateProject(parentId);
        if (e.key === 'Escape') setCreatingFolderInId(null);
      }} disabled={isSavingProject} className="w-full p-2 pr-8 bg-white dark:bg-gray-800 border border-[#5B5FFF]/30 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#5B5FFF]/10 dark:text-white disabled:opacity-50" />
      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
        {isSavingProject ? <Loader2 size={12} className="animate-spin text-gray-400" /> : <button onClick={() => handleCreateProject(parentId)} className="p-1.5 hover:bg-[#5B5FFF]/10 rounded text-[#5B5FFF] transition-colors cursor-pointer"><Check size={12} /></button>}
      </div>
    </div>
  </div>
);

const FolderItem: React.FC<{
  folder: Project;
  level: number;
  projects: Project[];
  activeProjectId: string | null;
  rosters: Roster[];
  expandedFolderIds: string[];
  toggleExpand: (id: string) => void;
  setView: (view: 'dashboard' | 'engine' | 'settings') => void;
  setActiveProjectId: (id: string | null) => void;
  setSelectedRosterId: (id: string | null) => void;
  setCreatingFolderInId: (id: string | 'root' | null) => void;
  setNewProjectName: (val: string) => void;
  handleDeleteProject: (id: string) => void;
  creatingFolderInId: string | 'root' | null;
  newProjectName: string;
  handleCreateProject: (parentId?: string) => void;
  isSavingProject: boolean;
}> = ({ folder, level, projects, activeProjectId, rosters, expandedFolderIds, toggleExpand, setView, setActiveProjectId, setSelectedRosterId, setCreatingFolderInId, setNewProjectName, handleDeleteProject, creatingFolderInId, newProjectName, handleCreateProject, isSavingProject }) => {
  const hasChildren = projects.some(p => p.parentId === folder.id);
  const isOpen = expandedFolderIds.includes(folder.id);
  const totalRosterCount = getRecursiveRosterCount(folder.id, projects, rosters);

  return (
    <div className="space-y-0.5">
      <div className="group flex items-center gap-1" style={{ paddingLeft: `${level * 16}px` }}>
        <button onClick={() => { setView('dashboard'); setActiveProjectId(folder.id); setSelectedRosterId(null); }} className={`flex-1 flex items-center px-2 py-1.5 rounded-xl text-[13px] font-bold transition-all ${activeProjectId === folder.id ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {hasChildren ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors shrink-0"
              >
                <ChevronDown size={12} className={`transition-transform ${!isOpen ? '-rotate-90' : ''}`} />
              </button>
            ) : (
              <div className="w-4 shrink-0" />
            )}
            <FolderOpen size={16} className={`shrink-0 ${activeProjectId === folder.id ? 'text-[#5B5FFF]' : 'text-gray-400'}`} />
            <div className="flex items-baseline gap-1 truncate">
              <span className="hidden lg:block truncate">{folder.name}</span>
              {totalRosterCount > 0 && (
                <span className="text-[9px] font-mono opacity-40 translate-y-[-1px] shrink-0 font-black">
                  {totalRosterCount}
                </span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button onClick={() => { setCreatingFolderInId(folder.id); setNewProjectName(''); if (!isOpen) toggleExpand(folder.id); }} className="p-1.5 text-gray-300 hover:text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-lg transition-all cursor-pointer hidden lg:block" title="Add Sub-folder"><Plus size={14} /></button>
          <button onClick={() => handleDeleteProject(folder.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all cursor-pointer hidden lg:block" title="Delete Folder"><Trash2 size={14} /></button>
        </div>
      </div>
      {creatingFolderInId === folder.id && <div style={{ paddingLeft: `${(level + 1) * 16}px` }}><FolderInput parentId={folder.id} newProjectName={newProjectName} setNewProjectName={setNewProjectName} handleCreateProject={handleCreateProject} setCreatingFolderInId={setCreatingFolderInId} isSavingProject={isSavingProject} /></div>}
      {isOpen && projects.filter(p => p.parentId === folder.id).map(child => <FolderItem key={child.id} folder={child} level={level + 1} projects={projects} activeProjectId={activeProjectId} rosters={rosters} expandedFolderIds={expandedFolderIds} toggleExpand={toggleExpand} setView={setView} setActiveProjectId={setActiveProjectId} setSelectedRosterId={setSelectedRosterId} setCreatingFolderInId={setCreatingFolderInId} setNewProjectName={setNewProjectName} handleDeleteProject={handleDeleteProject} creatingFolderInId={creatingFolderInId} newProjectName={newProjectName} handleCreateProject={handleCreateProject} isSavingProject={isSavingProject} />)}
    </div>
  );
};

const App: React.FC = () => {
  const { isLoaded: clerkLoaded, user } = useUser();
  const { getToken, signOut } = useAuth();
  const { openSignIn } = useClerk();

  const [isInitializing, setIsInitializing] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [authModal, setAuthModal] = useState<'signin' | 'signup' | null>(null);
  const [view, setView] = useState<'dashboard' | 'engine' | 'settings'>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({ site_name: 'rosterSync', logo_url: null });

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('rs-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [loadingData, setLoadingData] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [creatingFolderInId, setCreatingFolderInId] = useState<string | 'root' | null>(null);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportForm, setSupportForm] = useState({ name: '', email: '', message: '' });
  const [supportStatus, setSupportStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [rosters, setRosters] = useState<Roster[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>({ id: 'guest_user', fullName: 'Guest User', email: 'guest@rostersync.io', subscriptionTier: 'BASIC', organizationName: 'Demo Studio', creditsUsed: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingRoster, setPendingRoster] = useState<ProcessedRoster | null>(null);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('rs-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('rs-theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const syncToken = async () => {
      if (user) {
        try {
          const token = await getToken({ template: 'supabase' });
          await setSupabaseToken(token);
          setShowLanding(false);
          fetchData(user);
        } catch (err) {
          console.error("Error syncing token with Supabase:", err);
        }
      } else if (clerkLoaded) {
        setSupabaseToken(null);
        setShowLanding(true);
        setRosters([]);
        setProjects([]);
      }
    };
    syncToken();
  }, [user, clerkLoaded]);

  useEffect(() => {
    const initApp = async () => {
      const config = await getSiteConfig();
      setSiteConfig(config);

      if (isSupabaseConfigured) {
        const { data } = await supabase.from('release_notes').select('*').order('created_at', { ascending: false });
        if (data) setReleaseNotes(data);
      }
      setIsInitializing(false);
    };

    initApp();
  }, []);

  const fetchData = async (currentUser: any) => {
    setLoadingData(true);
    const userId = currentUser.id;
    try {
      let profileData = null;
      const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*').eq('id', userId).single();

      if (fetchError && fetchError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase.from('profiles').insert({
          id: userId,
          full_name: currentUser.fullName || 'User',
          organization_name: 'My Workspace',
          subscription_tier: 'BASIC'
        }).select().single();

        if (createError) console.error("Error creating profile:", createError);
        profileData = newProfile;
      } else {
        profileData = existingProfile;
      }

      const usageCount = await getMonthlyUsage(userId);
      if (profileData) {
        setProfile({
          id: profileData.id,
          fullName: profileData.full_name || currentUser.fullName || 'User',
          email: currentUser.primaryEmailAddress?.emailAddress || 'User',
          subscriptionTier: profileData.subscription_tier,
          organizationName: profileData.organization_name || 'Workspace',
          orgLogoUrl: profileData.org_logo_url,
          creditsUsed: usageCount
        });
      }
      const { data: projectData } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projectData) setProjects(projectData.map((p: any) => ({ id: p.id, userId: p.user_id, name: p.name || 'Untitled Folder', parentId: p.parent_id, description: p.description, createdAt: p.created_at, color: p.color })));
      const { data: rosterData } = await supabase.from('rosters').select('*').order('created_at', { ascending: false });
      if (rosterData) {
        setRosters(rosterData.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          projectId: r.project_id,
          teamName: r.team_name || 'Unknown Team',
          sport: r.sport || 'General',
          seasonYear: r.season_year || '',
          isNocMode: r.is_noc_mode || false,
          athleteCount: r.athlete_count || 0,
          rosterData: r.roster_data || [],
          versionDescription: r.version_description || '',
          createdAt: r.created_at,
          teamMetadata: r.team_metadata || {},
          isSynced: true
        })));
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateProject = async (parentId?: string) => {
    if (!newProjectName.trim() || isSavingProject) return;
    setIsSavingProject(true);
    if (!user || !isSupabaseConfigured) {
      const guestProj: Project = { id: Math.random().toString(), userId: 'guest', name: newProjectName, parentId: parentId, createdAt: new Date().toISOString() };
      setProjects(prev => [guestProj, ...prev]);
      setNewProjectName('');
      setCreatingFolderInId(null);
      setIsSavingProject(false);
      return;
    }
    try {
      const { data, error } = await supabase.from('projects').insert({ user_id: user.id, name: newProjectName, parent_id: parentId }).select().single();
      if (error) throw error;
      if (data) {
        setProjects(prev => [{ id: data.id, userId: data.user_id, name: data.name, parentId: data.parent_id, description: data.description, createdAt: data.created_at, color: data.color }, ...prev]);
        setNewProjectName('');
        setCreatingFolderInId(null);
      }
    } catch (err: any) {
      alert("Failed to create folder: " + (err.message || "Unknown error"));
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !window.confirm(`Delete folder "${project.name}"?`)) return;
    if (user && isSupabaseConfigured) await supabase.from('projects').delete().eq('id', projectId);
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const toggleExpand = (id: string) => setExpandedFolderIds(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);

  const handleLogout = async () => {
    if (user) {
      await logActivity(user.id, 'LOGOUT', 'User signed out of production workspace.');
    }
    await signOut();
    setShowLanding(true);
  };

  const handleStartProcessing = async (text: string, isNocMode: boolean = false, seasonYear: string = '', findBranding: boolean = false) => {
    const limit = getTierLimit(profile.subscriptionTier);
    if (profile.creditsUsed >= limit) { alert(`Limit Reached! ${profile.creditsUsed}/${limit}`); return; }
    setIsProcessing(true);
    setView('engine');
    try {
      const result = await processRosterRawText(text, profile.subscriptionTier, isNocMode, seasonYear, findBranding);
      setPendingRoster(result);
      setProfile(prev => ({ ...prev, creditsUsed: prev.creditsUsed + 1 }));
    } catch (error: any) {
      alert(`Processing Failed: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveRoster = async (newRoster: Roster) => {
    if (user && isSupabaseConfigured) {
      const { data } = await supabase.from('rosters').insert({
        user_id: user.id,
        project_id: newRoster.projectId,
        team_name: newRoster.teamName,
        sport: newRoster.sport,
        season_year: newRoster.seasonYear,
        is_noc_mode: newRoster.isNocMode,
        athlete_count: newRoster.athleteCount,
        roster_data: newRoster.rosterData,
        team_metadata: newRoster.teamMetadata,
        version_description: newRoster.versionDescription || ''
      }).select().single();
      if (data) {
        await logActivity(user.id, 'ROSTER_SAVE', `Saved new roster assembly for ${newRoster.teamName}.`);
        setRosters(prev => [{ ...newRoster, id: data.id, createdAt: data.created_at, isSynced: true }, ...prev]);
      }
    } else {
      setRosters(prev => [{ ...newRoster, isSynced: false }, ...prev]);
    }
    setPendingRoster(null);
    setView('dashboard');
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportStatus('sending');
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from('support').insert([{
          user_id: user?.id || null,
          name: supportForm.name,
          email: supportForm.email,
          message: supportForm.message
        }]);
        if (error) throw error;
      }
      setSupportStatus('success');
      setTimeout(() => {
        setShowSupportModal(false);
        setSupportStatus('idle');
        setSupportForm({ name: '', email: '', message: '' });
      }, 2000);
    } catch (err) {
      setSupportStatus('error');
    }
  };

  if (isInitializing || loadingData) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-gray-950 flex flex-col items-center justify-center gap-6 text-center px-4">
        <Loader2 className="animate-spin text-[#5B5FFF]" size={40} />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] animate-pulse">Initializing Production Sync</p>
      </div>
    );
  }

  if (showLanding) {
    return (
      <>
        <LandingPage onSignIn={() => setAuthModal('signin')} onSignUp={() => setAuthModal('signup')} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} siteConfig={siteConfig} />
        {authModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in zoom-in duration-200">
            <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <Auth initialView={authModal} onClose={() => setAuthModal(null)} onGuestLogin={() => setShowLanding(false)} darkMode={darkMode} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`flex min-h-screen bg-[#FAFAFA] dark:bg-gray-950 font-sans text-[#1A1A1A] dark:text-gray-100 transition-colors duration-300`}>
      {/* Clerk Auth Header */}
      <header className="fixed top-0 right-0 p-4 flex items-center gap-4 z-50">
        <SignedOut>
          <div className="flex gap-4">
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 hover:text-[#5B5FFF] transition-all cursor-pointer">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-[#5B5FFF] text-white rounded-full font-bold text-sm h-10 px-6 shadow-lg shadow-[#5B5FFF]/20 hover:scale-105 transition-all cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </SignedOut>
        <SignedIn>
          <UserButton appearance={{ baseTheme: darkMode ? dark : undefined }} />
        </SignedIn>
      </header>
      <aside className="w-16 lg:w-60 border-r border-gray-200 dark:border-gray-800 flex flex-col fixed h-full bg-white dark:bg-gray-900 z-20 transition-all duration-300 shadow-sm">
        <div className="h-16 flex items-center justify-between px-4 lg:px-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3 text-gray-900 dark:text-white cursor-pointer" onClick={() => { setView('dashboard'); setActiveProjectId(null); setSelectedRosterId(null); }}>
            <BrandLogo siteConfig={siteConfig} />
            <span className="font-extrabold text-base tracking-tight hidden lg:block">{siteConfig.site_name}</span>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg text-gray-400 hover:text-[#5B5FFF] hover:bg-[#5B5FFF]/5 transition-all">
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 lg:p-4 space-y-6">
          <nav className="space-y-1">
            <button onClick={() => { setView('dashboard'); setActiveProjectId(null); setSelectedRosterId(null); }} className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${view === 'dashboard' && activeProjectId === null ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              <LayoutDashboard size={20} />
              <span className="hidden lg:block text-[14px]">Dashboard</span>
            </button>
            <button onClick={() => setView('engine')} className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${view === 'engine' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
              <Cpu size={20} />
              <span className="hidden lg:block text-[14px]">The Engine</span>
            </button>
            <button onClick={() => setView('settings')} className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${view === 'settings' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold' : 'text-gray-500 hover:bg-gray-100 font-medium'}`}><SettingsIcon size={20} /><span className="hidden lg:block text-[14px]">Settings</span></button>
          </nav>
          <div className="space-y-2">
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden lg:block">Folders</span>
              <button onClick={() => { setCreatingFolderInId('root'); setNewProjectName(''); }} className="p-1 text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-md"><Plus size={16} /></button>
            </div>
            <div className="space-y-0.5 px-0.5">
              {creatingFolderInId === 'root' && <FolderInput newProjectName={newProjectName} setNewProjectName={setNewProjectName} handleCreateProject={handleCreateProject} setCreatingFolderInId={setCreatingFolderInId} isSavingProject={isSavingProject} />}
              {projects.filter(p => !p.parentId).map(p => <FolderItem key={p.id} folder={p} level={0} projects={projects} activeProjectId={activeProjectId} rosters={rosters} expandedFolderIds={expandedFolderIds} toggleExpand={toggleExpand} setView={setView} setActiveProjectId={setActiveProjectId} setSelectedRosterId={setSelectedRosterId} setCreatingFolderInId={setCreatingFolderInId} setNewProjectName={setNewProjectName} handleDeleteProject={handleDeleteProject} creatingFolderInId={creatingFolderInId} newProjectName={newProjectName} handleCreateProject={handleCreateProject} isSavingProject={isSavingProject} />)}
            </div>
          </div>
        </div>

        <div className="p-3 lg:p-4 border-t border-gray-100 dark:border-gray-800 space-y-1 bg-white dark:bg-gray-900">
          <button onClick={() => setShowChangelog(true)} className="w-full flex items-center gap-3 p-2 rounded-xl text-gray-500 hover:bg-gray-100 font-medium"><ScrollText size={20} /><span className="hidden lg:block text-[14px]">Updates</span></button>
          <button onClick={() => setShowSupportModal(true)} className="w-full flex items-center gap-3 p-2 rounded-xl text-gray-500 hover:bg-gray-100 font-medium">
            <HelpCircle size={20} />
            <span className="hidden lg:block text-[14px]">Support</span>
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 p-2 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all font-medium"><LogOut size={20} /><span className="hidden lg:block text-[14px]">Sign Out</span></button>
        </div>
      </aside>

      <main className="flex-1 ml-16 lg:ml-60 p-4 lg:p-8 overflow-y-auto h-screen">
        <div className="max-w-[1400px] mx-auto h-full">
          {view === 'dashboard' && <Dashboard userId={profile.id} rosters={rosters} projects={projects} activeProjectId={activeProjectId} onNewRoster={() => setView('engine')} onDeleteRoster={async (id) => {
            const roster = rosters.find(r => r.id === id);
            if (roster) {
              await logActivity(profile.id, 'ROSTER_DELETE', `Deleted roster for ${roster.teamName}.`);
            }
            if (roster && roster.projectId) {
              const updated = { ...roster, projectId: undefined };
              if (user && isSupabaseConfigured) {
                await supabase.from('rosters').update({ project_id: null }).eq('id', id);
              }
              setRosters(prev => prev.map(r => r.id === id ? updated : r));
            } else {
              if (user && isSupabaseConfigured) {
                await supabase.from('rosters').delete().eq('id', id);
              }
              setRosters(prev => prev.filter(r => r.id !== id));
            }
          }} onUpdateRoster={async (r) => {
            await logActivity(profile.id, 'ROSTER_UPDATE', `Updated metadata for ${r.teamName}.`);

            // Persist the changes to the database
            if (user && isSupabaseConfigured) {
              const { error } = await supabase
                .from('rosters')
                .update({
                  team_name: r.teamName,
                  sport: r.sport,
                  season_year: r.seasonYear,
                  project_id: r.projectId
                })
                .eq('id', r.id);

              if (error) {
                console.error("Failed to sync updated metadata to cloud:", error);
                alert("Cloud Sync Failed: Your metadata edits could not be saved to the database. Please try again.");
                return;
              }
            }

            // Update local state
            setRosters(prev => prev.map(old => old.id === r.id ? r : old));
          }} userTier={profile.subscriptionTier} creditsUsed={profile.creditsUsed} selectedRosterId={selectedRosterId} onSelectRoster={setSelectedRosterId} onSelectProject={setActiveProjectId} onCreateSubfolder={(pid) => { setCreatingFolderInId(pid || 'root'); setNewProjectName(''); }} />}
          {view === 'engine' && <Engine userTier={profile.subscriptionTier} projects={projects} creditsUsed={profile.creditsUsed} maxCredits={getTierLimit(profile.subscriptionTier)} onSave={handleSaveRoster} onStartProcessing={handleStartProcessing} isProcessing={isProcessing} pendingRoster={pendingRoster} onClearPending={() => setPendingRoster(null)} />}
          {view === 'settings' && <Settings profile={profile} rosters={rosters} onUpdate={async (updates) => {
            await logActivity(profile.id, 'WORKSPACE_UPDATE', 'Updated workspace/profile settings.');
            setProfile(prev => ({ ...prev, ...updates }));
          }} />}
        </div>
      </main>

      {showSupportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-[32px] p-8 shadow-2xl animate-in zoom-in duration-300">
            <button onClick={() => setShowSupportModal(false)} className="absolute top-6 right-6 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"><X size={20} /></button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-xl bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center mx-auto mb-4">
                <Headphones size={32} />
              </div>
              <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white">Broadcast Support</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 font-medium">Technical issues or hardware requests?</p>
            </div>
            <form onSubmit={handleSupportSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Your Name</label>
                <input type="text" required value={supportForm.name} onChange={(e) => setSupportForm({ ...supportForm, name: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 text-sm text-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Work Email</label>
                <input type="email" required value={supportForm.email} onChange={(e) => setSupportForm({ ...supportForm, email: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 text-sm text-gray-900 dark:text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1 font-mono">Message</label>
                <textarea required rows={4} value={supportForm.message} onChange={(e) => setSupportForm({ ...supportForm, message: e.target.value })} className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border-none rounded-xl outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 text-sm text-gray-900 dark:text-white resize-none" />
              </div>
              {supportStatus === 'success' ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-center font-bold text-sm flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} /> Ticket Created!
                </div>
              ) : (
                <button type="submit" disabled={supportStatus === 'sending'} className="w-full py-4 rounded-xl primary-gradient text-white font-bold text-sm shadow-lg shadow-[#5B5FFF]/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                  {supportStatus === 'sending' ? <Loader2 className="animate-spin" size={18} /> : <><MessageSquare size={18} /> Send Ticket</>}
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {showChangelog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center"><ScrollText size={24} /></div>
                <div>
                  <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Production Log</h2>
                  <p className="text-sm text-gray-500 font-medium">System enhancements.</p>
                </div>
              </div>
              <button onClick={() => setShowChangelog(false)} className="p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-10">
              {releaseNotes.map((note) => (
                <div key={note.id} className="relative pl-8 border-l border-gray-100 dark:border-gray-800 animate-in slide-in-from-left-4 duration-500">
                  <div className="absolute -left-[4.5px] top-0 w-2 h-2 rounded-full bg-white dark:bg-gray-900 border border-[#5B5FFF]"></div>
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{note.version}</span>
                      {note.is_latest && <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded-full">Active</span>}
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">{note.title} • {note.release_date}</div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(note.features || []).map((feat: any, idx: number) => {
                      const Icon = ICON_MAP[feat.icon] || Sparkles;
                      return (
                        <div key={idx} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon size={16} className="text-[#5B5FFF]" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#5B5FFF]">{feat.label}</span>
                          </div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 leading-snug">{feat.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
