import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Athlete, Roster } from '../types';
import { Download, Save, Trophy } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface NFLTeam {
    id: string;
    name: string;
    display_name: string;
    abbreviation: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
}

interface NFLPlayer {
    player_name: string;
    jersey_number: string | null;
    position: string | null;
    height: string | null;
    weight: string | null;
    college: string | null;
    birth_date: string | null;
    phonetic_name: string | null;
    ipa_name: string | null;
    chinese_name: string | null;
    hardware_safe_name: string | null;
}

interface NFLHistoricalBrowserProps {
    onSave?: (roster: Roster) => void;
    userTier?: string;
}

export default function NFLHistoricalBrowser({ onSave, userTier = 'FREE' }: NFLHistoricalBrowserProps) {
    const [teams, setTeams] = useState<NFLTeam[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [roster, setRoster] = useState<NFLPlayer[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load teams on mount
    useEffect(() => {
        loadTeams();
    }, []);

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

    async function loadTeams() {
        const { data, error } = await supabase
            .from('nfl_teams')
            .select('*')
            .order('display_name');

        if (error) {
            console.error('Error loading teams:', error);
            setError('Failed to load NFL teams');
            return;
        }

        setTeams(data || []);
    }

    async function loadSeasons(teamId: string) {
        setLoading(true);
        const { data, error } = await supabase
            .rpc('get_nfl_team_seasons', { team_id: teamId });

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
            .rpc('get_nfl_roster', {
                p_team_id: teamId,
                p_season_year: seasonYear
            });

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
            id: `nfl-${selectedTeamId}-${selectedSeason}-${index}`,
            originalName: player.player_name,
            fullName: player.player_name.toUpperCase(),
            displayNameSafe: player.hardware_safe_name || player.player_name.toUpperCase(),
            jerseyNumber: formatJersey(player.jersey_number),
            position: player.position || 'Player',
            phoneticSimplified: player.phonetic_name || '',
            phoneticIPA: player.ipa_name || '',
            nameMandarin: player.chinese_name || '',
            nilStatus: 'Active',
            seasonYear: selectedSeason?.toString() || '',
            headshot: '',
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
            sport: 'Football',
            league: 'nfl',
            seasonYear: selectedSeason.toString(),
            rosterData: athletes,
            athleteCount: athletes.length,
            versionDescription: `[${selectedSeason}] ${selectedTeam.display_name} - ${athletes.length} Players`,
            createdAt: new Date().toISOString(),
            teamMetadata: {
                primaryColor: selectedTeam.primary_color || '#000000',
                secondaryColor: selectedTeam.secondary_color || '#FFFFFF',
                abbreviation: selectedTeam.abbreviation || '',
                logoUrl: selectedTeam.logo_url || null,
                conference: 'NFL'
            }
        };

        onSave?.(newRoster);
    }

    function handleExportCSV() {
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        if (!selectedTeam || !selectedSeason) return;

        const csvHeaders = ['Jersey Number', 'Player Name', 'Position', 'Height', 'Weight', 'College'];
        const csvRows = roster.map(player => [
            formatJersey(player.jersey_number),
            player.player_name,
            player.position || '',
            player.height || '',
            player.weight || '',
            player.college || ''
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTeam.abbreviation || selectedTeam.id}_${selectedSeason}_roster.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                        <Trophy size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">NFL Roster Browser</h1>
                        <p className="text-gray-600 dark:text-gray-400">Access official NFL rosters and metadata</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Select Team
                        </label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold dark:text-white"
                        >
                            <option value="">Choose a team...</option>
                            {teams.map(team => (
                                <option key={team.id} value={team.id}>
                                    {team.display_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Select Season
                        </label>
                        <select
                            value={selectedSeason || ''}
                            onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                            disabled={!selectedTeamId || availableSeasons.length === 0}
                            className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 font-bold dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">Choose a season...</option>
                            {availableSeasons.map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedTeam && selectedSeason && (
                    <div
                        className="mt-8 p-6 rounded-2xl flex items-center gap-6 animate-in fade-in slide-in-from-top-4 duration-500"
                        style={{
                            backgroundColor: (selectedTeam.primary_color || '#000000') + '15',
                            borderLeft: `6px solid ${selectedTeam.primary_color || '#000000'}`
                        }}
                    >
                        {selectedTeam.logo_url ? (
                            <img
                                src={selectedTeam.logo_url}
                                alt={selectedTeam.display_name}
                                className="w-16 h-16 object-contain"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center text-gray-400">
                                <Trophy size={32} />
                            </div>
                        )}
                        <div>
                            <h3 className="font-black text-2xl text-gray-900 dark:text-white uppercase tracking-tight">
                                {selectedTeam.display_name}
                            </h3>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">
                                {selectedSeason} Season • {roster.length} Athletes
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl p-6 mb-8 flex items-center gap-4 text-red-600">
                    <p className="font-bold">{error}</p>
                </div>
            )}

            {roster.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden animate-in fade-in duration-700">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                                <tr>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        #
                                    </th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Athlete Name
                                    </th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Position
                                    </th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Height
                                    </th>
                                    <th className="px-8 py-5 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        College
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                {roster.map((player, index) => (
                                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="px-8 py-5 whitespace-nowrap text-sm font-black text-gray-900 dark:text-white">
                                            {player.jersey_number || '--'}
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm font-bold text-gray-700 dark:text-gray-200">
                                            {player.player_name}
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap">
                                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-[10px] font-black uppercase text-gray-500">
                                                {player.position || 'UNK'}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                                            {player.height || '--'}
                                        </td>
                                        <td className="px-8 py-5 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
                                            {player.college || '--'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/30 px-8 py-6 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={handleSaveToLibrary}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            <Save size={20} />
                            Save to Library
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center justify-center gap-3 px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                        >
                            <Download size={20} />
                            Export CSV
                        </button>
                    </div>
                </div>
            )}

            {loading && (
                <div className="text-center py-20">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent shadow-sm"></div>
                    <p className="mt-4 text-gray-400 font-bold uppercase tracking-widest text-sm">Synchronizing Roster...</p>
                </div>
            )}

            {!loading && selectedTeamId && selectedSeason && roster.length === 0 && (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-900 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                    <p className="text-gray-500 font-bold uppercase tracking-widest">No Roster Data Detected</p>
                    <p className="text-sm text-gray-400 mt-2">Try selecting a different season or contact support.</p>
                </div>
            )}
        </div>
    );
}
