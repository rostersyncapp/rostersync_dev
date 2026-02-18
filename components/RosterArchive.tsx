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
        id: 'ncaa-mens-basketball',
        name: 'NCAA Men\'s Basketball',
        description: 'College Basketball Historical Rosters (Men\'s)',
        icon: Trophy,
        table: 'ncaa_basketball_teams',
        seasonsRpc: 'get_ncaa_basketball_team_seasons',
        rosterRpc: 'get_ncaa_basketball_roster',
        sport: 'Basketball',
        primaryColor: '#003366',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'ncaa-womens-basketball',
        name: 'NCAA Women\'s Basketball',
        description: 'College Basketball Historical Rosters (Women\'s)',
        icon: Trophy,
        table: 'ncaa_womens_basketball_teams',
        seasonsRpc: 'get_ncaa_womens_basketball_team_seasons',
        rosterRpc: 'get_ncaa_womens_basketball_roster',
        sport: 'Basketball',
        primaryColor: '#660099',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
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
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    },
    {
        id: 'milb',
        name: 'MiLB Triple-A',
        description: 'Minor League Baseball Triple-A (IL & PCL)',
        icon: Globe,
        table: 'milb_teams',
        seasonsRpc: 'get_milb_team_seasons',
        rosterRpc: 'get_milb_roster',
        sport: 'Baseball',
        primaryColor: '#002D72',
        params: {
            seasons: (id) => ({ p_team_id: id }),
            roster: (id, yr) => ({ p_team_id: id, p_season_year: yr })
        }
    }
].sort((a, b) => {
    const sportCompare = a.sport.localeCompare(b.sport);
    if (sportCompare !== 0) return sportCompare;
    return a.name.localeCompare(b.name);
});

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

        let query = supabase
            .from(league.table)
            .select('*');

        // For MiLB, we only want to show current Triple-A teams
        if (leagueId === 'milb') {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query.order('display_name');

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

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-6">
                    <div className="p-4 bg-[#5B5FFF]/10 rounded-xl text-[#5B5FFF]">
                        <Library size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Roster Archive</h1>
                        <p className="text-gray-500 font-medium">Browse thousands of historical professional and collegiate rosters.</p>
                    </div>
                </div>
            </div>

            {/* Selectors Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* League Selector */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <Globe size={18} className="text-gray-400" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select League</span>
                    </div>
                    <select
                        value={selectedLeagueId}
                        onChange={(e) => setSelectedLeagueId(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-[#5B5FFF] font-bold dark:text-white appearance-none"
                    >
                        {Array.from(new Set(LEAGUES.map(l => l.sport))).map(sport => (
                            <optgroup key={sport} label={sport.toUpperCase()} className="text-[10px] font-black text-gray-400 bg-white dark:bg-gray-900">
                                {LEAGUES.filter(l => l.sport === sport).map(league => (
                                    <option key={league.id} value={league.id} className="text-sm font-bold text-gray-900 dark:text-white">
                                        {league.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                {/* Team Selector */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <Search size={18} className="text-gray-400" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Team</span>
                    </div>
                    <select
                        value={selectedTeamId}
                        onChange={(e) => setSelectedTeamId(e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-[#5B5FFF] font-bold dark:text-white appearance-none"
                    >
                        <option value="">{loading ? 'Loading teams...' : `Choose ${currentLeague.name} Team...`}</option>
                        {teams.map(team => (
                            <option key={team.id} value={team.id}>
                                {team.display_name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Season Selector */}
                <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 px-2">
                        <Archive size={18} className="text-gray-400" />
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Season</span>
                    </div>
                    <select
                        value={selectedSeason || ''}
                        onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                        disabled={!selectedTeamId || availableSeasons.length === 0}
                        className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-none rounded-2xl focus:ring-2 focus:ring-[#5B5FFF] font-bold dark:text-white disabled:opacity-50 appearance-none"
                    >
                        <option value="">{availableSeasons.length === 0 ? 'No seasons available' : 'Choose Season...'}</option>
                        {availableSeasons.map(year => (
                            <option key={year} value={year}>
                                {year} Season
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            {selectedTeam && selectedSeason ? (
                <div className="space-y-6">
                    {/* Team Hero Card */}
                    <div
                        className="p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-8 border-l-8"
                        style={{
                            backgroundColor: (selectedTeam.primary_color || currentLeague.primaryColor) + '15',
                            borderColor: selectedTeam.primary_color || currentLeague.primaryColor
                        }}
                    >
                        <div className="flex items-center gap-8">
                            <div className="w-24 h-24 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-xl shadow-black/5 flex items-center justify-center">
                                {selectedTeam.logo_url ? (
                                    <img src={selectedTeam.logo_url} alt={selectedTeam.display_name} className="w-full h-full object-contain" />
                                ) : (
                                    <Trophy size={48} className="text-gray-200" />
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-1 bg-white/50 dark:bg-black/20 rounded-full text-[10px] font-black text-[#5B5FFF] uppercase tracking-widest">
                                        {currentLeague.name}
                                    </span>
                                </div>
                                <h2 className="text-4xl font-black text-gray-900 dark:text-white tracking-tight uppercase">
                                    {selectedTeam.display_name}
                                </h2>
                                <p className="text-gray-500 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                                    <Activity size={14} />
                                    {selectedSeason} Roster • {roster.length} Athletes
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={handleSaveToLibrary}
                                className="flex items-center gap-3 px-8 py-5 primary-gradient text-white rounded-[20px] font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#5B5FFF]/20"
                            >
                                <Save size={18} />
                                Import to Library
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-3 px-8 py-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-900 dark:text-white rounded-[20px] font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-lg"
                            >
                                <Download size={18} />
                                Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Roster Table */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-800/30 border-b border-gray-50 dark:border-gray-800">
                                    <tr>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">#</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Athlete</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Pos</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Size</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                    {roster.map((player, idx) => (
                                        <tr key={idx} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all">
                                            <td className="px-8 py-5 text-sm font-black text-gray-900 dark:text-white">{player.jersey_number || '--'}</td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    {player.player_id && currentLeague.id.includes('ncaa') && (
                                                        <img
                                                            src={`https://a.espncdn.com/i/headshots/ncaa/players/full/${player.player_id}.png`}
                                                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 object-cover border-2 border-transparent group-hover:border-primary/20 transition-all"
                                                            onError={(e) => e.currentTarget.style.display = 'none'}
                                                        />
                                                    )}
                                                    <span className="font-bold text-gray-700 dark:text-gray-200 border-b-2 border-transparent group-hover:border-[#5B5FFF]/30 transition-all">
                                                        {player.player_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <span className="px-3 py-1 bg-[#5B5FFF]/10 dark:bg-[#5B5FFF]/20 rounded-lg text-[10px] font-black uppercase text-[#5B5FFF] tracking-wider">
                                                    {player.position || 'UNK'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-sm font-medium text-gray-500 dark:text-gray-400">
                                                {player.height ? `${player.height}` : ''} {player.weight ? ` / ${player.weight}` : '--'}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-medium text-gray-400 italic">
                                                {player.class || player.college || '--'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-32 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                    <div className="p-6 bg-[#5B5FFF]/5 dark:bg-[#5B5FFF]/10 rounded-full mb-6 text-[#5B5FFF]">
                        <Library className="opacity-40" size={64} />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Select your Target Roster</h3>
                    <p className="text-gray-400 font-medium max-w-xs text-center mt-2">
                        Pick a league, team, and season above to load historical athlete data.
                    </p>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="fixed bottom-8 right-8 bg-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl">
                    <p className="font-black text-sm uppercase tracking-widest">{error}</p>
                </div>
            )}

            {/* Loading Overlay */}
            {loading && !roster.length && (
                <div className="flex flex-col items-center justify-center py-32 space-y-6">
                    <div className="w-16 h-16 border-4 border-[#5B5FFF] border-t-transparent rounded-full animate-spin shadow-lg"></div>
                    <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Syncing Archive Database...</p>
                </div>
            )}
        </div>
    );
}
