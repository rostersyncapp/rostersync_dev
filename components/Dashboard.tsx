
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
  FolderPlus,
  MoreVertical,
  Move,
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
  FileText
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

  if (url && !error) {
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

  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSport, setEditSport] = useState('');
  const [editSeason, setEditSeason] = useState('');

  // Add Player Form State
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerJersey, setNewPlayerJersey] = useState('');
  const [newPlayerPosition, setNewPlayerPosition] = useState('');

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
      phoneticIPA: '',
      phoneticSimplified: '',
      nilStatus: 'Active',
      seasonYear: selectedRoster.seasonYear
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
    const matchesSearch = (r.teamName || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.sport || '').toLowerCase().includes(search.toLowerCase());
    const matchesProject = activeProjectId === null || r.projectId === activeProjectId;
    return matchesSearch && matchesProject;
  });

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
  const totalMissingData = filteredRosters.flatMap(r => r.rosterData || []).filter(a =>
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
    const primaryColor = selectedRoster.teamMetadata?.primaryColor || '#5B5FFF';
    return (
      <div className="animate-in slide-in-from-right duration-500 pb-16">
        <button onClick={() => onSelectRoster(null)} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 dark:hover:text-white font-bold text-sm mb-6 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to {currentProject?.name || 'Library'}
        </button>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-8">
          <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, transparent 100%)` }}></div>
            <div className="flex items-center gap-6 relative z-10 w-full lg:w-auto">
              <TeamLogo url={selectedRoster.teamMetadata?.logoUrl} name={selectedRoster.teamName} abbreviation={selectedRoster.teamMetadata?.abbreviation} primaryColor={primaryColor} size="lg" />
              <div className="flex-1">
                {isEditingMetadata ? (
                  <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-2xl font-extrabold tracking-tight bg-gray-50 dark:bg-gray-800 border-none rounded-lg px-4 py-2.5 outline-none ring-2 ring-[#5B5FFF]/20 text-gray-900 dark:text-white w-full max-w-md"
                        autoFocus
                      />
                      <button onClick={handleUpdateMetadata} className="p-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-md"><Check size={20} /></button>
                      <button onClick={() => setIsEditingMetadata(false)} className="p-2.5 bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"><X size={20} /></button>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                        <TypeIcon size={14} className="text-gray-400" />
                        <input type="text" value={editSport} onChange={(e) => setEditSport(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 w-24" placeholder="Sport" />
                      </div>
                      <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                        <Calendar size={14} className="text-gray-400" />
                        <input type="text" value={editSeason} onChange={(e) => setEditSeason(e.target.value)} className="bg-transparent border-none outline-none text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 w-24" placeholder="Season" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3 group">
                      <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{selectedRoster.teamName}</h2>
                      <button
                        onClick={() => setIsEditingMetadata(true)}
                        className="p-1.5 text-gray-300 hover:text-[#5B5FFF] hover:bg-[#5B5FFF]/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-gray-500 text-sm font-medium">
                      <span className="flex items-center gap-1.5"><Calendar size={16} /> {selectedRoster.seasonYear}</span>
                      <span className="flex items-center gap-1.5"><Users size={16} /> {selectedRoster.athleteCount} Athletes</span>
                      <span className="px-3 py-1 bg-[#5B5FFF] dark:bg-[#4A4EDD] text-white rounded-full text-[10px] font-black uppercase tracking-widest">{selectedRoster.sport}</span>
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
                <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                  <th className="px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center w-12">#</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">Athlete Name</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">{selectedRoster.isNocMode ? 'Bib' : 'Jersey'}</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">{selectedRoster.isNocMode ? 'Event' : 'Position'}</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center">Hardware Safe</th>
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
                        {a.fullName}
                        {a.countryCode && <span className="ml-2 text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono font-bold text-gray-400 uppercase tracking-wider">{a.countryCode}</span>}
                      </td>
                      <td className="px-8 py-4 text-center"><span className="inline-block w-10 py-1 rounded-lg bg-blue-600 dark:bg-blue-700 text-white text-xs font-bold shadow-sm">{a.jerseyNumber.toString().replace(/#/g, '')}</span></td>
                      <td className="px-8 py-4 text-center"><span className="inline-block px-3 py-1 rounded-lg bg-purple-600 dark:bg-purple-700 text-white text-[10px] font-black uppercase tracking-widest shadow-sm">{a.position}</span></td>
                      <td className="px-8 py-4 text-center"><span className="bg-emerald-600 dark:bg-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black text-white tracking-widest font-mono shadow-sm">{a.displayNameSafe}</span></td>
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
                    <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 font-mono"><Layers size={14} className="text-[#5B5FFF]" /> Asset Management (MAM)</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <ExportItem icon={<Layers size={20} />} title="Iconik Metadata" desc="JSON field-mapping definition." onClick={() => handleExport('ICONIK_JSON')} />
                      <ExportItem icon={<Cloud size={20} />} title="CatDV Schema" desc="Semicolon delimited metadata." onClick={() => handleExport('CATDV_CSV')} />
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
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Breadcrumbs & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => onSelectProject(null)} className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${!activeProjectId ? 'text-[#5B5FFF]' : 'text-gray-400 hover:text-gray-600'}`}>Library</button>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight size={12} className="text-gray-300" />
                <button onClick={() => onSelectProject(crumb.id)} className={`text-[10px] font-bold uppercase tracking-[0.25em] transition-colors ${idx === breadcrumbs.length - 1 ? 'text-[#5B5FFF]' : 'text-gray-400 hover:text-gray-600'}`}>{crumb.name}</button>
              </React.Fragment>
            ))}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{currentProject?.name || 'Metadata Library'}</h1>
        </div>
        <button onClick={onNewRoster} className="px-6 py-3.5 rounded-lg primary-gradient text-white font-bold shadow-lg shadow-[#5B5FFF]/20 hover:scale-105 transition-transform flex items-center gap-2.5 cursor-pointer text-sm">
          <Plus size={20} /> New Roster
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-[#5B5FFF] flex items-center justify-center"><Users size={18} /></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Athletes</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{totalAthletes}</div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center"><Activity size={18} /></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Health</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-500">{healthScore}%</div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-600 flex items-center justify-center"><Clock size={18} /></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Saved</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{timeSavedHours} <span className="text-xs text-gray-400">h</span></div>
        </div>
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-[#5B5FFF] flex items-center justify-center"><Zap size={18} /></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Usage</span>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{creditsUsed}<span className="text-xs text-gray-400 font-bold">/{tierLimit}</span></div>
        </div>
      </div>

      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input type="text" placeholder="Search library..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-12 pr-6 py-4 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg outline-none focus:ring-2 focus:ring-[#5B5FFF]/10 transition-all text-sm font-medium shadow-sm" />
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

      {/* Assemblies Section */}
      <div>
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.25em] mb-4 font-mono ml-1">Assemblies</h3>
        {!isLoading && filteredRosters.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <FolderOpen size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-widest">Empty Library</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRosters.map(roster => {
              const primaryColor = roster.teamMetadata?.primaryColor || '#5B5FFF';
              return (
                <div key={roster.id} onClick={() => onSelectRoster(roster.id)} className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 cursor-pointer hover:shadow-lg hover:scale-[1.01] transition-all relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: primaryColor }}></div>
                  <div className="flex justify-between items-start mb-4">
                    <TeamLogo url={roster.teamMetadata?.logoUrl} name={roster.teamName} abbreviation={roster.teamMetadata?.abbreviation} primaryColor={primaryColor} size="md" />
                    <div className="flex gap-1 relative z-10">
                      <button onClick={(e) => { e.stopPropagation(); setMovingRosterId(roster.id); }} className="p-1.5 text-gray-300 hover:text-[#5B5FFF] opacity-0 group-hover:opacity-100"><Move size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleQuickDeleteRoster(e, roster); }} className="p-1.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-extrabold text-gray-900 dark:text-white truncate pr-1">{roster.teamName || 'Unnamed'}</h3>
                    {roster.isNocMode && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest">NOC</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[9px] font-black text-[#5B5FFF] bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/10 px-2 py-0.5 rounded-lg uppercase tracking-widest">{roster.sport || 'General'}</span>
                    {roster.league && (
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-lg uppercase tracking-widest">{roster.league}</span>
                    )}
                    <span className="text-[10px] font-bold text-gray-400 font-mono">{roster.seasonYear}</span>
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
        )}
      </div>
    </div>
  );

  function handleQuickDeleteRoster(e: React.MouseEvent, roster: Roster) {
    e.preventDefault(); e.stopPropagation();
    if (window.confirm(`Delete ${roster.teamName}?`)) { onDeleteRoster(roster.id); }
  }
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
