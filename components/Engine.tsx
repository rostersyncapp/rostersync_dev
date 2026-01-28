import React, { useState, useEffect } from 'react';
import { Athlete, SubscriptionTier, Roster, ExportFormat, Project } from '../types.ts';
import { ProcessedRoster } from '../services/gemini.ts';
import { TeamSelectionModal } from './TeamSelectionModal';
import { generateExport, downloadFile } from '../services/export.ts';
import {
  Upload,
  Cpu,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Table,
  Download,
  Save,
  Loader2,
  X,
  Sparkles,
  Edit2,
  UserMinus,
  Calendar,
  Users,
  Globe,
  ExternalLink,
  Palette,
  Flag,
  Zap,
  FolderOpen,
  Image,
  Type as TypeIcon,
  Hash,
  Trophy,
  Search,
  Check
} from 'lucide-react';

interface Props {
  userTier: SubscriptionTier;
  projects: Project[];
  creditsUsed: number;
  maxCredits: number;
  onSave: (roster: Roster) => void;
  onStartProcessing: (text: string, isNocMode: boolean, seasonYear: string, findBranding: boolean) => void;
  isProcessing: boolean;
  pendingRoster: ProcessedRoster | null;
  onClearPending: () => void;
  onDeletePlayer?: (athleteName: string) => void;
  initialText?: string;
}

export const Engine: React.FC<Props> = ({
  userTier,
  projects,
  creditsUsed,
  maxCredits,
  onSave,
  onStartProcessing,
  isProcessing,
  pendingRoster,
  onClearPending,
  onDeletePlayer,
  initialText = ''
}) => {
  const [step, setStep] = useState(1);
  const [rawInput, setRawInput] = useState(initialText);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isNocMode, setIsNocMode] = useState(false);
  const [showSeasonModal, setShowSeasonModal] = useState(false);
  const [manualTeamName, setManualTeamName] = useState('');

  // Metadata States
  const [teamName, setTeamName] = useState('');
  const [sport, setSport] = useState('');
  const [league, setLeague] = useState(''); // User-selected league
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear().toString());
  const [abbreviation, setAbbreviation] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#5B5FFF');
  const [secondaryColor, setSecondaryColor] = useState('#1A1A1A');
  const [logoUrl, setLogoUrl] = useState('');

  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [processedAthletes, setProcessedAthletes] = useState<Athlete[]>([]);

  // Team Selection Modal State
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [candidateTeams, setCandidateTeams] = useState<any[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (pendingRoster) {
      setStep(2);
      setTeamName(pendingRoster.teamName);
      setSport(pendingRoster.sport);
      setSeasonYear(pendingRoster.seasonYear);
      setAbbreviation(pendingRoster.teamMetadata?.abbreviation || 'UNK');
      setPrimaryColor(pendingRoster.teamMetadata?.primaryColor || '#5B5FFF');
      setSecondaryColor(pendingRoster.teamMetadata?.secondaryColor || '#1A1A1A');
      setLogoUrl(pendingRoster.teamMetadata?.logoUrl || '');
      setProcessedAthletes(pendingRoster.athletes);
      setIsNocMode(pendingRoster.isNocMode || false);

      // Check for ambiguous teams
      if (pendingRoster.candidateTeams && pendingRoster.candidateTeams.length > 1) {
        setCandidateTeams(pendingRoster.candidateTeams);
        setShowTeamSelection(true);
      }
    } else if (isProcessing) {
      setStep(1);
    }
  }, [pendingRoster, isProcessing]);

  const handleProcess = () => {
    if (!rawInput || isProcessing) return;
    setShowSeasonModal(false);
    // Prepend team name to raw input if provided (helps AI identification)
    const inputWithTeam = manualTeamName.trim()
      ? `Team: ${manualTeamName.trim()}\n\n${rawInput}`
      : rawInput;
    onStartProcessing(inputWithTeam, isNocMode, seasonYear, true);
  };

  const handleSaveToLibrary = () => {
    console.log('[Engine] handleSaveToLibrary called - current sport state:', sport);
    setIsSaving(true);
    const newRoster: Roster = {
      id: Math.random().toString(36).substr(2, 9),
      userId: '1',
      projectId: selectedProjectId || undefined,
      teamName,
      sport,
      league: league || undefined, // Include user-selected league
      seasonYear,
      isNocMode,
      athleteCount: processedAthletes.length,
      rosterData: processedAthletes,
      versionDescription: `[${seasonYear}] ${teamName} - ${processedAthletes.length} Athletes`,
      createdAt: new Date().toISOString(),
      teamMetadata: {
        primaryColor,
        secondaryColor,
        abbreviation,
        conference: pendingRoster?.teamMetadata?.conference || 'General',
        logoUrl,
        countryCode: pendingRoster?.teamMetadata?.countryCode
      }
    };

    console.log('[Engine] Roster being saved:', { teamName: newRoster.teamName, sport: newRoster.sport, league: newRoster.league });

    setTimeout(() => {
      onSave(newRoster);
      setIsSaving(false);
    }, 800);
  };

  const handleDeletePlayer = (athleteName: string) => {
    setProcessedAthletes(prev => prev.filter(a => a.fullName !== athleteName));
    onDeletePlayer?.(athleteName);
  };

  const handleTeamSelected = (team: any) => {
    console.log('[Engine] Team selected from modal:', team);
    console.log('[Engine] Sport metadata:', team.sport, 'League:', team.league);
    setTeamName(team.name);
    setLogoUrl(team.logoUrl);
    setPrimaryColor(team.primaryColor);
    setSecondaryColor(team.secondaryColor);
    // Preserve sport metadata (league is shown in UI but not stored separately)
    if (team.sport) {
      console.log('[Engine] Setting sport to:', team.sport);
      setSport(team.sport);
    }
    setShowTeamSelection(false);
  };

  const hasCredits = creditsUsed < maxCredits;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="relative mb-12">
        <div className="absolute top-1/2 left-0 w-full h-px bg-gray-100 dark:bg-gray-800 -translate-y-1/2 -z-10"></div>
        <div className="grid grid-cols-3">
          {[
            { num: 1, label: 'Upload' },
            { num: 2, label: 'Review' },
            { num: 3, label: 'Export' }
          ].map((s, idx) => (
            <div key={s.num} className={`bg-[#FAFAFA] dark:bg-gray-950 px-6 w-fit ${idx === 0 ? 'justify-self-start' : idx === 1 ? 'justify-self-center' : 'justify-self-end'}`}>
              <div className={`flex items-center gap-4 ${step >= s.num ? 'text-[#5B5FFF]' : 'text-gray-400 dark:text-gray-600'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= s.num ? 'border-[#5B5FFF] bg-[#5B5FFF] text-white shadow-lg shadow-[#5B5FFF]/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'}`}>
                  {step > s.num ? <CheckCircle2 size={20} /> : <span className="text-sm">{s.num}</span>}
                </div>
                <span className="text-sm font-black uppercase tracking-[0.2em]">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-10 animate-in fade-in duration-500">
          <div className="bg-white dark:bg-gray-900 p-10 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
              <h2 className="text-3xl font-extrabold flex items-center gap-4 tracking-tight text-gray-900 dark:text-white shrink-0"><Upload size={32} className="text-[#5B5FFF]" /> Input Raw Data</h2>
              <div className="flex flex-wrap items-center gap-4">
                <div className={`px-5 py-3 rounded-2xl flex items-center gap-3 border ${hasCredits ? 'bg-[#5B5FFF]/5 border-[#5B5FFF]/20 text-[#5B5FFF]' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  <Zap size={18} className={hasCredits ? "fill-[#5B5FFF]" : "fill-red-600"} />
                  <span className="text-sm font-bold tracking-tight uppercase">{maxCredits - creditsUsed} Credits</span>
                </div>
              </div>
            </div>
            <textarea className={`w-full h-96 px-6 py-6 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl outline-none transition-all text-base leading-relaxed font-mono text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 ${isProcessing ? 'opacity-50 pointer-events-none' : 'focus:ring-2 focus:ring-[#5B5FFF]/20'}`} placeholder="Help me, Obi-Wan Kenobi. You're my only hope... to paste this data" value={rawInput} onChange={(e) => setRawInput(e.target.value)} />
            <div className="flex items-center gap-4 mt-4 justify-end">
              <button
                onClick={() => setShowSeasonModal(true)}
                disabled={isProcessing || !rawInput || !hasCredits}
                className={`px-8 py-4 rounded-xl font-bold flex items-center gap-3 shadow-lg transition-all text-base uppercase tracking-widest ${hasCredits ? 'primary-gradient text-white shadow-[#5B5FFF]/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
              >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Cpu size={20} />} {isProcessing ? 'Processing...' : 'Run Engine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSeasonModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-300 border border-gray-100 dark:border-gray-800">
            <button onClick={() => setShowSeasonModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"><X size={24} /></button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-[#5B5FFF]/10 text-[#5B5FFF] flex items-center justify-center mx-auto mb-4">
                <Calendar size={32} />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">Processing Options</h3>
              <p className="text-sm text-gray-500 font-medium mt-2">Specify season and team details</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Trophy size={12} /> Team Name <span className="text-gray-300 dark:text-gray-600">(optional)</span>
                </label>
                <input
                  autoFocus
                  type="text"
                  value={manualTeamName}
                  onChange={(e) => setManualTeamName(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20"
                  placeholder="e.g. Sacramento Republic FC"
                />
                <p className="text-[10px] text-gray-400 mt-1">Helps identify branding if not in the pasted data</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Trophy size={12} /> League <span className="text-gray-300 dark:text-gray-600">(optional)</span>
                </label>
                <select
                  value={league}
                  onChange={(e) => {
                    const selectedLeague = e.target.value;
                    setLeague(selectedLeague);

                    // Auto-set sport based on league
                    const leagueToSport: Record<string, string> = {
                      'nba': 'NBA', 'wnba': 'WNBA', 'ncaa-basketball': 'NCAA Basketball', 'euroleague': 'EuroLeague',
                      'nfl': 'NFL', 'ncaa-football': 'NCAA Football', 'cfl': 'CFL',
                      'premier-league': 'Premier League', 'la-liga': 'La Liga', 'serie-a': 'Serie A',
                      'bundesliga': 'Bundesliga', 'ligue-1': 'Ligue 1', 'mls': 'MLS', 'liga-mx': 'Liga MX',
                      'eredivisie': 'Eredivisie', 'usl': 'USL Championship',
                      'ipl': 'IPL', 'bbl': 'Big Bash League', 'the-hundred': 'The Hundred', 'cpl': 'Caribbean Premier League',
                      'nhl': 'NHL', 'ahl': 'AHL',
                      'mlb': 'MLB', 'milb': 'Minor League Baseball',
                      'f1': 'Formula 1', 'nascar': 'NASCAR', 'indycar': 'IndyCar'
                    };

                    if (selectedLeague && leagueToSport[selectedLeague]) {
                      setSport(leagueToSport[selectedLeague]);
                    } else if (!selectedLeague) {
                      setSport(''); // Reset sport if auto-detect
                    }
                  }}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20"
                >
                  <option value="">Auto-detect from team name</option>
                  <optgroup label="🏀 Basketball">
                    <option value="nba">NBA</option>
                    <option value="wnba">WNBA</option>
                    <option value="ncaa-basketball">NCAA Basketball</option>
                    <option value="euroleague">EuroLeague</option>
                  </optgroup>
                  <optgroup label="🏈 Football (American)">
                    <option value="nfl">NFL</option>
                    <option value="ncaa-football">NCAA Football</option>
                    <option value="cfl">CFL</option>
                  </optgroup>
                  <optgroup label="⚽ Soccer">
                    <option value="premier-league">Premier League</option>
                    <option value="la-liga">La Liga</option>
                    <option value="serie-a">Serie A</option>
                    <option value="bundesliga">Bundesliga</option>
                    <option value="ligue-1">Ligue 1</option>
                    <option value="mls">MLS</option>
                    <option value="liga-mx">Liga MX</option>
                    <option value="eredivisie">Eredivisie</option>
                    <option value="usl">USL Championship</option>
                  </optgroup>
                  <optgroup label="🏏 Cricket">
                    <option value="ipl">IPL</option>
                    <option value="bbl">Big Bash League</option>
                    <option value="the-hundred">The Hundred</option>
                    <option value="cpl">Caribbean Premier League</option>
                  </optgroup>
                  <optgroup label="🏒 Hockey">
                    <option value="nhl">NHL</option>
                    <option value="ahl">AHL</option>
                  </optgroup>
                  <optgroup label="⚾ Baseball">
                    <option value="mlb">MLB</option>
                    <option value="milb">Minor League Baseball</option>
                  </optgroup>
                  <optgroup label="🏎️ Racing">
                    <option value="f1">Formula 1</option>
                    <option value="nascar">NASCAR</option>
                    <option value="indycar">IndyCar</option>
                  </optgroup>
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Selecting a league reduces AI processing costs by ~80%</p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Calendar size={12} /> Season Year
                </label>
                <input
                  type="text"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(e.target.value)}
                  className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-lg font-bold outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 text-center"
                  placeholder="e.g. 2025"
                  onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
                />
              </div>

              <button
                onClick={handleProcess}
                className="w-full py-4 rounded-xl primary-gradient text-white font-bold text-base shadow-lg shadow-[#5B5FFF]/20 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Cpu size={20} /> Confirm & Process
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ambiguous Team Selection Modal */}
      <TeamSelectionModal
        isOpen={showTeamSelection}
        candidates={candidateTeams}
        onSelect={handleTeamSelected}
        onClose={() => setShowTeamSelection(false)}
      />


      {
        step === 2 && (
          <div className="space-y-10 animate-in slide-in-from-right-4 duration-500 pb-24">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-10 border-b border-gray-100 dark:border-gray-800 flex flex-col md:flex-row md:items-start justify-between bg-gray-50/30 dark:bg-gray-800/30 gap-10">
                <div className="flex-1 flex flex-col md:flex-row gap-6">
                  <div className="w-24 h-24 rounded-3xl text-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden relative group bg-white border border-gray-100 dark:border-gray-700">
                    {logoUrl ? (
                      <img src={logoUrl} alt={teamName} className="w-full h-full object-contain p-3" onError={() => setLogoUrl('')} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-mono font-black text-3xl" style={{ backgroundColor: primaryColor }}>
                        {abbreviation || '??'}
                      </div>
                    )}
                    <button onClick={() => setIsEditingMetadata(!isEditingMetadata)} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Edit2 size={24} />
                    </button>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-4 flex-wrap">
                      <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">{teamName}</h2>
                      <span className="px-4 py-1.5 bg-[#5B5FFF]/10 text-[#5B5FFF] rounded-xl text-xs font-black uppercase tracking-[0.2em]">{sport}</span>
                    </div>
                    <div className="flex items-center gap-5 mt-3 text-gray-500 dark:text-gray-400 text-base font-medium">
                      <span className="flex items-center gap-2 font-bold text-gray-900 dark:text-white"><Calendar size={20} /> {seasonYear}</span>
                      <span className="flex items-center gap-2"><Users size={20} /> {processedAthletes.length} Athletes</span>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <button onClick={() => setIsEditingMetadata(!isEditingMetadata)} className="text-sm font-bold text-[#5B5FFF] hover:underline flex items-center gap-2">
                        <Palette size={18} /> Branding Controls
                      </button>
                      {pendingRoster?.verificationSources && pendingRoster.verificationSources.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-mono">Verified by AI Search:</span>
                          <div className="flex gap-1.5">
                            {pendingRoster.verificationSources.slice(0, 2).map((src, i) => (
                              <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-400 hover:text-[#5B5FFF] transition-colors" title={src.title}>
                                <ExternalLink size={14} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-5 min-w-[280px]">
                  <div className="space-y-2.5">
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Assign Project</label>
                    <div className="relative">
                      <FolderOpen className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="pl-12 pr-6 py-3.5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 text-gray-900 dark:text-white cursor-pointer w-full"
                      >
                        <option value="">Unassigned (Library)</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <button onClick={handleSaveToLibrary} disabled={isSaving} className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl primary-gradient text-white font-bold text-sm hover:shadow-lg shadow-[#5B5FFF]/20 transition-all uppercase tracking-widest">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save to Library
                  </button>
                </div>
              </div>

              {isEditingMetadata && (
                <div className="p-10 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-400 font-mono">Metadata Overrides</h3>
                    <button onClick={() => setIsEditingMetadata(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2"><TypeIcon size={14} /> Team Name</label>
                      <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full px-5 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-base font-semibold outline-none focus:ring-2 focus:ring-[#5B5FFF]/20" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2"><Calendar size={14} /> Season</label>
                      <input type="text" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} className="w-full px-5 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-base font-bold outline-none focus:ring-2 focus:ring-[#5B5FFF]/20" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2"><Palette size={14} /> Colors</label>
                      <div className="flex gap-3">
                        <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-12 rounded-2xl border-none cursor-pointer bg-transparent" />
                        <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-full h-12 rounded-2xl border-none cursor-pointer bg-transparent" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2"><Image size={14} /> Logo URL</label>
                      <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full px-5 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20" placeholder="URL..." />
                    </div>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto max-h-[50vh]">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
                      <th className="px-4 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center border-b border-gray-100 dark:border-gray-800 w-12">#</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] border-b border-gray-100 dark:border-gray-800">Athlete Name</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center border-b border-gray-100 dark:border-gray-800">{isNocMode ? 'Bib' : 'Jersey'}</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center border-b border-gray-100 dark:border-gray-800">{isNocMode ? 'Event/Discipline' : 'Position'}</th>
                      <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center border-b border-gray-100 dark:border-gray-800">Hardware Safe</th>
                      {onDeletePlayer && <th className="px-6 py-5 text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] text-center border-b border-gray-100 dark:border-gray-800 w-20"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {processedAthletes.map((a, idx) => (
                      <tr key={a.id || idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
                        <td className="px-4 py-5 text-center text-sm font-medium text-gray-400 dark:text-gray-500">{idx + 1}</td>
                        <td className="px-6 py-5 text-base font-semibold text-gray-900 dark:text-white">{a.fullName}</td>
                        <td className="px-6 py-5 text-center"><span className="inline-block w-12 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold">{a.jerseyNumber.toString().replace(/#/g, '')}</span></td>
                        <td className="px-6 py-5 text-center"><span className="inline-block px-4 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[11px] font-bold uppercase">{a.position.toString().replace(/#/g, '')}</span></td>
                        <td className="px-6 py-5 text-center"><span className="bg-emerald-50 dark:bg-emerald-900/30 px-4 py-1.5 rounded-xl text-[11px] font-bold text-emerald-700 dark:text-emerald-400 tracking-wider font-mono">{a.displayNameSafe}</span></td>
                        {onDeletePlayer && (
                          <td className="px-6 py-5 text-center">
                            <button
                              onClick={() => handleDeletePlayer(a.fullName)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove player"
                            >
                              <UserMinus size={16} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Engine;