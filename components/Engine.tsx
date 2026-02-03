import React, { useState, useEffect } from 'react';
import { Athlete, SubscriptionTier, Roster, ExportFormat, Project } from '../types.ts';
import { ProcessedRoster } from '../services/gemini.ts';
import { TeamSelectionModal } from './TeamSelectionModal';

import {
  Upload,
  Cpu,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  ChevronDown,
  Table,

  Save,
  Loader2,
  X,
  Sparkles,
  Trophy,
  Edit2,
  UserMinus,
  Calendar,
  Users,

  ExternalLink,
  Palette,
  Flag,
  Zap,
  FolderOpen,
  Image,
  Type as TypeIcon,
  Hash,
  Search,
  Check,
  Terminal,
  Code2,

  ArrowRight
} from 'lucide-react';

interface Props {
  userTier: SubscriptionTier;
  projects: Project[];
  creditsUsed: number;
  maxCredits: number;
  onSave: (roster: Roster) => void;
  onStartProcessing: (text: string, isNocMode: boolean, seasonYear: string, findBranding: boolean, league?: string) => void;
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
  const [isLeagueDropdownOpen, setIsLeagueDropdownOpen] = useState(false);
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

  // Terminal Logic
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const PROCESSING_LOGS = [
    "> INITIALIZING_NEURAL_NETWORKS...",
    "> LOADING_CONTEXT_MODELS...",
    "> TOKENIZING_INPUT_STREAM [Batch Size: 128]...",
    "> DETECTING_ENTITIES [Confidence: 94%]",
    "> CONNECTING_TO_KNOWLEDGE_BASE...",
    "> SEARCHING_GLOBAL_INDICES...",
    "> EXTRACTING_ROSTER_METADATA...",
    "> NORMALIZING_PLAYER_NAMES...",
    "> INFERRING_JERSEY_NUMBERS...",
    "> VALIDATING_SPORT_SPECIFIC_CONTEXT...",
    "> OPTIMIZING_FOR_BROADCAST_OUTPUT...",
    "> FINALIZING_OUTPUT_BUFFER..."
  ];

  const TIPS = [
    "Tip: RosterSync interprets 100+ formats without manual mapping.",
    "Did you know? You can paste raw HTML directly from team websites.",
    "Pro Tip: Selecting the correct League boosts accuracy by 45%.",
    "Fact: This engine processes rosters 600x faster than humans.",
    "Suggestion: Use 'NOC Mode' for Olympic/International events."
  ];

  useEffect(() => {
    if (isProcessing) {
      setTerminalLogs([]);
      let logIndex = 0;

      const logInterval = setInterval(() => {
        if (logIndex < PROCESSING_LOGS.length) {
          setTerminalLogs(prev => [...prev, PROCESSING_LOGS[logIndex]]);
          logIndex++;
          // Randomize speed for realism
        }
      }, 800);

      const tipInterval = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % TIPS.length);
      }, 4000);

      return () => {
        clearInterval(logInterval);
        clearInterval(tipInterval);
      };
    } else {
      setTerminalLogs([]);
    }
  }, [isProcessing]);

  useEffect(() => {
    if (pendingRoster) {
      setStep(2);
      setTeamName(pendingRoster.teamName);
      setSport(pendingRoster.sport);
      setLeague(pendingRoster.league || '');
      setSeasonYear(pendingRoster.seasonYear);
      setAbbreviation(pendingRoster.teamMetadata?.abbreviation || 'UNK');
      setPrimaryColor(pendingRoster.teamMetadata?.primaryColor || '#5B5FFF');
      setSecondaryColor(pendingRoster.teamMetadata?.secondaryColor || '#1A1A1A');
      const safeLogo = pendingRoster.teamMetadata?.logoUrl === 'Unknown' ? '' : pendingRoster.teamMetadata?.logoUrl || '';
      setLogoUrl(safeLogo);
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

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.league-dropdown-container')) {
        setIsLeagueDropdownOpen(false);
      }
    };

    if (isLeagueDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLeagueDropdownOpen]);

  const LEAGUE_OPTIONS = [
    {
      category: "🏀 Basketball",
      options: [
        { value: "euroleague", label: "EuroLeague" },
        { value: "nba", label: "NBA" },
        { value: "wnba", label: "WNBA" }
      ]
    },
    {
      category: "🏈 Football (American)",
      options: [
        { value: "nfl", label: "NFL" }
      ]
    },
    {
      category: "⚽ Soccer",
      options: [
        { value: "bundesliga", label: "Bundesliga" },
        { value: "efl-championship", label: "EFL Championship" },
        { value: "eredivisie", label: "Eredivisie" },
        { value: "la-liga", label: "La Liga" },
        { value: "liga-mx", label: "Liga MX" },
        { value: "ligue-1", label: "Ligue 1" },
        { value: "mls", label: "MLS" },
        { value: "nwsl", label: "NWSL" },
        { value: "premier-league", label: "Premier League" },
        { value: "scottish-premiership", label: "Scottish Premiership" },
        { value: "serie-a", label: "Serie A" },
        { value: "usl", label: "USL Championship" },
        { value: "wsl", label: "Women's Super League (WSL)" }
      ]
    },
    {
      category: "🏏 Cricket",
      options: [
        { value: "ipl", label: "IPL" }
      ]
    },
    {
      category: "🏒 Hockey",
      options: [
        { value: "nhl", label: "NHL" }
      ]
    },
    {
      category: "⚾ Baseball",
      options: [
        { value: "milb", label: "MiLB" },
        { value: "mlb", label: "MLB" }
      ]
    }
  ];

  const getLeagueLabel = (value: string) => {
    for (const group of LEAGUE_OPTIONS) {
      const found = group.options.find(opt => opt.value === value);
      if (found) return found.label;
    }
    return value || 'Select League';
  };

  const handleLeagueSelect = (selectedLeague: string) => {
    setLeague(selectedLeague);
    setIsLeagueDropdownOpen(false);

    // Auto-set sport based on league
    const leagueToSport: Record<string, string> = {
      'nba': 'Basketball', 'wnba': 'Basketball', 'euroleague': 'Basketball',
      'nfl': 'Football',
      'premier-league': 'Soccer', 'la-liga': 'Soccer', 'serie-a': 'Soccer',
      'bundesliga': 'Soccer', 'ligue-1': 'Soccer', 'mls': 'Soccer', 'nwsl': 'Soccer', 'liga-mx': 'Soccer',
      'eredivisie': 'Soccer', 'usl': 'Soccer',
      'ipl': 'Cricket',
      'nhl': 'Hockey',
      'mlb': 'Baseball',
      'milb': 'Baseball'
    };

    if (selectedLeague && leagueToSport[selectedLeague]) {
      setSport(leagueToSport[selectedLeague]);
    } else if (!selectedLeague) {
      setSport('');
    }
  };

  const handleProcess = () => {
    if (!rawInput || isProcessing) return;
    setShowSeasonModal(false);
    // Prepend team name to raw input if provided (helps AI identification)
    const inputWithTeam = manualTeamName.trim()
      ? `Team: ${manualTeamName.trim()}\n\n${rawInput}`
      : rawInput;
    onStartProcessing(inputWithTeam, isNocMode, seasonYear, true, league);
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
    if (team.league) {
      setLeague(team.league);
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
            {isProcessing ? (
              <div className="w-full h-96 bg-white dark:bg-gray-950 rounded-2xl p-6 font-mono text-sm relative overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 shadow-inner">
                {/* Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px] pointer-events-none opacity-5 dark:opacity-20"></div>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-4 z-10">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-bold uppercase tracking-widest text-xs">
                    <Terminal size={14} />
                    <span>Live Processing Node: 0xA4F...92</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>
                </div>

                {/* Logs */}
                <div className="flex-1 overflow-y-auto space-y-2 z-10 custom-scrollbar pb-10">
                  {terminalLogs.map((log, i) => (
                    <div key={i} className="text-emerald-600/80 dark:text-emerald-500/80 font-medium animate-in slide-in-from-left-2 duration-300">
                      {log}
                    </div>
                  ))}
                  <div className="text-emerald-600 dark:text-emerald-500 animate-pulse">_</div>
                </div>

              </div>
            ) : (
              <textarea className={`w-full h-96 px-6 py-6 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl outline-none transition-all text-base leading-relaxed font-mono text-gray-900 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:ring-2 focus:ring-[#5B5FFF]/20`} value={rawInput} onChange={(e) => setRawInput(e.target.value)} placeholder="Paste raw roster text here..." />
            )}
            <div className="flex items-center justify-between mt-8 gap-4">
              <div className="flex-1 flex justify-center">
                {isProcessing && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-5 py-2 flex items-center gap-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <Sparkles size={14} className="text-[#5B5FFF]" />
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 tracking-wide">{TIPS[currentTipIndex]}</span>
                  </div>
                )}
              </div>
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

            <div className="space-y-7">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Trophy size={12} /> League <span className="text-[#5B5FFF]">*</span>
                </label>
                <div className="relative league-dropdown-container">
                  <button
                    onClick={() => setIsLeagueDropdownOpen(!isLeagueDropdownOpen)}
                    className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 text-gray-900 dark:text-white flex items-center justify-between"
                  >
                    <span className={!league ? "text-gray-500" : ""}>{getLeagueLabel(league)}</span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isLeagueDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isLeagueDropdownOpen && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
                      <div className="py-2">
                        <button
                          onClick={() => handleLeagueSelect("")}
                          className="w-full text-left px-5 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500"
                        >
                          Select League
                        </button>
                        {LEAGUE_OPTIONS.map((group, groupIdx) => (
                          <div key={groupIdx}>
                            <div className="px-5 py-2 text-xs font-extrabold uppercase tracking-widest text-[#5B5FFF] bg-gray-50/50 dark:bg-gray-900/50 mt-1 first:mt-0">
                              {group.category}
                            </div>
                            {group.options.map((option) => (
                              <button
                                key={option.value}
                                onClick={() => handleLeagueSelect(option.value)}
                                className={`w-full text-left px-5 py-2.5 transition-colors text-sm font-medium ${league === option.value ? 'bg-[#5B5FFF]/10 text-[#5B5FFF]' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Calendar size={12} /> Season Year
                </label>
                <input
                  type="text"
                  value={seasonYear}
                  onChange={(e) => setSeasonYear(e.target.value)}
                  className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20"
                  onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Trophy size={12} /> Team Name <span className="text-gray-300 dark:text-gray-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={manualTeamName}
                  onChange={(e) => setManualTeamName(e.target.value)}
                  className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 flex items-center"
                />
              </div>
            </div>

            <button
              onClick={handleProcess}
              disabled={!league}
              className={`w-full mt-8 h-14 rounded-xl font-bold text-base shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${league ? 'primary-gradient text-white shadow-[#5B5FFF]/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}
            >
              <Cpu size={20} /> Confirm & Process
            </button>
          </div>
        </div>
      )
      }

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
                    {logoUrl && logoUrl !== 'Unknown' ? (
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
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        <input
                          type="text"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                          className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-[#5B5FFF] outline-none transition-all w-full placeholder:text-gray-300"
                          placeholder="Team Name"
                        />
                        <Edit2 size={16} className="text-gray-400 shrink-0" />
                      </div>
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
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest font-mono">Export/Sync</label>
                    <div className="flex flex-col gap-3">
                      <button onClick={handleSaveToLibrary} disabled={isSaving} className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl primary-gradient text-white font-bold text-sm hover:shadow-lg shadow-[#5B5FFF]/20 transition-all uppercase tracking-widest">
                        {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save to Library
                      </button>


                    </div>
                  </div>
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