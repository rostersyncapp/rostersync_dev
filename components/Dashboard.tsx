
import React, { useState, useEffect } from 'react';
import { Roster, Athlete, ExportFormat, SubscriptionTier, Project } from '../types.ts';
import { generateExport, downloadFile } from '../services/export.ts';
import { getTierLimit } from '../constants.tsx';
import { logActivity } from '../services/supabase.ts';
import {
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  ChevronRight,
  Table,
  ArrowLeft,
  Download,
  Trash2,
  X,
  Loader2,
  UserMinus,
  Trophy,
  Target,
  Diamond,
  Activity,
  Flag,
  Waves,
  Bike,
  Anchor,
  Gamepad2,
  Dumbbell,
  Palette,
  ShieldCheck,
  AlertTriangle,
  Copy,
  Globe,
  Cloud,
  CloudOff,
  Clock,
  Zap,
  FolderOpen,
  TrendingUp,
  TrendingDown,
  FolderPlus,
  MoreVertical,
  FileJson,
  FileCode,
  Languages,
  ArrowRight,
  Sparkles,
  ChevronLeft,
  Edit2,
  Check,
  Type as TypeIcon,
  MonitorPlay,
  Database,
  Layers,
  FileText,
  Shirt,
  AlertCircle
} from 'lucide-react';

interface Props {
  userId: string;
  rosters: Roster[];
  projects: Project[];
  activeProjectId: string | null;
  onNewRoster: () => void;
  onDeleteRoster: (id: string) => void;
  onUpdateRoster: (roster: Roster) => void;
  userTier: SubscriptionTier;
  creditsUsed: number;
  selectedRosterId: string | null;
  onSelectRoster: (id: string | null) => void;
  onSelectProject: (id: string | null) => void;
  onCreateSubfolder: (parentId?: string) => void;
  isLoading?: boolean;
}

const getRecursiveRosterCount = (projectId: string, projects: Project[], rosters: Roster[]): number => {
  const directRosters = rosters.filter(r => r.projectId === projectId).length;
  const childProjects = projects.filter(p => p.parentId === projectId);
  const subRosters = childProjects.reduce((acc, child) => acc + getRecursiveRosterCount(child.id, projects, rosters), 0);
  return directRosters + subRosters;
};

const TeamLogo: React.FC<{
  url?: string;
  name: string;
  abbreviation?: string;
  primaryColor?: string;
  size?: 'sm' | 'md' | 'lg'
}> = ({ url, name, abbreviation, primaryColor = '#5B5FFF', size = 'md' }) => {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'w-10 h-10 rounded-lg text-xs',
    md: 'w-12 h-12 rounded-lg text-sm',
    lg: 'w-16 h-16 rounded-lg text-xl'
  };

  const fallbackName = name || 'Untitled';
  const code = abbreviation || fallbackName.substring(0, 3).toUpperCase();

  if (url && url !== 'Unknown' && !error) {
    return (
      <div className={`${sizeClasses[size]} flex items-center justify-center shadow-sm overflow-hidden bg-white border border-gray-100 dark:border-gray-800 shrink-0`}>
        <img
          src={url}
          alt={fallbackName}
          className="w-full h-full object-contain p-2"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClasses[size]} flex items-center justify-center text-white font-mono font-black shadow-md shrink-0 border border-white/20`}
      style={{ backgroundColor: primaryColor }}
    >
      {code}
    </div>
  );
};

const ExportItem: React.FC<{ icon: React.ReactNode; title: string; desc: string; onClick: () => void }> = ({ icon, title, desc, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-[#5B5FFF]/5 dark:hover:bg-[#5B5FFF]/10 rounded-lg transition-all group border border-gray-100 dark:border-gray-800 hover:border-[#5B5FFF]/20">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-[#5B5FFF] shadow-sm transition-colors group-hover:scale-110">
        {icon}
      </div>
      <div className="text-left min-w-0">
        <div className="text-sm font-extrabold text-gray-900 dark:text-white truncate">{title}</div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight mt-0.5 truncate">{desc}</div>
      </div>
    </div>
    <ArrowRight size={18} className="text-gray-300 group-hover:text-[#5B5FFF] group-hover:translate-x-1 transition-all shrink-0" />
  </button>
);

export const Dashboard: React.FC<Props> = ({
  userId,
  rosters,
  projects,
  activeProjectId,
  onNewRoster,
  onDeleteRoster,
  onUpdateRoster,
  userTier,
  creditsUsed,
  selectedRosterId,
  onSelectRoster,
  onSelectProject,
  onCreateSubfolder,
  isLoading = false
}) => {
  const [search, setSearch] = useState('');
  const [showExportDrawer, setShowExportDrawer] = useState(false);
  const [exportLanguage, setExportLanguage] = useState('EN');
  const [movingRosterId, setMovingRosterId] = useState<string | null>(null);
  const [rosterToDelete, setRosterToDelete] = useState<Roster | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const SPORT_NAME_MAP: Record<string, string> = {
    'MLB': 'Baseball',
    'NFL': 'Football',
    'NBA': 'Basketball',
    'NHL': 'Hockey',
    'MLS': 'Soccer',
    'PLL': 'Lacrosse',
    'NWSL': 'Soccer',
    'WNBA': 'Basketball',
    'CFL': 'Football'
  };

  const getSportDisplayName = (sport: string) => {
    const normalized = sport?.toUpperCase() || '';
    return SPORT_NAME_MAP[normalized] || sport || '';
  };

  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSport, setEditSport] = useState('');
  const [editSeason, setEditSeason] = useState('');

  function handleQuickDeleteRoster(e: React.MouseEvent, roster: Roster) {
    e.preventDefault(); e.stopPropagation();
    console.log("handleQuickDeleteRoster triggered for:", roster.teamName);
    setRosterToDelete(roster);
  }

  // Add Player Form State
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerJersey, setNewPlayerJersey] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');
  const [newPlayerPhonetic, setNewPlayerPhonetic] = useState('');
  const [newPlayerIPA, setNewPlayerIPA] = useState('');

  // Iconik Sync State
  const [isSyncingIconik, setIsSyncingIconik] = useState(false);
  const [isSyncIconikSuccess, setIsSyncIconikSuccess] = useState(false);
  const [isIconikModalOpen, setIsIconikModalOpen] = useState(false);
  const [targetFieldLabel, setTargetFieldLabel] = useState('');

  // CatDV Sync State
  const [isSyncingCatdv, setIsSyncingCatdv] = useState(false);
  const [isSyncCatdvSuccess, setIsSyncCatdvSuccess] = useState(false);
  const [isCatdvModalOpen, setIsCatdvModalOpen] = useState(false);
  const [catdvFieldName, setCatdvFieldName] = useState('roster');

  // Health Detail State
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);

  const handleIconikSync = () => {
    setIsIconikModalOpen(true);
  };

  const handleCatdvSync = () => {
    setIsCatdvModalOpen(true);
  };

  const performIconikSync = async () => {
    if (!selectedRoster) return; // Changed from currentRoster to selectedRoster to match existing context
    if (!targetFieldLabel.trim()) {
      alert('Please enter a Field Name (ID).');
      return;
    }

    setIsSyncingIconik(true);

    // Get credentials from localStorage
    const savedConfig = localStorage.getItem('iconikConfig');
    const { appId, authToken } = savedConfig ? JSON.parse(savedConfig) : { appId: '', authToken: '' };

    if (!appId || !authToken) {
      alert('Missing Iconik credentials. Please configure them in Settings.');
      setIsSyncingIconik(false);
      return;
    }

    // Build payload
    const teamName = selectedRoster.teamName; // Changed from currentRoster.name to selectedRoster.teamName
    const athletes = selectedRoster.rosterData || []; // Changed from currentRoster.athletes to selectedRoster.rosterData
    const language = exportLanguage; // Using selected export language

    const payload = {
      action: 'sync_field_options', // Added action as per previous implementation
      appId: appId.trim(),
      authToken: authToken.trim(),
      fieldName: targetFieldLabel.trim(), // From Modal Input
      options: athletes.map(a => ({
        label: a.fullName,
        value: a.fullName // Assuming value = label for now
      })),
      fieldMetadata: {
        label: teamName, // The roster name becomes the field label in options? Or description? 
        // Actually, the previous logic was updating the FIELD itself. 
        // We probably want to update the options of the field specified by targetFieldLabel.
        description: `Synced from RosterSync: ${teamName} (${new Date().toLocaleDateString()})`,
        field_type: 'drop_down' // Hardcoded assumption based on previous code
      }
    };

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rddqcxfalrlmlvirjlca.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/iconik-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error('Iconik Sync Error Details:', data);
        const errorMessage = data?.error || response.statusText || 'Sync request failed';
        const errorDetails = data?.details ? `\nDetails: ${data.details}` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      setIsSyncIconikSuccess(true);
      setTimeout(() => setIsSyncIconikSuccess(false), 5000);
      setIsIconikModalOpen(false); // Close modal on success

    } catch (err: any) {
      console.error('Iconik Sync Failed:', err);
      alert(err.message);
    } finally {
      setIsSyncingIconik(false);
    }
  };

  const performCatdvSync = async () => {
    if (!selectedRoster) return;
    if (!catdvFieldName.trim()) {
      alert('Please enter a Field Name.');
      return;
    }

    setIsSyncingCatdv(true);

    // Get credentials from localStorage
    const savedConfig = localStorage.getItem('catdvConfig');
    if (!savedConfig) {
      alert('Missing CatDV credentials. Please configure them in Settings.');
      setIsSyncingCatdv(false);
      return;
    }

    const { ipAddress, username, password, sessionId } = JSON.parse(savedConfig);

    if (!ipAddress || !username || !password) {
      alert('Incomplete CatDV credentials. Please check Settings.');
      setIsSyncingCatdv(false);
      return;
    }

    // Build payload
    const teamName = selectedRoster.teamName;
    const athletes = [...(selectedRoster.rosterData || [])].sort((a: Athlete, b: Athlete) => {
      const getLastName = (name: string) => {
        const parts = name.trim().split(' ');
        return parts[parts.length - 1] || '';
      };
      return getLastName(a.fullName).localeCompare(getLastName(b.fullName));
    });

    const payload = {
      action: 'sync_catdv_picklist',
      server: ipAddress.trim(),
      username: username.trim(),
      password: password.trim(),
      sessionId: sessionId?.trim() || '',
      fieldName: catdvFieldName.trim(),
      options: athletes.map(a => {
        const parts = a.fullName.trim().split(/\s+/);
        if (parts.length <= 1) return a.fullName;
        const lastName = parts.pop();
        const firstNames = parts.join(' ');
        return `${lastName}, ${firstNames}`;
      })
    };

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rddqcxfalrlmlvirjlca.supabase.co';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Note: Reusing a generic proxy or preparing for catdv-proxy
      const response = await fetch(`${supabaseUrl}/functions/v1/catdv-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || response.statusText || 'CatDV Sync failed');
      }

      setIsSyncCatdvSuccess(true);
      setTimeout(() => setIsSyncCatdvSuccess(false), 5000);
      setIsCatdvModalOpen(false);

    } catch (err: any) {
      console.error('CatDV Sync Failed:', err);
      alert(err.message);
    } finally {
      setIsSyncingCatdv(false);
    }
  };

  const selectedRoster = rosters.find(r => r.id === selectedRosterId) || null;

  useEffect(() => {
    if (selectedRoster) {
      setEditName(selectedRoster.teamName || '');
      setEditSport(selectedRoster.sport || '');
      setEditSeason(selectedRoster.seasonYear || '');
      setIsEditingMetadata(false);
      setShowAddPlayerForm(false);
    }
  }, [selectedRosterId]);

  const handleUpdateMetadata = () => {
    if (!selectedRoster) return;
    onUpdateRoster({
      ...selectedRoster,
      teamName: editName,
      sport: editSport,
      seasonYear: editSeason
    });
    setIsEditingMetadata(false);
  };

  const handleAddPlayer = () => {
    if (!selectedRoster || !newPlayerName.trim()) return;
    const sanitizeName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const newAthlete: Athlete = {
      id: `manual-${Date.now()}`,
      originalName: newPlayerName,
      fullName: newPlayerName.toUpperCase(),
      displayNameSafe: sanitizeName(newPlayerName),
      jerseyNumber: newPlayerJersey.padStart(2, '0').replace(/#/g, ''),
      position: newPlayerPosition.toUpperCase().replace(/#/g, ''),
      phoneticIPA: newPlayerIPA,
      phoneticSimplified: newPlayerPhonetic,
      nilStatus: 'Active',
      seasonYear: selectedRoster.seasonYear,
      birthDate: ''
    };
    const updatedRosterData = [...selectedRoster.rosterData, newAthlete];
    onUpdateRoster({
      ...selectedRoster,
      rosterData: updatedRosterData,
      athleteCount: updatedRosterData.length
    });
    setNewPlayerName('');
    setNewPlayerJersey('');
    setNewPlayerPosition('');
    setNewPlayerPhonetic('');
    setNewPlayerIPA('');
    setShowAddPlayerForm(false);
    logActivity(userId, 'PLAYER_ADD', `Added ${newAthlete.fullName} (#${newAthlete.jerseyNumber}) to ${selectedRoster.teamName}.`);
  };

  const handleDeletePlayer = (athleteId: string) => {
    if (!selectedRoster) return;
    const deletedAthlete = selectedRoster.rosterData.find((a: Athlete) => a.id === athleteId);
    const updatedRosterData = selectedRoster.rosterData.filter((a: Athlete) => a.id !== athleteId);
    onUpdateRoster({
      ...selectedRoster,
      rosterData: updatedRosterData,
      athleteCount: updatedRosterData.length
    });
    if (deletedAthlete) {
      logActivity(userId, 'PLAYER_DELETE', `Removed ${deletedAthlete.fullName} from ${selectedRoster.teamName}.`);
    }
  };

  const filteredRosters = rosters.filter(r => {
    const searchLower = search.toLowerCase();
    const matchesTeamOrSport = (r.teamName || '').toLowerCase().includes(searchLower) ||
      (r.sport || '').toLowerCase().includes(searchLower);

    // Also check if any player name matches
    const matchesPlayerName = r.rosterData?.some(athlete =>
      (athlete.fullName || '').toLowerCase().includes(searchLower)
    );

    const matchesSearch = matchesTeamOrSport || matchesPlayerName;
    const matchesProject = activeProjectId === null || r.projectId === activeProjectId;
    return matchesSearch && matchesProject;
  }).sort((a, b) => (a.teamName || '').localeCompare(b.teamName || ''));

  const subfolders = projects.filter(p => p.parentId === activeProjectId);
  const currentProject = projects.find(p => p.id === activeProjectId);

  const getBreadcrumbs = () => {
    const crumbs: Project[] = [];
    let curr = currentProject;
    while (curr) {
      crumbs.unshift(curr);
      curr = projects.find(p => p.id === curr?.parentId);
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  const handleMoveRoster = (projectId: string | undefined) => {
    if (!movingRosterId) return;
    const roster = rosters.find(r => r.id === movingRosterId);
    if (roster) {
      onUpdateRoster({ ...roster, projectId });
    }
    setMovingRosterId(null);
  };

  const totalAthletes = filteredRosters.reduce((acc, r) => acc + (r.athleteCount || 0), 0);

  const allAthletes = filteredRosters.flatMap(r => r.rosterData || []);
  const missingJerseys = allAthletes.filter(a => !a.jerseyNumber || a.jerseyNumber === '00').length;
  const missingPositions = allAthletes.filter(a => !a.position || a.position === '?' || a.position === '').length;
  const totalMissingData = allAthletes.filter(a =>
    !a.jerseyNumber || a.jerseyNumber === '00' || !a.position || a.position === '?' || a.position === ''
  ).length;

  const healthScore = totalAthletes > 0 ? Math.round(((totalAthletes - totalMissingData) / totalAthletes) * 100) : 100;
  const timeSavedHours = ((totalAthletes * 4) / 60).toFixed(1);
  const tierLimit = getTierLimit(userTier);

  const handleExport = async (format: ExportFormat) => {
    if (!selectedRoster) return;
    await logActivity(userId, 'ROSTER_EXPORT', `Exported ${selectedRoster.teamName} in ${format} format.`);
    const { content, filename, mimeType } = generateExport(selectedRoster.rosterData, format, selectedRoster.teamName, exportLanguage, userTier);
    downloadFile(content, filename, mimeType);
    setShowExportDrawer(false);
  };

  if (selectedRoster) {
    const primaryColor = selectedRoster.preferredAccentColor || selectedRoster.teamMetadata?.primaryColor || '#5B5FFF';
    const secondaryColor = selectedRoster.teamMetadata?.secondaryColor;
    const originalPrimaryColor = selectedRoster.teamMetadata?.primaryColor;

    const handleColorSelect = (color: string) => {
      onUpdateRoster({
        ...selectedRoster,
        preferredAccentColor: color
      });
    };
    return (
      <div className="animate-in slide-in-from-right duration-500 pb-16">
        <button onClick={() => onSelectRoster(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-sm mb-6 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to {currentProject?.name || 'Dashboard'}
        </button>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-8">
          <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ backgroundImage: `linear-gradient(${primaryColor}25, ${primaryColor}25)`, borderBottom: `2px solid ${primaryColor}40` }}></div>
            <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto">
              <TeamLogo url={selectedRoster.teamMetadata?.logoUrl} name={selectedRoster.teamName} abbreviation={selectedRoster.teamMetadata?.abbreviation} primaryColor={primaryColor} size="lg" />
              <div className="flex-1">
                {isEditingMetadata ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Season</label>
                        <input
                          type="text"
                          value={editSeason}
                          onChange={(e) => setEditSeason(e.target.value)}
                          className="w-24 text-xl font-black tracking-tight bg-gray-100 dark:bg-gray-800 border-none rounded-xl px-4 py-3 outline-none ring-2 ring-gray-100 dark:ring-gray-700 focus:ring-[#5B5FFF]/20 text-gray-900 dark:text-white transition-all text-center"
                          placeholder="2024"
                        />
                      </div>
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Team Name</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="text-xl font-black tracking-tight bg-gray-100 dark:bg-gray-800 border-none rounded-xl px-4 py-3 outline-none ring-2 ring-gray-100 dark:ring-gray-700 focus:ring-[#5B5FFF]/20 text-gray-900 dark:text-white w-full transition-all"
                          autoFocus
                        />
                      </div>
                      <div className="flex items-end h-full pt-6">
                        <div className="flex gap-2">
                          <button onClick={handleUpdateMetadata} className="p-3.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"><Check size={20} /></button>
                          <button onClick={() => setIsEditingMetadata(false)} className="p-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all"><X size={20} /></button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 bg-gray-50/50 dark:bg-gray-800/50 px-3 py-2 rounded-xl border border-gray-100 dark:border-gray-700">
                        <TypeIcon size={14} className="text-gray-400" />
                        <input type="text" value={editSport} onChange={(e) => setEditSport(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 w-32" placeholder="Sport" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 group">
                      <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                        <span className="text-gray-300 dark:text-gray-600 font-black tabular-nums">{selectedRoster.seasonYear}</span>
                        {selectedRoster.teamName}
                      </h2>
                      <button
                        onClick={() => setIsEditingMetadata(true)}
                        className="p-1.5 text-gray-300 hover:text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Edit Header"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-gray-500 text-sm font-medium">
                      <span className="flex items-center gap-1.5 opacity-60"><Calendar size={16} /> {selectedRoster.seasonYear}</span>
                      <span className="flex items-center gap-1.5"><Users size={16} /> {selectedRoster.athleteCount} Athletes</span>
                      <span className="px-3 py-1 bg-[#5B5FFF] dark:bg-[#4A4EDD] text-white rounded-full text-[10px] font-black uppercase tracking-widest">{getSportDisplayName(selectedRoster.sport)}</span>
                      {selectedRoster.league && (
                        <span className="px-3 py-1 bg-emerald-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest">{selectedRoster.league}</span>
                      )}

                      {/* Color Picker */}
                      {(originalPrimaryColor || secondaryColor) && (
                        <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 dark:border-gray-700 pl-4">
                          {[originalPrimaryColor, secondaryColor]
                            .filter((c): c is string => !!c) // Filter out null/undefined
                            .filter((c, index, self) =>
                              // Deduplicate case-insensitively
                              index === self.findIndex(t => t.toLowerCase() === c.toLowerCase())
                            )
                            .map((col, idx) => (
                              <button
                                key={`${col}-${idx}`}
                                onClick={(e) => { e.stopPropagation(); handleColorSelect(col); }}
                                className={`w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700 shadow-sm transition-transform hover:scale-110 ${primaryColor?.toLowerCase() === col.toLowerCase() ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white scale-110' : ''}`}
                                style={{ backgroundColor: col }}
                                title={idx === 0 && col === originalPrimaryColor ? "Primary Color" : "Secondary Color"}
                              />
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setShowExportDrawer(true)} className="px-6 py-3.5 rounded-lg primary-gradient text-white font-bold text-sm hover:scale-[1.02] transition-all flex items-center gap-2.5 shadow-lg shadow-[#5B5FFF]/20 hidden lg:flex">
              <Download size={18} /> Export Data
            </button>
          </div>

          {/* Add Player Button/Form */}
          <div className="px-8 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            {showAddPlayerForm ? (
              <div className="flex items-center gap-3 w-full animate-in slide-in-from-left duration-200">
                <input type="text" placeholder="Name" value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex-1 font-semibold" />
                <input type="text" placeholder="Jersey" value={newPlayerJersey} onChange={(e) => setNewPlayerJersey(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-20 font-bold text-center" />
                <input type="text" placeholder="Position" value={newPlayerPosition} onChange={(e) => setNewPlayerPosition(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-24 font-bold text-center uppercase" />
                {userTier !== 'BASIC' && (
                  <input type="text" placeholder="Phonetic" value={newPlayerPhonetic} onChange={(e) => setNewPlayerPhonetic(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-32 font-semibold" title="Simplified Phonetic (e.g. fuh-NET-ik)" />
                )}
                {userTier === 'NETWORK' && (
                  <input type="text" placeholder="IPA" value={newPlayerIPA} onChange={(e) => setNewPlayerIPA(e.target.value)} className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg w-32 font-mono" title="IPA Notation (e.g. /fəˈnɛtɪk/)" />
                )}
                <button onClick={handleAddPlayer} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-colors"><Plus size={14} /></button>
                <button onClick={() => setShowAddPlayerForm(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => setShowAddPlayerForm(true)} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-lg transition-colors">
                <Plus size={14} /> Add Player
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50" style={{ backgroundImage: `linear-gradient(${primaryColor}25, ${primaryColor}25)`, borderBottom: `2px solid ${primaryColor}40` }}>
                  <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center w-12">#</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Athlete Name</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">{selectedRoster.isNocMode ? 'Bib' : 'Jersey'}</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">{selectedRoster.isNocMode ? 'Event' : 'Position'}</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Hardware Safe</th>
                  {selectedRoster.isNocMode && (
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Birth Date</th>
                  )}
                  {userTier !== 'BASIC' && (
                    <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Phonetic</th>
                  )}
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-left">Colors</th>
                  <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[...selectedRoster.rosterData]
                  .sort((a: Athlete, b: Athlete) => {
                    const getLastName = (name: string) => {
                      const parts = name.trim().split(' ');
                      return parts[parts.length - 1] || '';
                    };
                    return getLastName(a.fullName).localeCompare(getLastName(b.fullName));
                  })
                  .map((a: Athlete, idx: number) => (
                    <tr key={a.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-4 py-4 text-center text-sm font-medium text-gray-400 dark:text-gray-500">{idx + 1}</td>
                      <td className="px-8 py-4 text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                        <div className="flex items-center gap-2">
                          {a.fullName}
                          {a.dbStatus === 'NOT_FOUND' && (
                            <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-900/10 px-1.5 py-0.5 rounded border border-red-200 dark:border-red-900/30 animate-pulse">
                              <AlertCircle size={10} /> NOT IN DB
                            </span>
                          )}
                          {selectedRoster.isNocMode && a.countryCode && (
                            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono font-bold text-gray-400 uppercase tracking-wider">
                              {a.countryCode}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center"><span className="inline-block w-10 py-1 rounded-lg bg-blue-600 dark:bg-blue-700 text-white text-xs font-bold shadow-sm">{a.jerseyNumber.toString().replace(/#/g, '')}</span></td>
                      <td className="px-8 py-4 text-center"><span className="inline-block px-3 py-1 rounded-lg bg-purple-600 dark:bg-purple-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">{a.position}</span></td>
                      <td className="px-8 py-4 text-center"><span className="bg-emerald-600 dark:bg-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black text-white tracking-widest font-mono shadow-sm">{a.displayNameSafe}</span></td>
                      {selectedRoster.isNocMode && (
                        <td className="px-8 py-4 text-center">
                          <span className="bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg text-[10px] font-bold text-gray-500 tracking-tighter tabular-nums shadow-sm border border-gray-100 dark:border-gray-700">
                            {a.birthDate || 'Unknown'}
                          </span>
                        </td>
                      )}
                      {userTier !== 'BASIC' && (
                        <td className="px-8 py-4 text-center">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-bold tracking-tight shadow-sm ${userTier === 'NETWORK' ? 'bg-indigo-600 dark:bg-indigo-700 text-white font-mono' : 'bg-amber-500 dark:bg-amber-600 text-white'}`}>
                            {userTier === 'NETWORK' ? (a.phoneticIPA || a.phoneticSimplified || '-') : (a.phoneticSimplified || '-')}
                          </span>
                        </td>
                      )}
                      <td className="px-8 py-4 text-left"><div className="flex gap-2"><div className="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: selectedRoster.teamMetadata?.primaryColor || '#000' }}></div><div className="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: selectedRoster.teamMetadata?.secondaryColor || '#fff' }}></div></div></td>
                      <td className="px-4 py-4 text-center">
                        <button onClick={() => handleDeletePlayer(a.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {showExportDrawer && (
          <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm animate-in fade-in duration-700 flex justify-end" onClick={() => setShowExportDrawer(false)}>
            <div className="w-full max-w-md bg-white dark:bg-gray-950 h-full shadow-2xl animate-in slide-in-from-right duration-1000 overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center shadow-inner"><Download size={24} /></div>
                  <div>
                    <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">Export Assembly</h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-widest mt-0.5">Hardware optimized</p>
                  </div>
                </div>
                <button onClick={() => setShowExportDrawer(false)} className="p-3 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"><X size={24} /></button>
              </div>

              <div className="flex-1 p-8 space-y-10">
                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4 block font-mono">1. Production Locale</label>
                  <div className="flex bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-100 dark:border-gray-800">
                    {['EN', 'ES', 'ZH'].map((lang) => (
                      <button key={lang} onClick={() => setExportLanguage(lang)} className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-lg text-xs font-black transition-all ${exportLanguage === lang ? 'bg-white dark:bg-gray-800 shadow-md text-[#5B5FFF] ring-1 ring-[#5B5FFF]/10' : 'text-gray-400 hover:text-gray-600'}`}>
                        <Globe size={16} /> {lang}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono"><Table size={14} className="text-[#5B5FFF]" /> Generic Interchange</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ExportItem icon={<FileText size={20} />} title="Standard CSV" desc="Clean, flat data for spreadsheets." onClick={() => handleExport('CSV_FLAT')} />
                      <ExportItem icon={<FileJson size={20} />} title="JSON Blob" desc="Developer-friendly structured data." onClick={() => handleExport('VIZRT_JSON')} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono"><MonitorPlay size={14} className="text-[#5B5FFF]" /> Broadcast Hardwares</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ExportItem icon={<MonitorPlay size={20} />} title="Ross DataLinq XML" desc="XPression & Dashboard native." onClick={() => handleExport('ROSS_XML')} />
                      <ExportItem icon={<Database size={20} />} title="Vizrt DataCenter" desc="Trio & Pilot Key-Value CSV." onClick={() => handleExport('VIZRT_DATACENTER_CSV')} />
                      <ExportItem icon={<FileCode size={20} />} title="Olympic ODF XML" desc="High-compliance event XML." onClick={() => handleExport('ODF_XML')} />
                      <ExportItem icon={<Zap size={20} />} title="Chyron Prime CSV" desc="Lyric & Prime automation." onClick={() => handleExport('CHYRON_CSV')} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono"><Palette size={14} className="text-[#5B5FFF]" /> Cloud Graphics</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ExportItem icon={<Palette size={20} />} title="Tagboard DDG CSV" desc="Direct import for Tagboard graphics." onClick={() => handleExport('TAGBOARD_CSV')} />
                      <ExportItem icon={<Zap size={20} />} title="NewBlue Titler CSV" desc="Titler Live data source." onClick={() => handleExport('NEWBLUE_CSV')} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono"><Layers size={14} className="text-[#5B5FFF]" /> Asset Management (MAM)</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ExportItem icon={<Layers size={20} />} title="Iconik Metadata (JSON)" desc="Download JSON file." onClick={() => handleExport('ICONIK_JSON')} />
                      <button
                        onClick={handleIconikSync}
                        disabled={isSyncingIconik}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-[#5B5FFF]/5 dark:hover:bg-[#5B5FFF]/10 rounded-lg transition-all group border border-gray-100 dark:border-gray-800 hover:border-[#5B5FFF]/20"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm transition-colors group-hover:scale-110 ${isSyncIconikSuccess ? 'bg-green-100 text-green-600' : 'bg-white dark:bg-gray-800 text-gray-400 group-hover:text-[#5B5FFF]'}`}>
                            {isSyncingIconik ? <Loader2 size={24} className="animate-spin" /> : isSyncIconikSuccess ? <Check size={24} /> : <Globe size={20} />}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 dark:text-white truncate">Sync to Iconik</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight mt-0.5 truncate">
                              {isSyncingIconik ? 'Syncing...' : isSyncIconikSuccess ? 'Synced Successfully!' : 'Push via API'}
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={18} className="text-gray-300 group-hover:text-[#5B5FFF] group-hover:translate-x-1 transition-all shrink-0" />
                      </button>
                      <button
                        onClick={handleCatdvSync}
                        disabled={isSyncingCatdv}
                        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 rounded-lg transition-all group border border-gray-100 dark:border-gray-800 hover:border-emerald-500/20"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm transition-colors group-hover:scale-110 ${isSyncCatdvSuccess ? 'bg-green-100 text-green-600' : 'bg-white dark:bg-gray-800 text-gray-400 group-hover:text-emerald-500'}`}>
                            {isSyncingCatdv ? <Loader2 size={24} className="animate-spin" /> : isSyncCatdvSuccess ? <Check size={24} /> : <Database size={20} />}
                          </div>
                          <div className="text-left min-w-0">
                            <div className="text-sm font-extrabold text-gray-900 dark:text-white truncate">Sync to CatDV</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tight mt-0.5 truncate">
                              {isSyncingCatdv ? 'Syncing...' : isSyncCatdvSuccess ? 'Synced Successfully!' : 'Update Picklist'}
                            </div>
                          </div>
                        </div>
                        <ArrowRight size={18} className="text-gray-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all shrink-0" />
                      </button>
                      <ExportItem icon={<Cloud size={20} />} title="CatDV Schema" desc="JSON Picklist Definition." onClick={() => handleExport('CATDV_JSON')} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 shrink-0">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center">Format not listed? <a href="#" className="text-[#5B5FFF] hover:underline">Request Custom Parser</a></p>
              </div>
            </div>
          </div>
        )}


        {/* Iconik Sync Modal */}
        {isIconikModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsIconikModalOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Globe size={20} className="text-[#5B5FFF]" />
                    Sync to Iconik
                  </h3>
                  <button
                    onClick={() => setIsIconikModalOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                      Enter the exact <strong>Field Name</strong> (ID) from Iconik where you want to add these athletes.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                      Target Field Name
                    </label>
                    <input
                      type="text"
                      value={targetFieldLabel}
                      onChange={(e) => setTargetFieldLabel(e.target.value)}
                      placeholder="e.g. athlete_names_v1"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-[#5B5FFF]/20 focus:border-[#5B5FFF] outline-none transition-all placeholder:font-medium text-gray-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setIsIconikModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performIconikSync}
                    disabled={!targetFieldLabel.trim() || isSyncingIconik}
                    className="flex-1 px-4 py-3 bg-[#5B5FFF] text-white font-bold rounded-xl hover:bg-[#4a4eff] transition-all shadow-lg shadow-[#5B5FFF]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSyncingIconik ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        Sync Now
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CatDV Sync Modal */}
        {isCatdvModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setIsCatdvModalOpen(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-gray-800 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Database size={20} className="text-emerald-500" />
                    Sync to CatDV
                  </h3>
                  <button
                    onClick={() => setIsCatdvModalOpen(false)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium leading-relaxed">
                      Enter the exact <strong>Field Name</strong> in CatDV where you want to add these athletes.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                      CatDV Field Name
                    </label>
                    <input
                      type="text"
                      value={catdvFieldName}
                      onChange={(e) => setCatdvFieldName(e.target.value)}
                      placeholder="e.g. Name"
                      className="w-full p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:font-medium text-gray-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setIsCatdvModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performCatdvSync}
                    disabled={!catdvFieldName.trim() || isSyncingCatdv}
                    className="flex-1 px-4 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSyncingCatdv ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        Sync Now
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal (Detail View) */}
        {rosterToDelete && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setRosterToDelete(null)} />
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 fade-in duration-200">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 size={32} className="text-red-500" />
              </div>

              <h3 className="text-xl font-black text-gray-900 dark:text-white text-center mb-2">
                {rosterToDelete.projectId ? 'Remove from Folder?' : 'Delete Roster?'}
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8 leading-relaxed font-medium">
                {rosterToDelete.projectId
                  ? `Moving "${rosterToDelete.teamName}" out of this folder. It will still be available in your main Library.`
                  : `Are you sure you want to permanently delete "${rosterToDelete.teamName}"? This action cannot be undone.`
                }
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    console.log("Confirming delete for:", rosterToDelete.id);
                    onDeleteRoster(rosterToDelete.id);
                    setRosterToDelete(null);
                  }}
                  className="w-full py-4 px-6 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-500/20"
                >
                  {rosterToDelete.projectId ? 'Remove from Folder' : 'Delete Roster'}
                </button>
                <button
                  onClick={() => setRosterToDelete(null)}
                  className="w-full py-4 px-6 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => onSelectProject(null)} className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${!activeProjectId ? 'text-[#5B5FFF]' : 'text-gray-400 hover:text-gray-600'}`}>Dashboard</button>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={12} className="text-gray-300" />
                <button onClick={() => onSelectProject(crumb.id)} className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${idx === breadcrumbs.length - 1 ? 'text-[#5B5FFF]' : 'text-gray-400 hover:text-gray-600'}`}>{crumb.name}</button>
              </React.Fragment>
            ))}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{currentProject?.name || 'Library'}</h1>
        </div>
        <button onClick={onNewRoster} className="px-6 py-3.5 rounded-lg primary-gradient text-white font-bold shadow-lg shadow-[#5B5FFF]/20 hover:scale-105 transition-transform flex items-center gap-2.5 cursor-pointer text-sm">
          <Plus size={20} /> New Roster
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {/* Athletes Card */}
        <div className="group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/20 dark:border-gray-800/50 shadow-xl transition-all hover:scale-[1.02] hover:shadow-blue-500/10 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shadow-inner"><Users size={20} /></div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-wider">
              <TrendingUp size={10} /> +8%
            </div>
          </div>
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-mono mb-1">Total Athletes</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{totalAthletes.toLocaleString()}</div>
        </div>

        {/* Health Card */}
        <div
          onClick={() => setIsHealthModalOpen(true)}
          className="group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/20 dark:border-gray-800/50 shadow-xl transition-all hover:scale-[1.02] hover:shadow-emerald-500/10 overflow-hidden cursor-pointer"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-emerald-500/20 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner"><Activity size={20} /></div>
            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/5 px-2 py-1 rounded-full border border-emerald-500/10">Stable</div>
          </div>
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-mono mb-1">Roster Health</div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-emerald-500 tracking-tight">{healthScore}%</div>
          </div>
        </div>

        {/* Health Details Modal */}
        {isHealthModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300" onClick={() => setIsHealthModalOpen(false)}>
            <div
              className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-white/20 dark:border-gray-800 overflow-hidden max-h-[85vh] transform transition-all animate-in zoom-in-95 duration-300 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-y-auto flex-1 custom-scrollbar">
                <div className="p-10">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                        <Activity size={28} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Roster Health</h3>
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Audit Breakdown</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsHealthModalOpen(false)}
                      className="p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all transform hover:rotate-90"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-emerald-500/5 dark:bg-emerald-500/10 rounded-3xl p-8 border border-emerald-500/10">
                      <div className="flex items-end justify-between mb-2">
                        <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] font-mono">Overall Score</div>
                        <div className="text-5xl font-black text-emerald-500 tracking-tighter">{healthScore}%</div>
                      </div>
                      <div className="h-4 bg-emerald-500/10 rounded-full overflow-hidden border border-emerald-500/10">
                        <div className="h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all duration-1000" style={{ width: `${healthScore}%` }}></div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 bg-gray-50/50 dark:bg-gray-800/50 rounded-3xl border border-gray-100 dark:border-gray-700/50">
                        <div className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-1 font-mono">Total Athletes</div>
                        <div className="text-2xl font-black text-gray-900 dark:text-white">{totalAthletes}</div>
                      </div>
                      <div className="p-6 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-3xl border border-emerald-100/50 dark:border-emerald-500/10">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-widest mb-1 font-mono">Complete</div>
                        <div className="text-2xl font-black text-emerald-500">{totalAthletes - totalMissingData}</div>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] ml-1 mb-4">Integrity Issues</h4>

                      <div className="flex items-center justify-between p-5 bg-orange-500/5 rounded-2xl border border-orange-500/10 group hover:bg-orange-500/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
                            <Shirt size={18} />
                          </div>
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Missing Jersey Numbers</span>
                        </div>
                        <div className="px-4 py-1.5 bg-orange-500/10 rounded-full text-orange-600 dark:text-orange-400 text-xs font-black font-mono">
                          {missingJerseys}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-5 bg-blue-500/5 rounded-2xl border border-blue-500/10 group hover:bg-blue-500/10 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                            <Target size={18} />
                          </div>
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Missing Positions</span>
                        </div>
                        <div className="px-4 py-1.5 bg-blue-500/10 rounded-full text-blue-600 dark:text-blue-400 text-xs font-black font-mono">
                          {missingPositions}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-800">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em] mb-4">Action Required</h4>
                    {filteredRosters
                      .map(r => ({
                        ...r,
                        missingJ: (r.rosterData || []).filter(a => !a.jerseyNumber || a.jerseyNumber === '00').length,
                        missingP: (r.rosterData || []).filter(a => !a.position || a.position === '?' || a.position === '').length
                      }))
                      .filter(r => r.missingJ > 0 || r.missingP > 0)
                      .length === 0 ? (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                        <Check size={18} />
                        <span className="text-sm font-bold">All rosters are healthy!</span>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredRosters
                          .map(r => ({
                            ...r,
                            missingJ: (r.rosterData || []).filter(a => !a.jerseyNumber || a.jerseyNumber === '00').length,
                            missingP: (r.rosterData || []).filter(a => !a.position || a.position === '?' || a.position === '').length
                          }))
                          .filter(r => r.missingJ > 0 || r.missingP > 0)
                          .map(r => (
                            <button
                              key={r.id}
                              onClick={() => {
                                onSelectRoster(r.id);
                                setIsHealthModalOpen(false);
                              }}
                              className="w-full bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between hover:border-[#5B5FFF] hover:shadow-md transition-all group text-left"
                            >
                              <div className="flex items-center gap-3">
                                <TeamLogo url={r.teamMetadata?.logoUrl} name={r.teamName} primaryColor={r.preferredAccentColor || r.teamMetadata?.primaryColor} size="sm" />
                                <div>
                                  <div className="text-sm font-bold text-gray-900 dark:text-white">{r.teamName}</div>
                                  <div className="flex gap-2 mt-1">
                                    {r.missingJ > 0 && <span className="text-[9px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded">{r.missingJ} Missing #</span>}
                                    {r.missingP > 0 && <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">{r.missingP} Missing Pos</span>}
                                  </div>
                                </div>
                              </div>
                              <ArrowRight size={16} className="text-gray-300 group-hover:text-[#5B5FFF] group-hover:translate-x-1 transition-all" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 text-center">
                    <p className="text-xs text-gray-400 font-medium italic">
                      Health is calculated based on completeness of athlete metadata across your entire library.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time Saved Card */}
        <div className="group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/20 dark:border-gray-800/50 shadow-xl transition-all hover:scale-[1.02] hover:shadow-purple-500/10 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center shadow-inner"><Clock size={20} /></div>
            <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest font-mono">+2.4h today</div>
          </div>
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-mono mb-1">Time Saved</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{timeSavedHours}<span className="text-lg text-gray-400 ml-1">h</span></div>
        </div>

        {/* Usage Card */}
        <div className="group relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-6 rounded-3xl border border-white/20 dark:border-gray-800/50 shadow-xl transition-all hover:scale-[1.02] hover:shadow-indigo-500/10 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-500/20 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shadow-inner"><Zap size={20} /></div>
            <div className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest font-mono">{tierLimit - creditsUsed} left</div>
          </div>
          <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-mono mb-1">Credits Used</div>
          <div className="flex items-center gap-3">
            <div className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">{creditsUsed}</div>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-100 dark:border-gray-700">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-1000 ease-out"
                style={{ width: `${(creditsUsed / tierLimit) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & View Toggle */}
      <div className="flex gap-4">
        <div className="bg-white dark:bg-gray-900 p-1.5 rounded-lg border border-gray-100 dark:border-gray-800 flex items-center shadow-sm">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2.5 rounded-md transition-all ${viewMode === 'card' ? 'bg-gray-100 dark:bg-gray-800 text-[#5B5FFF] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Layers size={20} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-800 text-[#5B5FFF] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Table size={20} />
          </button>
        </div>
        <div className="relative group flex-1">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input type="text" placeholder="Search library..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-[#5B5FFF]/10 transition-all text-sm font-medium shadow-sm" />
        </div>
      </div>

      {/* Sub-folders Section */}
      {activeProjectId !== null && subfolders.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em] mb-4 font-mono ml-1">Sub-folders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {subfolders.map(folder => {
              const totalRosterCount = getRecursiveRosterCount(folder.id, projects, rosters);
              return (
                <button key={folder.id} onClick={() => onSelectProject(folder.id)} className="p-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg flex items-center gap-4 hover:shadow-md transition-all text-left group">
                  <div className="w-11 h-11 rounded-lg bg-[#5B5FFF]/5 text-[#5B5FFF] flex items-center justify-center group-hover:bg-[#5B5FFF] group-hover:text-white transition-all">
                    <FolderOpen size={22} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1 truncate">
                      <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{folder.name}</div>
                      {totalRosterCount > 0 && <span className="text-[9px] font-mono text-gray-400 font-black">{totalRosterCount}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Teams Section */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em] mb-4 font-mono ml-1">Teams</h3>
        {!isLoading && filteredRosters.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest">Empty Library</p>
          </div>
        ) : (
          viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRosters.map(roster => {
                const primaryColor = roster.preferredAccentColor || roster.teamMetadata?.primaryColor || '#5B5FFF';
                return (
                  <div key={roster.id} onClick={() => onSelectRoster(roster.id)} className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 cursor-pointer hover:shadow-lg transition-all relative overflow-hidden flex flex-col">
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: primaryColor }}></div>
                    <div className="flex justify-between items-start mb-4">
                      <TeamLogo url={roster.teamMetadata?.logoUrl} name={roster.teamName} abbreviation={roster.teamMetadata?.abbreviation} primaryColor={primaryColor} size="md" />
                      <div className="flex gap-1 relative z-10">
                        <button onClick={(e) => { e.stopPropagation(); setMovingRosterId(roster.id); }} className="p-1.5 text-gray-300 hover:text-[#5B5FFF] opacity-0 group-hover:opacity-100" title="Move to Folder"><Plus size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleQuickDeleteRoster(e, roster); }} className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-white truncate pr-1">{roster.teamName || 'Unnamed'}</h3>
                      {roster.isNocMode && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">NOC</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {getSportDisplayName(roster.sport) && (
                        <span className="text-[9px] font-black text-[#5B5FFF] bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/10 px-2 py-0.5 rounded-lg uppercase tracking-widest border border-[#5B5FFF]/10">{getSportDisplayName(roster.sport)}</span>
                      )}
                      {roster.league && (
                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-0.5 rounded-lg uppercase tracking-widest border border-emerald-500/20">{roster.league}</span>
                      )}
                      <span className="text-[10px] font-bold text-gray-400 font-mono ml-auto">{roster.seasonYear}</span>
                    </div>
                    <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400"><Users size={14} /> {roster.athleteCount} Athletes</div>
                      {roster.isSynced && <Cloud size={14} className="text-[#5B5FFF]" />}
                    </div>

                    {movingRosterId === roster.id && (
                      <div className="absolute inset-0 bg-white dark:bg-gray-900 p-4 z-20 flex flex-col animate-in fade-in duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 font-mono">Move Target</h4>
                          <button onClick={() => setMovingRosterId(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X size={16} /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                          <button onClick={() => handleMoveRoster(undefined)} className="w-full text-left p-2.5 text-xs font-bold hover:bg-[#5B5FFF]/5 hover:text-[#5B5FFF] rounded-lg transition-all flex items-center gap-3"><FolderOpen size={14} /> Root</button>
                          {projects.map(p => (
                            <button key={p.id} onClick={() => handleMoveRoster(p.id)} className="w-full text-left p-2.5 text-xs font-bold hover:bg-[#5B5FFF]/5 hover:text-[#5B5FFF] rounded-lg transition-all flex items-center gap-3"><FolderOpen size={14} /> {p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] w-20">Logo</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Team Name</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Sport</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">League</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Season</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Athletes</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredRosters.map(roster => {
                    const primaryColor = roster.preferredAccentColor || roster.teamMetadata?.primaryColor || '#5B5FFF';
                    return (
                      <tr
                        key={roster.id}
                        onClick={() => onSelectRoster(roster.id)}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group border-l-[6px]"
                        style={{ borderLeftColor: primaryColor }}
                      >
                        <td className="px-6 py-4">
                          <TeamLogo url={roster.teamMetadata?.logoUrl} name={roster.teamName} abbreviation={roster.teamMetadata?.abbreviation} primaryColor={primaryColor} size="sm" />
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                            {roster.teamName || 'Unnamed'}
                            {roster.isNocMode && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">NOC</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getSportDisplayName(roster.sport) ? (
                            <span className="text-[9px] font-black text-[#5B5FFF] bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/10 px-2 py-1 rounded-lg uppercase tracking-widest border border-[#5B5FFF]/10">{getSportDisplayName(roster.sport)}</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {roster.league ? (
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded-lg uppercase tracking-widest border border-emerald-500/20">{roster.league}</span>
                          ) : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-500">
                          {roster.seasonYear}
                        </td>
                        <td className="px-6 py-4 text-center text-sm font-bold text-gray-500">
                          {roster.athleteCount}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); setMovingRosterId(roster.id); }} className="p-2 text-gray-300 hover:text-[#5B5FFF] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md" title="Move to Folder"><Plus size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleQuickDeleteRoster(e, roster); }} className="p-2 text-gray-300 hover:text-red-500 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md" title="Delete Roster"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Delete Confirmation Modal (Main View) */}
        {rosterToDelete && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setRosterToDelete(null)} />
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 border border-gray-100 dark:border-gray-800 animate-in zoom-in-95 fade-in duration-200">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/30 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 size={32} className="text-red-500" />
              </div>

              <h3 className="text-xl font-black text-gray-900 dark:text-white text-center mb-2">
                {rosterToDelete.projectId ? 'Remove from Folder?' : 'Delete Roster?'}
              </h3>

              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8 leading-relaxed font-medium">
                {rosterToDelete.projectId
                  ? `Moving "${rosterToDelete.teamName}" out of this folder. It will still be available in your main Library.`
                  : `Are you sure you want to permanently delete "${rosterToDelete.teamName}"? This action cannot be undone.`
                }
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    console.log("Confirming delete for:", rosterToDelete.id);
                    onDeleteRoster(rosterToDelete.id);
                    setRosterToDelete(null);
                  }}
                  className="w-full py-4 px-6 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-red-500/20"
                >
                  {rosterToDelete.projectId ? 'Remove from Folder' : 'Delete Roster'}
                </button>
                <button
                  onClick={() => setRosterToDelete(null)}
                  className="w-full py-4 px-6 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
