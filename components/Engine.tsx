import React, { useState, useEffect, useMemo } from 'react';
import { Athlete, SubscriptionTier, Roster, ExportFormat, Project } from '../types.ts';
import { ProcessedRoster } from '../services/gemini.ts';
import { getLeagues, getConferences, getTeams } from '../services/supabase.ts';
import { ESPN_TEAM_IDS, DB_LEAGUE_TO_ESPN_LEAGUE } from '../services/teamData.ts';
import { TeamSelectionModal } from './TeamSelectionModal';
import { motion, AnimatePresence } from 'framer-motion';
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
  Bot,
  Check,
  Terminal,
  Code2,
  ArrowRight,
  Info,
  History,
  Activity,
  ZapOff,
  Search,
  UserPlus
} from 'lucide-react';

const MissingPlayersModal = ({
  isOpen,
  pastedCount,
  officialCount,
  missingCount,
  onKeep,
  onAdd
}: {
  isOpen: boolean;
  pastedCount: number;
  officialCount: number;
  missingCount: number;
  onKeep: () => void;
  onAdd: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300 border border-gray-100 dark:border-gray-800">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Incomplete Roster Detected</h3>
          <p className="text-sm text-gray-500 mt-2">
            You pasted <strong className="text-gray-900 dark:text-gray-200">{pastedCount} players</strong>, but the official roster has <strong className="text-gray-900 dark:text-gray-200">{officialCount}</strong>.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-8 border border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm font-medium mb-1">
            <span className="text-gray-500">Missing Players</span>
            <span className="text-amber-600 font-bold">+{missingCount} Found</span>
          </div>
          <p className="text-xs text-gray-400">
            We found {missingCount} additional active players from the official source. Would you like to add them?
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onKeep}
            className="flex-1 h-12 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Keep My {pastedCount}
          </button>
          <button
            onClick={onAdd}
            className="flex-1 h-12 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Add {missingCount} Players
          </button>
        </div>
      </div>
    </div>
  );
};

interface Props {
  userTier: SubscriptionTier;
  projects: Project[];
  creditsUsed: number;
  maxCredits: number;
  onSave: (roster: Roster) => void;
  onStartProcessing: (text: string, seasonYear: string, findBranding: boolean, league?: string) => void;
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

  // Dynamic League Data State
  const [availableLeagues, setAvailableLeagues] = useState<any[]>([]);
  const [availableConferences, setAvailableConferences] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);

  // NCAA Specific State
  const [ncaaSport, setNcaaSport] = useState<string>('Football');
  const [ncaaDivision, setNcaaDivision] = useState<string>('Division I');
  const [ncaaConference, setNcaaConference] = useState<string>('');
  const [ncaaTeamId, setNcaaTeamId] = useState<string>('');

  useEffect(() => {
    // Fetch supported leagues on mount
    getLeagues().then(data => {
      // Filter for NA region if needed, but the table should mostly be NA now
      setAvailableLeagues(data);
    });
  }, []);

  useEffect(() => {
    // Fetch conferences when NCAA is selected or division changes
    if (league === 'ncaa') {
      getConferences('ncaa', ncaaDivision).then(data => setAvailableConferences(data));
    }
  }, [league, ncaaDivision]);

  // Fetch NCAA Teams when Conference Changes
  useEffect(() => {
    async function fetchTeams() {
      if (league === 'ncaa' && ncaaConference && availableConferences.length > 0) {
        // Find conference ID
        const conf = availableConferences.find(c => c.name === ncaaConference);
        if (conf) {
          const teams = await getTeams(conf.id);
          setAvailableTeams(teams);
        } else {
          setAvailableTeams([]);
        }
      } else if (league !== 'ncaa') {
        setAvailableTeams([]);
      }
    }
    fetchTeams();
  }, [league, ncaaConference, availableConferences]);

  // Fetch Teams for Non-NCAA Leagues from ESPN_TEAM_IDS
  useEffect(() => {
    if (league && league !== 'ncaa') {
      const espnLeagueCode = DB_LEAGUE_TO_ESPN_LEAGUE[league] || league;
      // Normalize by removing 'usa.' prefix if present, to match how ESPN_TEAM_IDS might be stored inconsistently
      // checking 'usa.1' against 'usa.1' is best.

      const leagueTeams = Object.entries(ESPN_TEAM_IDS)
        .filter(([_, info]) => {
          // Direct match first
          if (info.league === espnLeagueCode) return true;

          // Fallback: normalized match (handle usa. prefix)
          const normInfo = (info.league || '').replace(/^usa\./, '');
          const normInput = espnLeagueCode.replace(/^usa\./, '');
          return normInfo === normInput;
        })
        .map(([name, info]) => ({
          id: info.id,
          name: name,
          logo_url: info.logoUrl,
          primary_color: info.primaryColor,
          secondary_color: info.secondaryColor
        }));
      console.log(`[Engine] Populated ${leagueTeams.length} teams for league: ${league} (ESPN: ${espnLeagueCode})`);
      setAvailableTeams(leagueTeams);
    }
  }, [league]);

  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [processedAthletes, setProcessedAthletes] = useState<Athlete[]>([]);

  // Team Selection Modal State
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [candidateTeams, setCandidateTeams] = useState<any[]>([]);

  // Missing Players Modal State
  const [showMissingPlayersModal, setShowMissingPlayersModal] = useState(false);
  const [missingAthletesData, setMissingAthletesData] = useState<{
    pasted: number;
    official: number;
    missing: Athlete[];
  } | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Intelligence & History States
  const [scoutHistory, setScoutHistory] = useState<{ name: string, date: string, count: number }[]>([]);
  const [inputQuality, setInputQuality] = useState(0); // 0 to 100
  const [detections, setDetections] = useState<string[]>([]);


  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('scout_history');
    if (saved) setScoutHistory(JSON.parse(saved));
  }, []);

  // Update input quality and detections as user types
  useEffect(() => {
    if (!rawInput) {
      setInputQuality(0);
      setDetections([]);
      return;
    }

    const lines = rawInput.split('\n');
    let quality = Math.min(lines.length * 2, 40); // Base quality on length
    const detected: string[] = [];

    const keywords = ['name', 'pos', 'position', 'jersey', '#', 'ht', 'wt', 'class', 'hometown'];
    const hits = keywords.filter(k => rawInput.toLowerCase().includes(k)).length;
    quality += hits * 6;

    if (rawInput.length > 500) quality += 10;

    if (hits > 3) detected.push('Roster Pattern Detected');
    if (rawInput.includes('http')) detected.push('URL/Web Content');
    if (lines.length > 50) detected.push('High Volume Dataset');

    setInputQuality(Math.min(quality, 100));
    setDetections(detected);
  }, [rawInput]);

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
      const tipInterval = setInterval(() => {
        setCurrentTipIndex(prev => (prev + 1) % TIPS.length);
      }, 4000);

      return () => {
        clearInterval(tipInterval);
      };
    }
  }, [isProcessing]);

  useEffect(() => {
    if (pendingRoster) {
      setStep(2);
      setTeamName(pendingRoster.teamName);
      setSport(pendingRoster.sport);
      setLeague(pendingRoster.league || '');
      setSeasonYear(pendingRoster.seasonYear);
      const finalAbbr = pendingRoster.teamMetadata?.abbreviation || (pendingRoster as any).abbreviation || 'UNK';
      setAbbreviation(finalAbbr);
      setPrimaryColor(pendingRoster.teamMetadata?.primaryColor || '#5B5FFF');
      setSecondaryColor(pendingRoster.teamMetadata?.secondaryColor || '#1A1A1A');
      const safeLogo = pendingRoster.teamMetadata?.logoUrl === 'Unknown' ? '' : pendingRoster.teamMetadata?.logoUrl || '';
      setLogoUrl(safeLogo);
      setProcessedAthletes(pendingRoster.athletes);

      // Check for ambiguous teams
      if (pendingRoster.candidateTeams && pendingRoster.candidateTeams.length > 1) {
        setCandidateTeams(pendingRoster.candidateTeams);
        setShowTeamSelection(true);
      }
    } else if (isProcessing) {
      setStep(1);
    }
  }, [pendingRoster, isProcessing]);

  // Effect to Check for Missing Players when Pending Roster loads
  useEffect(() => {
    if (pendingRoster && pendingRoster.officialRosterCount && pendingRoster.missingAthletes && pendingRoster.missingAthletes.length > 0) {
      const pasted = pendingRoster.pastedRosterCount || pendingRoster.athletes.length;
      const official = pendingRoster.officialRosterCount;
      // Show if ANY players are missing (threshold > 0)
      if (official > pasted && pendingRoster.missingAthletes.length > 0) {
        setMissingAthletesData({
          pasted,
          official,
          missing: pendingRoster.missingAthletes
        });
        setShowMissingPlayersModal(true);
      }
    }
  }, [pendingRoster]);

  const handleAddMissingPlayers = () => {
    if (missingAthletesData && missingAthletesData.missing.length > 0) {
      setProcessedAthletes(prev => [...prev, ...missingAthletesData.missing]);
      setShowMissingPlayersModal(false);
    }
  };

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

  // Hardcoded map for grouping (since DB doesn't have sport column yet)
  const LEAGUE_SPORT_MAP: Record<string, { name: string, emoji: string }> = {
    nba: { name: 'Basketball', emoji: '🏀' },
    wnba: { name: 'Basketball', emoji: '🏀' },
    nfl: { name: 'Football', emoji: '🏈' },
    mlb: { name: 'Baseball', emoji: '⚾️' },
    milb: { name: 'Baseball', emoji: '⚾️' },
    nhl: { name: 'Hockey', emoji: '🏒' },
    mls: { name: 'Soccer', emoji: '⚽️' },
    nwsl: { name: 'Soccer', emoji: '⚽️' },
    usl: { name: 'Soccer', emoji: '⚽️' },
    'premier-league': { name: 'Soccer', emoji: '⚽️' },
    'la-liga': { name: 'Soccer', emoji: '⚽️' },
    'bundesliga': { name: 'Soccer', emoji: '⚽️' },
    'serie-a': { name: 'Soccer', emoji: '⚽️' },
    'ligue-1': { name: 'Soccer', emoji: '⚽️' },
    'eredivisie': { name: 'Soccer', emoji: '⚽️' },
    'liga-mx': { name: 'Soccer', emoji: '⚽️' },
    ncaa: { name: 'College Sports', emoji: '🎓' }
  };

  const getLeagueLabel = (value: string) => {
    const found = availableLeagues.find(l => l.id === value);
    if (found) {
      return (found.abbreviation || found.name).toUpperCase();
    }
    return (value || 'Select League').toUpperCase();
  };

  // Group available leagues by sport
  const groupedLeagues = useMemo(() => {
    const groups: Record<string, { label: string, emoji: string, options: any[] }> = {};
    availableLeagues.forEach(l => {
      const sportData = LEAGUE_SPORT_MAP[l.id] || { name: 'Other', emoji: '🏆' };
      if (!groups[sportData.name]) {
        groups[sportData.name] = { label: sportData.name, emoji: sportData.emoji, options: [] };
      }
      groups[sportData.name].options.push({ value: l.id, label: (l.abbreviation || l.name).toUpperCase() });
    });
    return Object.values(groups);
  }, [availableLeagues]);
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
      'milb': 'Baseball',
      'ncaa': ncaaSport // Default for NCAA
    };

    if (selectedLeague && leagueToSport[selectedLeague]) {
      setSport(leagueToSport[selectedLeague]);
    } else if (!selectedLeague) {
      setSport('');
    }

    // Populate teams for non-NCAA leagues from ESPN_TEAM_IDS
    if (selectedLeague && selectedLeague !== 'ncaa') {
      const espnLeagueCode = DB_LEAGUE_TO_ESPN_LEAGUE[selectedLeague] || selectedLeague;
      console.log(`[Engine] Populating teams for league: ${selectedLeague} (ESPN: ${espnLeagueCode})`);

      const leagueTeams = Object.entries(ESPN_TEAM_IDS)
        .filter(([_, info]) => {
          // Direct match first
          if (info.league === espnLeagueCode) return true;

          // Fallback: normalized match (handle usa. prefix)
          const normInfo = (info.league || '').replace(/^usa\./, '');
          const normInput = espnLeagueCode.replace(/^usa\./, '');
          return normInfo === normInput;
        })
        .map(([name, info]) => ({
          id: info.id,
          name: name,
          logo_url: info.logoUrl,
          primary_color: info.primaryColor,
          secondary_color: info.secondaryColor
        }));
      console.log(`[Engine] Teams populated: ${leagueTeams.length}`, leagueTeams.slice(0, 3));
      setAvailableTeams(leagueTeams);
    } else {
      console.log(`[Engine] Clearing availableTeams (NCAA or no league selected)`);
      setAvailableTeams([]);
    }
  };

  const handleProcess = () => {
    if (!rawInput || isProcessing) return;
    setShowSeasonModal(false);

    const finalSeason = seasonYear;
    const finalLeague = league;

    // Prepend team name and conference to raw input
    let promptPrefix = "";
    if (manualTeamName.trim()) promptPrefix += `Team: ${manualTeamName.trim()}\n`;
    if (league === 'ncaa' && ncaaConference) promptPrefix += `Conference: ${ncaaConference}\n`;

    const inputWithTeam = promptPrefix ? `${promptPrefix}\n${rawInput}` : rawInput;

    onStartProcessing(inputWithTeam, finalSeason, true, finalLeague, manualTeamName);
  };

  const handleStartScout = () => {
    setShowSeasonModal(true);
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
      rosterData: processedAthletes,
      athleteCount: processedAthletes.length,

      versionDescription: `[${seasonYear}] ${teamName} - ${processedAthletes.length} Athletes`,
      createdAt: new Date().toISOString(),
      teamMetadata: {
        primaryColor,
        secondaryColor,
        abbreviation,
        conference: (league === 'ncaa' && ncaaConference) ? ncaaConference : (pendingRoster?.teamMetadata?.conference || 'General'),
        logoUrl
      }
    };

    console.log('[Engine] Roster being saved:', { teamName: newRoster.teamName, sport: newRoster.sport, league: newRoster.league });

    setTimeout(() => {
      onSave(newRoster);

      // Update local history
      const historyItem = {
        name: newRoster.teamName,
        date: new Date().toLocaleDateString(),
        count: newRoster.athleteCount
      };
      const updatedHistory = [historyItem, ...scoutHistory.slice(0, 2)];
      setScoutHistory(updatedHistory);
      localStorage.setItem('scout_history', JSON.stringify(updatedHistory));

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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-4 gap-8"
        >
          {/* Main Input Area */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden relative group">
              {/* Scanning Overlay */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center"
                  >
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                        opacity: [0.5, 1, 0.5]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-24 h-24 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-8"
                    >
                      <Bot size={40} className="text-indigo-600 dark:text-indigo-400" />
                    </motion.div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI Roster Scouting...</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium max-w-xs mx-auto mb-8">
                      {TIPS[currentTipIndex]}
                    </p>

                    <div className="w-full max-w-xs h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "100%" }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="w-full h-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-8 pb-4 flex items-center justify-between border-b border-gray-50 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Roster Source</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Paste text, PDF content, or HTML</p>
                  </div>
                </div>

                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 border ${hasCredits ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400' : 'bg-red-50 border-red-200 text-red-600'}`}>
                  <Zap size={14} className={hasCredits ? "fill-current" : "fill-red-600"} />
                  <span className="text-xs font-black uppercase tracking-wider">{maxCredits - creditsUsed} Left</span>
                </div>
              </div>

              <textarea
                className="w-full h-[500px] px-8 py-6 bg-transparent border-none rounded-none outline-none transition-all text-base leading-relaxed font-mono text-gray-900 dark:text-gray-200 placeholder:text-gray-300 dark:placeholder:text-gray-700 resize-none focus:ring-0"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                placeholder="Paste your raw roster data here..."
              />

              <div className="p-6 bg-gray-50/50 dark:bg-gray-800/30 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">


                <button
                  onClick={handleStartScout}
                  disabled={isProcessing || !rawInput || !hasCredits}
                  className={`px-10 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-xl transition-all text-sm uppercase tracking-widest ${hasCredits && rawInput ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:scale-[1.02] active:scale-[0.98]' : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed shadow-none'}`}
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                  {isProcessing ? 'Scouting...' : 'Scout Roster'}
                </button>
              </div>
            </div>
          </div>

          {/* Intelligence Sidebar */}
          <div className="space-y-6 flex flex-col h-full">
            {/* Input Quality Card */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-6 text-gray-400 dark:text-gray-500">
                <Activity size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Live Intelligence</span>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Data Density</span>
                    <span className={`text-[10px] font-black ${inputQuality > 70 ? 'text-emerald-500' : inputQuality > 30 ? 'text-indigo-500' : 'text-gray-400'}`}>
                      {inputQuality}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${inputQuality}%` }}
                      className={`h-full ${inputQuality > 70 ? 'bg-emerald-500' : inputQuality > 30 ? 'bg-indigo-500' : 'bg-gray-400'}`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Detections</span>
                  {detections.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {detections.map((d, i) => (
                        <span key={i} className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded-md border border-indigo-100/50 dark:border-indigo-800/50">
                          {d}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">Waiting for input...</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Scouts Card */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-6 text-gray-400 dark:text-gray-500">
                <History size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Recent Scouts</span>
              </div>

              {scoutHistory.length > 0 ? (
                <div className="space-y-4 flex-1 overflow-y-auto">
                  {scoutHistory.map((h, i) => (
                    <div key={i} className="group cursor-default">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-500 transition-colors truncate">{h.name}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400 font-medium">{h.date}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{h.count} Players</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mx-auto mb-2">
                    <History size={16} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium">No recent activity</p>
                </div>
              )}
            </div>

            {/* Tip Card */}
            <div className="p-6 rounded-3xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/10 flex-1 flex flex-col justify-center">
              <Info size={20} className="mb-4 opacity-50" />
              <h4 className="text-sm font-bold mb-2">Scout Tip</h4>
              <p className="text-[11px] leading-relaxed font-medium opacity-90">
                {TIPS[currentTipIndex]}
              </p>
            </div>
          </div>
        </motion.div>
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
                        {groupedLeagues.map((group, groupIdx) => (
                          <div key={groupIdx}>
                            <div className="px-5 py-2 text-xs font-extrabold uppercase tracking-widest text-[#5B5FFF] bg-gray-50/50 dark:bg-gray-900/50 mt-1 first:mt-0 flex items-center gap-2">
                              <span>{group.emoji}</span>
                              <span>{group.label}</span>
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

              {/* Team Selector - Non-NCAA Leagues Only */}
              {league && league !== 'ncaa' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                    <Trophy size={12} /> Team
                  </label>
                  <div className="relative">
                    <select
                      value={manualTeamName}
                      onChange={(e) => {
                        const teamName = e.target.value;
                        setManualTeamName(teamName);

                        if (teamName) {
                          const team = availableTeams.find(t => t.name === teamName);
                          if (team) {
                            setPrimaryColor(team.primary_color || '#5B5FFF');
                            setSecondaryColor(team.secondary_color || '#1A1A1A');
                            setLogoUrl(team.logo_url);
                          }
                        } else {
                          setPrimaryColor('#5B5FFF');
                          setSecondaryColor('#1A1A1A');
                          setLogoUrl('');
                        }
                      }}
                      className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 pl-4 appearance-none"
                    >
                      <option value="">Select Team...</option>
                      {availableTeams.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                      <ChevronDown size={16} className="text-gray-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* NCAA Cascading Selectors */}
              {league === 'ncaa' && (
                <div className="space-y-4 animate-in slide-in-from-top-2">
                  {/* Sport Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                      <Trophy size={12} /> Sport
                    </label>
                    <select
                      value={ncaaSport}
                      onChange={(e) => {
                        setNcaaSport(e.target.value);
                        setSport(e.target.value);
                        setNcaaDivision('Division I');
                        setNcaaConference('');
                        setManualTeamName('');
                        setAvailableConferences([]);
                        setAvailableTeams([]);
                      }}
                      className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 pl-4 appearance-none"
                    >
                      {['Football', 'Basketball', 'Baseball', 'Soccer', 'Volleyball', 'Softball', 'Lacrosse'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Division Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                      <Hash size={12} /> Division
                    </label>
                    <select
                      value={ncaaDivision}
                      onChange={(e) => {
                        setNcaaDivision(e.target.value);
                        setNcaaConference('');
                        setManualTeamName('');
                        setAvailableConferences([]);
                        setAvailableTeams([]);
                      }}
                      className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 pl-4 appearance-none"
                    >
                      {['Division I', 'Division II', 'Division III'].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Conference Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                      <Flag size={12} /> Conference
                    </label>
                    <div className="relative">
                      <select
                        value={ncaaConference}
                        onChange={(e) => {
                          setNcaaConference(e.target.value);
                          setManualTeamName('');
                        }}
                        className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 pl-4 appearance-none"
                      >
                        <option value="">Select Conference...</option>
                        {availableConferences.map(c => (
                          <option key={c.id} value={c.name}>{c.name} ({c.abbreviation})</option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                        <ChevronDown size={16} className="text-gray-400" />
                      </div>
                    </div>
                  </div>

                  {/* NCAA Team Selector - Shows after Conference Selected */}
                  {ncaaConference && availableTeams.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-2">
                        <Trophy size={12} /> Team
                      </label>
                      <div className="relative">
                        <select
                          value={manualTeamName}
                          onChange={(e) => {
                            const teamName = e.target.value;
                            setManualTeamName(teamName);

                            if (teamName) {
                              const team = availableTeams.find(t => t.name === teamName);
                              if (team) {
                                setPrimaryColor(team.primary_color || '#5B5FFF');
                                setSecondaryColor(team.secondary_color || '#1A1A1A');
                                setLogoUrl(team.logo_url);
                              }
                            }
                          }}
                          className="w-full h-14 px-5 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-base font-medium outline-none focus:ring-2 focus:ring-[#5B5FFF]/20 pl-4 appearance-none"
                        >
                          <option value="">Select Team...</option>
                          {availableTeams.map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <ChevronDown size={16} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Season Year */}
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

              <button
                onClick={handleProcess}
                disabled={!league}
                className={`w-full mt-8 h-14 rounded-xl font-bold text-base shadow-lg transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${league ? 'primary-gradient text-white shadow-[#5B5FFF]/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}`}
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

      {/* Missing Players Prompt */}
      <MissingPlayersModal
        isOpen={showMissingPlayersModal}
        pastedCount={missingAthletesData?.pasted || 0}
        officialCount={missingAthletesData?.official || 0}
        missingCount={missingAthletesData?.missing.length || 0}
        onKeep={() => setShowMissingPlayersModal(false)}
        onAdd={handleAddMissingPlayers}
      />


      {
        step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8 pb-24"
          >
            {/* Detailed Metadata Header */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-8 md:p-10 flex flex-col md:flex-row gap-10 bg-gray-50/30 dark:bg-gray-800/20">
                <div className="flex-1 flex flex-col md:flex-row gap-8">
                  <div className="w-28 h-28 rounded-3xl text-white flex items-center justify-center shadow-lg shrink-0 overflow-hidden relative group bg-white border border-gray-100 dark:border-gray-800">
                    {logoUrl && logoUrl !== 'Unknown' ? (
                      <img src={logoUrl} alt={teamName} className="w-full h-full object-contain p-4" onError={() => setLogoUrl('')} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-mono font-black text-4xl" style={{ backgroundColor: primaryColor }}>
                        {abbreviation || '??'}
                      </div>
                    )}
                    <button onClick={() => setIsEditingMetadata(!isEditingMetadata)} className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Edit2 size={24} />
                    </button>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4 flex-wrap">
                      <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">
                        {teamName}
                      </h2>
                      <span className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-[0.2em]">{sport}</span>
                    </div>

                    <div className="flex items-center gap-6 text-gray-400 dark:text-gray-500 text-sm font-bold">
                      <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-500/50" />
                        <span>{seasonYear} Season</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={18} className="text-indigo-500/50" />
                        <span>{processedAthletes.length} Athletes Found</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-2">
                      <button onClick={() => setIsEditingMetadata(!isEditingMetadata)} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:border-indigo-500 transition-all flex items-center gap-2">
                        <Palette size={14} className="text-indigo-500" /> Branding
                      </button>
                      {pendingRoster?.verificationSources && pendingRoster.verificationSources.length > 0 && (
                        <div className="flex items-center gap-2 pl-4 border-l border-gray-100 dark:border-gray-800">
                          <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">AI Sources</span>
                          <div className="flex gap-2">
                            {pendingRoster.verificationSources.slice(0, 3).map((src, i) => (
                              <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="w-7 h-7 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-colors" title={src.title}>
                                <ExternalLink size={12} />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-center min-w-[240px] pt-6 md:pt-0 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 md:pl-10">
                  <button onClick={handleSaveToLibrary} disabled={isSaving} className="w-full h-14 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-gray-900/10 dark:shadow-white/5 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em]">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save To Library
                  </button>
                  <p className="text-[10px] text-gray-400 text-center mt-4 font-medium uppercase tracking-widest">Ready for export and sync</p>
                </div>
              </div>

              {/* Editing Pane */}
              <AnimatePresence>
                {isEditingMetadata && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-gray-50/50 dark:bg-gray-800/40 border-t border-gray-50 dark:border-gray-800"
                  >
                    <div className="p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Team Name</label>
                        <input type="text" value={teamName} onChange={(e) => setTeamName(e.target.value)} className="w-full px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Season</label>
                        <input type="text" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} className="w-full px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Brand Colors</label>
                        <div className="flex gap-2">
                          <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full h-12 rounded-xl border-none cursor-pointer bg-transparent" />
                          <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-full h-12 rounded-xl border-none cursor-pointer bg-transparent" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Logo URL</label>
                        <input type="text" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-full px-5 py-3.5 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="https://..." />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Roster Table */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-16">#</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Full Name</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Jersey</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Position</th>
                      {userTier !== 'BASIC' && (
                        <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Phonetic</th>
                      )}
                      {userTier !== 'BASIC' && (
                        <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-center">Colors</th>
                      )}
                      {userTier !== 'BASIC' && (
                        <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right pr-12">Hardware Safe</th>
                      )}
                      {onDeletePlayer && <th className="w-16 h-full"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                    {processedAthletes.map((a, idx) => (
                      <motion.tr
                        key={a.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group"
                      >
                        <td className="px-6 py-6 text-sm font-bold text-gray-300 dark:text-gray-600">{idx + 1}</td>
                        <td className="px-6 py-6">
                          <span className="text-base font-bold text-gray-900 dark:text-white tracking-tight">{a.fullName}</span>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="inline-flex items-center justify-center min-w-[32px] h-8 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-black text-gray-900 dark:text-white">
                            {a.jerseyNumber.toString().replace(/#/g, '') || '--'}
                          </span>
                        </td>
                        <td className="px-6 py-6 text-center">
                          <span className="inline-block px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                            {a.position.toString().replace(/#/g, '')}
                          </span>
                        </td>
                        {userTier !== 'BASIC' && (
                          <td className="px-6 py-6 text-center">
                            <span className="text-xs font-bold text-gray-500 italic">
                              {a.phoneticSimplified || '-'}
                            </span>
                          </td>
                        )}
                        {userTier !== 'BASIC' && (
                          <td className="px-6 py-6 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <div className="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: a.metadata?.primaryColor || primaryColor || '#000' }}></div>
                              <div className="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-sm" style={{ backgroundColor: a.metadata?.secondaryColor || secondaryColor || '#fff' }}></div>
                            </div>
                          </td>
                        )}
                        {userTier !== 'BASIC' && (
                          <td className="px-6 py-6 text-right pr-12">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold font-mono">
                              <Check size={12} />
                              {a.displayNameSafe}
                            </span>
                          </td>
                        )}
                        {onDeletePlayer && (
                          <td className="px-6 py-6 text-center">
                            <button
                              onClick={() => handleDeletePlayer(a.fullName)}
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <UserMinus size={16} />
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>

                {processedAthletes.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserMinus size={24} className="text-gray-300" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">No Athletes Found</h3>
                    <p className="text-gray-500 text-sm">Review your source input and try scouting again.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )
      }

    </div>
  );
};

export default Engine;