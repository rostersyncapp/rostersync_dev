
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard.tsx';
import Engine from './components/Engine.tsx';
import Settings from './components/Settings.tsx';
import LandingPage from './components/LandingPage.tsx';
import SupportCard from './components/SupportCard.tsx';
import { Roster, Profile, Project } from './types.ts';
import { processRosterRawText, ProcessedRoster } from './services/gemini.ts';
import { supabase, isSupabaseConfigured, getMonthlyUsage, getSiteConfig, SiteConfig, logActivity, setSupabaseToken } from './services/supabase.ts';
import { useUser, useAuth, useClerk, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton, UserProfile } from '@clerk/clerk-react';
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
  Folder,
  FileText,
  FolderOpen,
  Plus,
  Check,
  Trash2,
  ChevronRight,
  Headphones,
  Clock,
  History,
  ChevronDown,
  AlertCircle
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
    ? "w-8 h-8 rounded-lg shrink-0"
    : "w-6 h-6 rounded-lg shrink-0";

  const logoSrc = siteConfig?.logo_url;

  if (!logoSrc) return null;

  return (
    <div className={`${containerClasses} flex items-center justify-center overflow-hidden`}>
      <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
    </div>
  );
};

const getRecursiveRosterCount = (projectId: string, projects: Project[], rosters: Roster[]): number => {
  const directRosters = rosters.filter(r => r.projectId === projectId).length;
  const childProjects = projects.filter(p => p.parentId === projectId);
  const subRosters = childProjects.reduce((acc, child) => acc + getRecursiveRosterCount(child.id, projects, rosters), 0);
  return directRosters + subRosters;
};

const getRecursiveSubfolderCount = (projectId: string, projects: Project[]): number => {
  const childProjects = projects.filter(p => p.parentId === projectId);
  const subfolders = childProjects.reduce((acc, child) => acc + getRecursiveSubfolderCount(child.id, projects), 0);
  return childProjects.length + subfolders;
};

const UserMenu: React.FC<{ user: any; darkMode: boolean; onSignOut: () => void; onOpenProfile: () => void }> = ({ user, darkMode, onSignOut, onOpenProfile }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useClerk();

  const handleSignOut = async () => {
    setIsOpen(false);
    await onSignOut();
  };

  const handleOpenProfile = () => {
    setIsOpen(false);
    onOpenProfile();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
      >
        <div className="w-5 h-5 shrink-0 flex items-center justify-center overflow-hidden rounded-lg">
          {user?.imageUrl ? (
            <img src={user.imageUrl} alt="User" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full primary-gradient flex items-center justify-center text-white text-xs font-bold">
              {user?.firstName?.[0] || 'U'}
            </div>
          )}
        </div>
        <span className="hidden lg:block text-[14px] truncate max-w-[120px]">
          {user?.fullName || user?.primaryEmailAddress?.emailAddress || 'User'}
        </span>
        <ChevronDown size={14} className={`hidden lg:block transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
            <div className="p-3 border-b border-gray-100 dark:border-gray-800">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user?.primaryEmailAddress?.emailAddress || ''}
              </p>
            </div>
            <button
              onClick={handleOpenProfile}
              className="w-full flex items-center gap-3 p-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <SettingsIcon size={16} />
              <span>Account Settings</span>
            </button>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 p-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
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
  setConfirmDeleteProject: (project: Project | null) => void;
}> = ({ folder, level, projects, activeProjectId, rosters, expandedFolderIds, toggleExpand, setView, setActiveProjectId, setSelectedRosterId, setCreatingFolderInId, setNewProjectName, handleDeleteProject, creatingFolderInId, newProjectName, handleCreateProject, isSavingProject, setConfirmDeleteProject }) => {
  const hasChildren = projects.some(p => p.parentId === folder.id);
  const isOpen = expandedFolderIds.includes(folder.id);
  const totalRosterCount = getRecursiveRosterCount(folder.id, projects, rosters);

  return (
    <div className="space-y-0.5">
      <div className="group flex items-center gap-1" style={{ paddingLeft: `${level * 16}px` }}>
        <button onClick={() => { setView('dashboard'); setActiveProjectId(folder.id); setSelectedRosterId(null); }} className={`flex-1 flex items-center px-2 py-1.5 rounded-lg text-[13px] font-bold transition-all ${activeProjectId === folder.id ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF]' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
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
          <button onClick={() => setConfirmDeleteProject(folder)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all cursor-pointer hidden lg:block" title="Delete Folder"><Trash2 size={14} /></button>
        </div>
      </div>
      {creatingFolderInId === folder.id && <div style={{ paddingLeft: `${(level + 1) * 16}px` }}><FolderInput parentId={folder.id} newProjectName={newProjectName} setNewProjectName={setNewProjectName} handleCreateProject={handleCreateProject} setCreatingFolderInId={setCreatingFolderInId} isSavingProject={isSavingProject} /></div>}
      {isOpen && projects.filter(p => p.parentId === folder.id).map(child => <FolderItem key={child.id} folder={child} level={level + 1} projects={projects} activeProjectId={activeProjectId} rosters={rosters} expandedFolderIds={expandedFolderIds} toggleExpand={toggleExpand} setView={setView} setActiveProjectId={setActiveProjectId} setSelectedRosterId={setSelectedRosterId} setCreatingFolderInId={setCreatingFolderInId} setNewProjectName={setNewProjectName} handleDeleteProject={handleDeleteProject} creatingFolderInId={creatingFolderInId} newProjectName={newProjectName} handleCreateProject={handleCreateProject} isSavingProject={isSavingProject} setConfirmDeleteProject={setConfirmDeleteProject} />)}
    </div>
  );
};

const App: React.FC = () => {
  const { isLoaded: clerkLoaded, user } = useUser();
  const { getToken, signOut } = useAuth();
  const { openSignIn, openSignUp } = useClerk();

  // All hooks must be called unconditionally - no early returns before hooks
  const [view, setView] = useState<'dashboard' | 'engine' | 'settings'>('dashboard');

  useEffect(() => {
    const saved = localStorage.getItem('lastView');
    if (saved === 'engine' || saved === 'settings') {
      setView(saved);
    }
  }, []);

  const handleSetView = (newView: 'dashboard' | 'engine' | 'settings') => {
    setView(newView);
    localStorage.setItem('lastView', newView);
  };

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
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<Project | null>(null);
  const [showUserProfile, setShowUserProfile] = useState(false);

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
          const token = await getToken({ template: 'supabase', forceRefresh: true } as any);
          await setSupabaseToken(token);
          await logActivity(user.id, 'LOGIN', 'Signed in to production workspace.');
          fetchData(user);
        } catch (err: any) {
          console.error("Error syncing token with Supabase:", err);
          setInitializationError(err.message || "Failed to synchronize authentication.");
        }
      } else if (clerkLoaded) {
        setSupabaseToken(null);
        setRosters([]);
        setProjects([]);
      }
    };
    syncToken();
  }, [user, clerkLoaded]);

  useEffect(() => {
    const handleTokenExpired = async () => {
      console.log('Token expired event received, refreshing...');
      if (user) {
        try {
          const token = await getToken({ template: 'supabase', forceRefresh: true } as any);
          await setSupabaseToken(token);
          console.log('Token refreshed successfully');
        } catch (err) {
          console.error('Error refreshing token:', err);
        }
      }
    };

    window.addEventListener('clerk-token-expired', handleTokenExpired);
    return () => window.removeEventListener('clerk-token-expired', handleTokenExpired);
  }, [user]);

  useEffect(() => {
    const initApp = async () => {
      const config = await getSiteConfig();
      setSiteConfig(config);

      if (isSupabaseConfigured) {
        const { data } = await supabase.from('release_notes').select('*').order('created_at', { ascending: false });
        if (data) setReleaseNotes(data);
      }
    };

    initApp();
  }, []);

  const fetchData = async (currentUser: any) => {
    setLoadingData(true);
    const userId = currentUser.id;
    try {
      let profileData = null;
      // Use maybeSingle() to avoid 406 errors if headers are wonky, or just checking if data exists
      const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();

      if (!existingProfile) {
        const { data: newProfile, error: createError } = await supabase.from('profiles').insert({
          id: userId,
          full_name: currentUser.fullName || 'User',
          organization_name: 'My Workspace',
          subscription_tier: 'BASIC'
        }).select().single();

        if (createError) {
          console.error("Error creating profile:", createError);
          setInitializationError(`Profile Creation Failed: ${createError.message} (Code: ${createError.code}) - Try refreshing.`);
        }
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
          organizationName: profileData.organization_name || 'My Workspace',
          orgLogoUrl: profileData.org_logo_url,
          creditsUsed: usageCount
        });
      }

      const { data: projectData, error: projectError } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (projectError) {
        console.error("[Auth Debug] Failed to fetch projects:", projectError.message, projectError.code);
        if (projectError.code === '42501' || projectError.message.includes('JWT')) {
          setInitializationError("Authentication sync failed. Please check your Supabase JWT Secret in the Clerk dashboard.");
        }
      }
      if (projectData) setProjects(projectData.map((p: any) => ({ id: p.id, userId: p.user_id, name: p.name || 'Untitled Folder', parentId: p.parent_id, description: p.description, createdAt: p.created_at, color: p.color })));

      const { data: rosterData, error: rosterError } = await supabase.from('rosters').select('*').order('created_at', { ascending: false });
      if (rosterError) console.error("[Auth Debug] Failed to fetch rosters:", rosterError.message);

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
    } catch (err: any) {
      console.error('[Auth Debug] Fatal error in fetchData:', err);
      setInitializationError(err.message || "Failed to initialize user session.");
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
    if (user && isSupabaseConfigured) {
      await supabase.from('projects').delete().eq('id', projectId);
      if (project) {
        await logActivity(profile.id, 'PROJECT_FOLDER_DELETE', `Deleted folder "${project.name}".`);
      }
    }
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setConfirmDeleteProject(null);
  };

  const toggleExpand = (id: string) => setExpandedFolderIds(prev => prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]);

  const handleLogout = async () => {
    if (user) {
      await logActivity(user.id, 'LOGOUT', 'User signed out of production workspace.');
    }
    localStorage.removeItem('lastView');
    await signOut();
  };

  const handleStartProcessing = async (text: string, isNocMode: boolean = false, seasonYear: string = '', findBranding: boolean = false) => {
    const limit = getTierLimit(profile.subscriptionTier);
    if (profile.creditsUsed >= limit) { alert(`Limit Reached! ${profile.creditsUsed}/${limit}`); return; }
    setIsProcessing(true);
    handleSetView('engine');
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
        setRosters(prev => [{ ...newRoster, id: data.id, createdAt: data.created_at, isSynced: true }, ...prev]);
      }
    } else {
      setRosters(prev => [{ ...newRoster, isSynced: false }, ...prev]);
    }
    setPendingRoster(null);
    handleSetView('dashboard');
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupportStatus('sending');
    try {
      const functionUrl = import.meta.env.VITE_RESEND_EMAIL_FUNCTION_URL;

      if (!functionUrl) {
        throw new Error("Email service not configured.");
      }

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          table: 'support',
          record: {
            id: Math.random().toString(36).substring(7), // Mock ID since we aren't using DB
            name: supportForm.name,
            email: supportForm.email,
            user_email: supportForm.email, // Dual field for robustness
            message: supportForm.message,
            user_id: user?.id || 'guest'
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send ticket');
      }

      setSupportStatus('success');
      setTimeout(() => {
        setShowSupportModal(false);
        setSupportStatus('idle');
        setSupportForm({ name: '', email: '', message: '' });
      }, 2000);
    } catch (err: any) {
      console.error("Support ticket error:", err);
      alert(`Failed to send ticket: ${err.message}`);
      setSupportStatus('error');
    }
  };

  return (
    <>
      <SignedOut>
        <LandingPage
          onSignIn={() => openSignIn()}
          onSignUp={() => openSignUp()}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode(!darkMode)}
          siteConfig={siteConfig}
        />
      </SignedOut>
      <SignedIn>
        <div className={`flex min-h-screen bg-[#FAFAFA] dark:bg-gray-950 font-sans text-[#1A1A1A] dark:text-gray-100 transition-colors duration-300`}>
          <aside className="w-16 lg:w-60 border-r border-gray-200 dark:border-gray-800 flex flex-col fixed h-full bg-white dark:bg-gray-900 z-20 transition-all duration-300 shadow-sm">
            <div className="h-16 flex items-center justify-between px-4 lg:px-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-3 text-gray-900 dark:text-white cursor-pointer" onClick={() => { handleSetView('dashboard'); setActiveProjectId(null); setSelectedRosterId(null); }}>
                <BrandLogo siteConfig={siteConfig} />
                <span className="font-extrabold text-base tracking-tight hidden lg:block">{siteConfig.site_name}</span>
              </div>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-lg text-gray-400 hover:text-[#5B5FFF] hover:bg-[#5B5FFF]/5 transition-all">
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 lg:p-4 space-y-6">
              <nav className="space-y-1">
                <button onClick={() => { handleSetView('dashboard'); setActiveProjectId(null); setSelectedRosterId(null); }} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${view === 'dashboard' && activeProjectId === null ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
                  <LayoutDashboard size={20} />
                  <span className="hidden lg:block text-[14px]">Dashboard</span>
                </button>
                <button onClick={() => handleSetView('engine')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${view === 'engine' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold' : 'text-gray-500 hover:bg-gray-50 font-medium'}`}>
                  <Cpu size={20} />
                  <span className="hidden lg:block text-[14px]">The Engine</span>
                </button>
                <button onClick={() => handleSetView('settings')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${view === 'settings' ? 'bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/20 text-[#5B5FFF] font-bold' : 'text-gray-500 hover:bg-gray-100 font-medium'}`}><SettingsIcon size={20} /><span className="hidden lg:block text-[14px]">Settings</span></button>
              </nav>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden lg:block">Folders</span>
                  <button onClick={() => { setCreatingFolderInId('root'); setNewProjectName(''); }} className="p-1 text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-md"><Plus size={16} /></button>
                </div>
                <div className="space-y-0.5 px-0.5">
                  {creatingFolderInId === 'root' && <FolderInput newProjectName={newProjectName} setNewProjectName={setNewProjectName} handleCreateProject={handleCreateProject} setCreatingFolderInId={setCreatingFolderInId} isSavingProject={isSavingProject} />}
                  {projects.filter(p => !p.parentId).map(p => <FolderItem key={p.id} folder={p} level={0} projects={projects} activeProjectId={activeProjectId} rosters={rosters} expandedFolderIds={expandedFolderIds} toggleExpand={toggleExpand} setView={setView} setActiveProjectId={setActiveProjectId} setSelectedRosterId={setSelectedRosterId} setCreatingFolderInId={setCreatingFolderInId} setNewProjectName={setNewProjectName} handleDeleteProject={handleDeleteProject} creatingFolderInId={creatingFolderInId} newProjectName={newProjectName} handleCreateProject={handleCreateProject} isSavingProject={isSavingProject} setConfirmDeleteProject={setConfirmDeleteProject} />)}
                </div>
              </div>
            </div>

            <div className="p-3 lg:p-4 border-t border-gray-100 dark:border-gray-800 space-y-1 bg-white dark:bg-gray-900">
              <button onClick={() => setShowChangelog(true)} className="w-full flex items-center gap-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 font-medium"><ScrollText size={20} /><span className="hidden lg:block text-[14px]">Updates</span></button>
              <button onClick={() => setShowSupportModal(true)} className="w-full flex items-center gap-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 font-medium">
                <HelpCircle size={20} />
                <span className="hidden lg:block text-[14px]">Support</span>
              </button>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="w-full flex items-center gap-3 p-2 rounded-lg text-gray-500 hover:bg-gray-100 font-medium">
                    <LogOut size={20} />
                    <span className="hidden lg:block text-[14px]">Sign In</span>
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserMenu
                  user={user}
                  darkMode={darkMode}
                  onSignOut={async () => {
                    if (user) {
                      await logActivity(user.id, 'LOGOUT', 'User signed out of production workspace.');
                    }
                    await signOut();
                    localStorage.removeItem('lastView');
                  }}
                  onOpenProfile={() => setShowUserProfile(true)}
                />
              </SignedIn>
            </div>
          </aside>

          <main className="flex-1 ml-16 lg:ml-60 p-4 lg:p-8 overflow-y-auto h-screen">
            <div className="max-w-[1400px] mx-auto h-full">
              {view === 'dashboard' && <Dashboard userId={profile.id} rosters={rosters} projects={projects} activeProjectId={activeProjectId} onNewRoster={() => handleSetView('engine')} onDeleteRoster={async (id) => {
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
              {view === 'engine' && <Engine userTier={profile.subscriptionTier} projects={projects} creditsUsed={profile.creditsUsed} maxCredits={getTierLimit(profile.subscriptionTier)} onSave={handleSaveRoster} onStartProcessing={handleStartProcessing} isProcessing={isProcessing} pendingRoster={pendingRoster} onClearPending={() => setPendingRoster(null)} onDeletePlayer={async (athleteName) => {
                await logActivity(profile.id, 'PLAYER_DELETE', `Removed player ${athleteName} from roster.`);
              }} />}
              {view === 'settings' && <Settings profile={profile} rosters={rosters} onUpdate={async (updates) => {
                setProfile(prev => ({ ...prev, ...updates }));
              }} />}
            </div>
          </main>

          {showSupportModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative w-full max-w-4xl animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()}>
                <SupportCard darkMode={darkMode} onClose={() => setShowSupportModal(false)} />
              </div>
            </div>
          )}

          {confirmDeleteProject && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-xl p-6 shadow-2xl animate-in zoom-in duration-300">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center mx-auto mb-3">
                    <Trash2 size={24} />
                  </div>
                  <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Delete Folder?</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Are you sure you want to delete "{confirmDeleteProject.name}"? This action cannot be undone.
                  </p>
                </div>
                <div className="space-y-2 mb-6 text-sm">
                  <div className="flex items-center gap-2 text-orange-500 dark:text-orange-400">
                    <Folder size={16} />
                    <span>{getRecursiveSubfolderCount(confirmDeleteProject.id, projects)} subfolder(s) will be deleted</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <FileText size={16} />
                    <span>{getRecursiveRosterCount(confirmDeleteProject.id, projects, rosters)} roster(s) will be unlinked (remain in library)</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmDeleteProject(null)}
                    className="flex-1 py-2.5 px-4 rounded-lg text-gray-500 dark:text-gray-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteProject(confirmDeleteProject.id)}
                    className="flex-1 py-2.5 px-4 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              </div>
            </div>
          )}

          {showChangelog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center"><ScrollText size={24} /></div>
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
                            <div key={idx} className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
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

          {showUserProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative w-full max-w-[880px] h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl animate-in zoom-in duration-300 overflow-hidden flex flex-col">
                <button
                  onClick={() => setShowUserProfile(false)}
                  className="absolute top-4 right-4 z-50 p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all"
                >
                  <X size={24} />
                </button>
                <div className="flex-1 w-full h-full">
                  <UserProfile
                    appearance={{
                      baseTheme: darkMode ? dark : undefined,
                      elements: {
                        rootBox: 'w-full h-full',
                        card: 'shadow-none bg-transparent w-full h-full',
                        navbar: 'hidden md:flex', // Ensure navbar is visible on desktop
                        navbarMobileMenuButton: 'md:hidden',
                        scrollBox: 'rounded-none', // Fix corners
                        pageScrollBox: 'p-0',
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </SignedIn>
    </>
  );
};

export default App;
