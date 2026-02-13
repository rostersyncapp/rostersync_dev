import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Athlete, Roster } from '../types';
import { Download, Save, Trophy, Globe, Library, Archive, ChevronRight, Search, Activity } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface LeagueConfig {
    id: string;
    name: string;
    description: string;
    icon: any;
    table: string;
    seasonsRpc: string;
    rosterRpc: string;
    sport: string;
    primaryColor: string;
    params: {
        seasons: (id: string) => any;
        roster: (id: string, yr: number) => any;
    };
}

const LEAGUES: LeagueConfig[] = [
    {
        id: 'nfl',
        name: 'NFL',
        description: 'National Football League Historical Rosters',
        icon: Trophy,
        table: 'nfl_teams',
        seasonsRpc: 'get_nfl_team_seasons',
        rosterRpc: 'get_nfl_roster',
        sport: 'Football',
        primaryColor: '#013369',
        params: {
            seasons: (id) => ({ team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'ncaa-football',
        name: 'NCAA Football',
        description: 'College Football Historical Rosters (FBS)',
        icon: Trophy,
        table: 'ncaa_football_teams',
        seasonsRpc: 'get_ncaa_football_team_seasons',
        rosterRpc: 'get_ncaa_football_roster',
        sport: 'Football',
        primaryColor: '#9E1B32',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'wnba',
        name: 'WNBA',
        description: 'Women\'s National Basketball Association',
        icon: Trophy,
        table: 'wnba_teams',
        seasonsRpc: 'get_wnba_team_seasons',
        rosterRpc: 'get_wnba_roster',
        sport: 'Basketball',
        primaryColor: '#FF6B00',
        params: {
            seasons: (id) => ({ team_id: id }),
            roster: (id, yr) => ({ team_id: id, season_year: yr })
        }
    },
    {
        id: 'nba',
        name: 'NBA',
        description: 'National Basketball Association Historical Rosters',
        icon: Trophy,
        table: 'nba_teams',
        seasonsRpc: 'get_nba_team_seasons',
        rosterRpc: 'get_nba_roster',
        sport: 'Basketball',
        primaryColor: '#17408B',
        params: {
            seasons: (id) => ({ team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'mlb',
        name: 'MLB',
        description: 'Major League Baseball Historical Rosters',
        icon: Globe,
        table: 'mlb_teams',
        seasonsRpc: 'get_mlb_team_seasons',
        rosterRpc: 'get_mlb_roster',
        sport: 'Baseball',
        primaryColor: '#002D72',
        params: {
            seasons: (id) => ({ team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'nhl',
        name: 'NHL',
        description: 'National Hockey League Historical Rosters',
        icon: Activity,
        table: 'nhl_teams',
        seasonsRpc: 'get_nhl_team_seasons',
        rosterRpc: 'get_nhl_roster',
        sport: 'Hockey',
        primaryColor: '#000000',
        params: {
            seasons: (id) => ({ team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'mls',
        name: 'MLS',
        description: 'Major League Soccer Historical Rosters',
        icon: Globe,
        table: 'mls_teams',
        seasonsRpc: 'get_mls_team_seasons',
        rosterRpc: 'get_mls_roster',
        sport: 'Soccer',
        primaryColor: '#F5002D',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'nwsl',
        name: 'NWSL',
        description: 'National Women\'s Soccer League',
        icon: Globe,
        table: 'nwsl_teams',
        seasonsRpc: 'get_nwsl_team_seasons',
        rosterRpc: 'get_nwsl_roster',
        sport: 'Soccer',
        primaryColor: '#001E62',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'usl',
        name: 'USL Championship',
        description: 'USL Championship Soccer Rosters',
        icon: Globe,
        table: 'usl_teams',
        seasonsRpc: 'get_usl_team_seasons',
        rosterRpc: 'get_usl_roster',
        sport: 'Soccer',
        primaryColor: '#000000',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    }
];

interface Team {
    id: string;
    display_name: string;
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
}

interface Player {
    player_name: string;
    player_id?: string;
    jersey_number: string | null;
    position: string | null;
    height: string | null;
    weight: string | null;
    class?: string | null;
    college?: string | null;
}

interface RosterArchiveProps {
    onSave?: (roster: Roster) => void;
    userTier?: string;
}

export default function RosterArchive({ onSave, userTier = 'BASIC' }: RosterArchiveProps) {
    const [selectedLeagueId, setSelectedLeagueId] = useState<string>(LEAGUES[0].id);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [roster, setRoster] = useState<Player[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentLeague = LEAGUES.find(l => l.id === selectedLeagueId) || LEAGUES[0];

    // Load teams when league changes
    useEffect(() => {
        loadTeams(selectedLeagueId);
        setSelectedTeamId('');
        setAvailableSeasons([]);
        setSelectedSeason(null);
        setRoster([]);
    }, [selectedLeagueId]);

    // Load seasons when team is selected
    useEffect(() => {
        if (selectedTeamId) {
            loadSeasons(selectedTeamId);
        } else {
            setAvailableSeasons([]);
            setSelectedSeason(null);
            setRoster([]);
        }
    }, [selectedTeamId]);

    // Load roster when season is selected
    useEffect(() => {
        if (selectedTeamId && selectedSeason) {
            loadRoster(selectedTeamId, selectedSeason);
        } else {
            setRoster([]);
        }
    }, [selectedTeamId, selectedSeason]);

    async function loadTeams(leagueId: string) {
        setLoading(true);
        const league = LEAGUES.find(l => l.id === leagueId) || LEAGUES[0];
        const { data, error } = await supabase
            .from(league.table)
            .select('*')
            .order('display_name');

        if (error) {
            console.error('Error loading teams:', error);
            setError(`Failed to load ${league.name} teams`);
            setLoading(false);
            return;
        }

        setTeams(data || []);
        setLoading(false);
    }

    async function loadSeasons(teamId: string) {
        setLoading(true);
        const { data, error } = await supabase
            .rpc(currentLeague.seasonsRpc, currentLeague.params.seasons(teamId));

        if (error) {
            console.error('Error loading seasons:', error);
            setError('Failed to load seasons');
            setLoading(false);
            return;
        }

        const seasons = (data || []).map((row: any) => row.season_year);
        setAvailableSeasons(seasons);
        setSelectedSeason(seasons.length > 0 ? seasons[0] : null);
        setLoading(false);
    }

    async function loadRoster(teamId: string, seasonYear: number) {
        setLoading(true);
        setError(null);

        const { data, error } = await supabase
            .rpc(currentLeague.rosterRpc, currentLeague.params.roster(teamId, seasonYear));

        if (error) {
            console.error('Error loading roster:', error);
            setError('Failed to load roster');
            setLoading(false);
            return;
        }

        setRoster(data || []);
        setLoading(false);
    }

    function formatJersey(jersey: string | null): string {
        if (!jersey) return '00';
        const clean = jersey.trim();
        if (/^\d$/.test(clean)) return `0${clean}`;
        return clean;
    }

    function convertToAthletes(): Athlete[] {
        return roster.map((player, index) => ({
            fullName: player.player_name,
            jerseyNumber: formatJersey(player.jersey_number),
            position: player.position || 'Player',
            phoneticSimplified: '',
            phoneticIPA: '',
            headshot: player.player_id && currentLeague.id.includes('ncaa')
                ? `https://a.espncdn.com/i/headshots/ncaa/players/full/${player.player_id}.png`
                : '',
            id: `${currentLeague.id}-${selectedTeamId}-${selectedSeason}-${index}`,
        }));
    }

    function handleSaveToLibrary() {
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        if (!selectedTeam || !selectedSeason) return;

        const athletes = convertToAthletes();

        const newRoster: Roster = {
            id: Math.random().toString(36).substr(2, 9),
            userId: '1',
            teamName: selectedTeam.display_name,
            sport: currentLeague.sport,
            league: currentLeague.id.replace('-football', '').toUpperCase(),
            seasonYear: selectedSeason.toString(),
            rosterData: athletes,
            athleteCount: athletes.length,
            versionDescription: `[${selectedSeason}] ${selectedTeam.display_name} - ${athletes.length} Players`,
            createdAt: new Date().toISOString(),
            teamMetadata: {
                primaryColor: selectedTeam.primary_color || currentLeague.primaryColor,
                secondaryColor: selectedTeam.secondary_color || '#FFFFFF',
                abbreviation: selectedTeam.name.substring(0, 3).toUpperCase(),
                logoUrl: selectedTeam.logo_url || null,
                conference: currentLeague.sport === 'Football' && currentLeague.id.includes('ncaa') ? 'NCAA' : currentLeague.name
            }
        };

        onSave?.(newRoster);
    }

    function handleExportCSV() {
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        if (!selectedTeam || !selectedSeason) return;

        const csvHeaders = ['Jersey Number', 'Player Name', 'Position', 'Height', 'Weight', 'Details'];
        const csvRows = roster.map(player => [
            formatJersey(player.jersey_number),
            player.player_name,
            player.position || '',
            player.height || '',
            player.weight || '',
            player.class || player.college || ''
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentLeague.id}_${selectedTeam.display_name.replace(/\s+/g, '_')}_${selectedSeason}_roster.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    const teamPrimaryColor = selectedTeam?.primary_color || currentLeague.primaryColor;

    const getPositionColor = (pos: string | null) => {
        if (!pos) return 'bg-gray-100 text-gray-500';
        const p = pos.toUpperCase();
        if (['QB', 'PG', 'P'].includes(p)) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        if (['WR', 'SG', 'F', 'LW', 'RW'].includes(p)) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        if (['RB', 'SF', 'C', 'ST', 'CF'].includes(p)) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (['DL', 'PF', 'D', 'LB', 'CB'].includes(p)) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
        return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Dynamic Background Blobs */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div
                    className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 dark:opacity-30 transition-colors duration-1000"
                    style={{ backgroundColor: teamPrimaryColor }}
                />
                <div
                    className="absolute top-[40%] -right-[5%] w-[30%] h-[30%] rounded-full blur-[100px] opacity-10 dark:opacity-20 transition-colors duration-1000"
                    style={{ backgroundColor: currentLeague.primaryColor }}
                />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in duration-500">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl p-8 rounded-[40px] border border-white/20 dark:border-gray-800/50 shadow-2xl shadow-black/5">
                    <div className="flex items-center gap-6">
                        <div
                            className="p-5 rounded-3xl shadow-inner transition-colors duration-500"
                            style={{ backgroundColor: teamPrimaryColor + '20' }}
                        >
                            <Library className="animate-pulse" style={{ color: teamPrimaryColor }} size={32} />
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic">
                                Roster <span style={{ color: teamPrimaryColor }}>Archive</span>
                            </h1>
                            <p className="text-gray-500 font-bold text-sm tracking-wide">Premium Historical Database • {LEAGUES.length} Professional Leagues</p>
                        </div>
                    </div>
                </div>

                {/* Selectors Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* League Selector */}
                    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-6 rounded-[40px] border border-white/20 dark:border-gray-800 shadow-xl space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <Globe size={18} className="text-gray-400" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Leagues</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                            {LEAGUES.map((league) => (
                                <button
                                    key={league.id}
                                    onClick={() => setSelectedLeagueId(league.id)}
                                    className={`flex items-center gap-3 p-3 rounded-[20px] text-left transition-all duration-300 group ${selectedLeagueId === league.id
                                        ? 'text-white shadow-xl scale-[1.02]'
                                        : 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                        }`}
                                    style={selectedLeagueId === league.id ? {
                                        background: `linear-gradient(135deg, ${league.primaryColor}, ${league.primaryColor}dd)`,
                                        boxShadow: `0 10px 30px -10px ${league.primaryColor}80`
                                    } : {}}
                                >
                                    <div className={`p-2 rounded-xl ${selectedLeagueId === league.id ? 'bg-white/20' : 'bg-white dark:bg-gray-800 shadow-sm'}`}>
                                        <league.icon size={16} />
                                    </div>
                                    <span className="text-xs font-black truncate uppercase tracking-tighter">{league.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Team Selector */}
                    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-6 rounded-[40px] border border-white/20 dark:border-gray-800 shadow-xl space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <Search size={18} className="text-gray-400" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Organization</span>
                        </div>
                        <div className="relative group">
                            <select
                                value={selectedTeamId}
                                onChange={(e) => setSelectedTeamId(e.target.value)}
                                className="w-full px-6 py-5 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-primary/20 rounded-[24px] font-black text-gray-900 dark:text-white appearance-none transition-all outline-none"
                            >
                                <option value="">{loading ? 'SYNCING TEAMS...' : `CHOOSE ${currentLeague.name} TEAM...`}</option>
                                {teams.map(team => (
                                    <option key={team.id} value={team.id}>
                                        {team.display_name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none">
                                <ChevronRight size={20} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    </div>

                    {/* Season Selector */}
                    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-6 rounded-[40px] border border-white/20 dark:border-gray-800 shadow-xl space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <Archive size={18} className="text-gray-400" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Timeline</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <select
                                value={selectedSeason || ''}
                                onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                                disabled={!selectedTeamId || availableSeasons.length === 0}
                                className="col-span-2 w-full px-6 py-5 bg-gray-50 dark:bg-gray-800/50 border-2 border-transparent focus:border-primary/20 rounded-[24px] font-black text-gray-900 dark:text-white disabled:opacity-50 appearance-none transition-all outline-none"
                            >
                                <option value="">{availableSeasons.length === 0 ? 'NO DATA' : 'SELECT YEAR...'}</option>
                                {availableSeasons.map(year => (
                                    <option key={year} value={year}>
                                        {year} SEASON
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                {selectedTeam && selectedSeason ? (
                    <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                        {/* Team Hero Card - HIGH COLOR VERSION */}
                        <div
                            className="relative overflow-hidden p-10 rounded-[48px] border border-white/20 shadow-2xl transition-all duration-1000"
                            style={{
                                background: `linear-gradient(135deg, ${teamPrimaryColor}ee, ${teamPrimaryColor}88)`,
                                boxShadow: `0 30px 60px -15px ${teamPrimaryColor}40`
                            }}
                        >
                            {/* Watermark Abbreviation */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[24rem] font-black text-white/5 pointer-events-none select-none tracking-tighter italic">
                                {selectedTeam.name.substring(0, 3).toUpperCase()}
                            </div>

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                                <div className="flex items-center gap-10">
                                    <div className="w-32 h-32 bg-white p-6 rounded-[32px] shadow-2xl shadow-black/10 flex items-center justify-center transform hover:scale-110 transition-transform duration-500 group">
                                        {selectedTeam.logo_url ? (
                                            <img src={selectedTeam.logo_url} alt={selectedTeam.display_name} className="w-full h-full object-contain" />
                                        ) : (
                                            <Trophy size={64} className="text-gray-200" />
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <span className="px-4 py-1 bg-black/20 backdrop-blur-md rounded-full text-[11px] font-black text-white uppercase tracking-widest border border-white/10">
                                                {currentLeague.name} • {currentLeague.sport}
                                            </span>
                                        </div>
                                        <h2 className="text-6xl font-black text-white tracking-tighter uppercase italic leading-none">
                                            {selectedTeam.display_name}
                                        </h2>
                                        <div className="flex items-center gap-4">
                                            <p className="text-white/80 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                                                <Activity size={16} />
                                                {selectedSeason} Official Roster
                                            </p>
                                            <div className="h-1 w-1 bg-white/40 rounded-full" />
                                            <p className="text-white/80 font-black uppercase tracking-widest text-sm">
                                                {roster.length} Athletes Loaded
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        onClick={handleSaveToLibrary}
                                        className="group relative flex items-center gap-3 px-10 py-6 bg-white text-gray-900 rounded-[24px] font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl hover:shadow-white/20 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors" />
                                        <Save size={20} className="relative z-10" />
                                        <span className="relative z-10">Secure Library Sync</span>
                                    </button>
                                    <button
                                        onClick={handleExportCSV}
                                        className="flex items-center gap-3 px-10 py-6 bg-black/20 backdrop-blur-md border border-white/20 text-white rounded-[24px] font-black text-sm uppercase tracking-widest hover:bg-black/30 transition-all shadow-xl"
                                    >
                                        <Download size={20} />
                                        Export Data
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Roster Table Section */}
                        <div className="bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl rounded-[48px] border border-white/20 dark:border-gray-800/50 overflow-hidden shadow-2xl">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr
                                            className="text-white"
                                            style={{ backgroundColor: teamPrimaryColor }}
                                        >
                                            <th className="px-10 py-8 text-left text-[11px] font-black uppercase tracking-widest opacity-80">Jersey</th>
                                            <th className="px-10 py-8 text-left text-[11px] font-black uppercase tracking-widest opacity-80">Athlete Profile</th>
                                            <th className="px-10 py-8 text-left text-[11px] font-black uppercase tracking-widest opacity-80">Position</th>
                                            <th className="px-10 py-8 text-left text-[11px] font-black uppercase tracking-widest opacity-80">Physicals</th>
                                            <th className="px-10 py-8 text-left text-[11px] font-black uppercase tracking-widest opacity-80">Background</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800/30">
                                        {roster.map((player, idx) => (
                                            <tr key={idx} className="group hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all relative">
                                                {/* Left highlights color bar on hover */}
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ backgroundColor: teamPrimaryColor }}
                                                />
                                                <td className="px-10 py-6">
                                                    <span className="text-xl font-black text-gray-900 dark:text-white tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity">
                                                        {player.jersey_number ? formatJersey(player.jersey_number) : '--'}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <div className="flex items-center gap-5">
                                                        <div className="relative">
                                                            <div
                                                                className="absolute -inset-1 rounded-full opacity-0 group-hover:opacity-30 blur-sm transition-opacity"
                                                                style={{ backgroundColor: teamPrimaryColor }}
                                                            />
                                                            {player.player_id && currentLeague.id.includes('ncaa') ? (
                                                                <img
                                                                    src={`https://a.espncdn.com/i/headshots/ncaa/players/full/${player.player_id}.png`}
                                                                    className="relative w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 object-cover border-2 border-transparent group-hover:border-white/50 transition-all shadow-sm"
                                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                                />
                                                            ) : (
                                                                <div className="relative w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 border-transparent group-hover:border-white/20 transition-all">
                                                                    <span className="text-xs font-black text-gray-400">{player.player_name.split(' ').map(n => n[0]).join('')}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight group-hover:translate-x-1 transition-transform">
                                                            {player.player_name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${getPositionColor(player.position)}`}>
                                                        {player.position || 'Player'}
                                                    </span>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-gray-700 dark:text-gray-300 tracking-tight">
                                                            {player.height ? player.height : '--'}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                                            {player.weight ? `${player.weight} lbs` : '--'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <span className="text-sm font-bold text-gray-400 italic bg-gray-100/50 dark:bg-white/5 px-3 py-1 rounded-lg">
                                                        {player.class || player.college || '--'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-40 bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl rounded-[48px] border-2 border-dashed border-gray-100 dark:border-gray-800 animate-in fade-in zoom-in duration-1000 group">
                        <div className="relative">
                            <div className="absolute -inset-10 bg-primary/10 rounded-full blur-[50px] group-hover:bg-primary/20 transition-all duration-700" />
                            <div className="relative p-10 bg-white dark:bg-gray-800 rounded-full mb-8 shadow-2xl shadow-black/5 transform group-hover:scale-110 transition-transform duration-700">
                                <Library className="text-gray-300 dark:text-gray-600 group-hover:text-primary transition-colors" size={80} />
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tighter italic">Select your Target Roster</h3>
                        <p className="text-gray-400 font-bold max-w-sm text-center mt-3 tracking-wide leading-relaxed">
                            Pick a league, team, and season above to load premium athlete data from the global archives.
                        </p>
                    </div>
                )}
            </div>

            {/* Error Message */}
            {error && (
                <div className="fixed bottom-8 right-8 bg-rose-600 text-white px-8 py-5 rounded-[24px] shadow-2xl shadow-rose-600/20 animate-in slide-in-from-right-10 flex items-center gap-4 border border-white/10">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    <p className="font-black text-sm uppercase tracking-widest">{error}</p>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && !roster.length && (
                <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/10 backdrop-blur-sm pointer-events-none">
                    <div className="relative">
                        <div className="absolute -inset-10 bg-primary/20 rounded-full blur-[60px] animate-pulse" />
                        <div className="relative w-24 h-24 border-8 border-primary border-t-transparent rounded-full animate-spin shadow-2xl" />
                    </div>
                    <p className="mt-10 font-black text-gray-900 dark:text-white uppercase tracking-[0.5em] text-sm animate-pulse">Syncing Engine...</p>
                </div>
            )}
        </div>
    );
}
