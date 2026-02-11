import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Athlete, Roster } from '../types';
import { Download, Save, Upload } from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface WNBATeam {
    id: string;
    name: string;
    display_name: string;
    abbreviation: string;
    logo_url: string;
    primary_color: string;
    secondary_color: string;
    is_active: boolean;
}

interface WNBAPlayer {
    player_name: string;
    jersey_number: string | null;
    position: string | null;
    height: string | null;
    college: string | null;
    years_pro: number | null;
}

interface WNBAHistoricalBrowserProps {
    onSave?: (roster: Roster) => void;
    userTier?: string;
}

export default function WNBAHistoricalBrowser({ onSave, userTier = 'BASIC' }: WNBAHistoricalBrowserProps) {
    const [teams, setTeams] = useState<WNBATeam[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('');
    const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
    const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
    const [roster, setRoster] = useState<WNBAPlayer[]>([]);
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
            .from('wnba_teams')
            .select('*')
            .order('display_name');

        if (error) {
            console.error('Error loading teams:', error);
            setError('Failed to load teams');
            return;
        }

        setTeams(data || []);
    }

    async function loadSeasons(teamId: string) {
        setLoading(true);
        const { data, error } = await supabase
            .rpc('get_wnba_team_seasons', { team_id: teamId });

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
            .rpc('get_wnba_roster', {
                team_id: teamId,
                season_year: seasonYear
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

    function convertToAthletes(): Athlete[] {
        return roster.map((player, index) => ({
            fullName: player.player_name,
            jerseyNumber: player.jersey_number || '00',
            position: player.position || 'Player',
            phoneticSimplified: '', // Will be generated if user saves
            phoneticIPA: '',
            headshot: '',
            id: index.toString(),
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
            sport: 'Basketball',
            league: 'wnba',
            seasonYear: selectedSeason.toString(),
            rosterData: athletes,
            athleteCount: athletes.length,
            versionDescription: `[${selectedSeason}] ${selectedTeam.display_name} - ${athletes.length} Players`,
            createdAt: new Date().toISOString(),
            teamMetadata: {
                primaryColor: selectedTeam.primary_color,
                secondaryColor: selectedTeam.secondary_color,
                abbreviation: selectedTeam.abbreviation,
                logoUrl: selectedTeam.logo_url,
                conference: 'WNBA'
            }
        };

        onSave?.(newRoster);
    }

    function handleExportCSV() {
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        if (!selectedTeam || !selectedSeason) return;

        const csvHeaders = ['Jersey Number', 'Player Name', 'Position', 'Height', 'College', 'Years Pro'];
        const csvRows = roster.map(player => [
            player.jersey_number || '',
            player.player_name,
            player.position || '',
            player.height || '',
            player.college || '',
            player.years_pro?.toString() || ''
        ]);

        const csvContent = [
            csvHeaders.join(','),
            ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTeam.abbreviation}_${selectedSeason}_roster.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    return (
        <div className="max-w-6xl mx-auto p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">WNBA Historical Rosters</h1>
                <p className="text-gray-600">Browse rosters from every WNBA season (1997-present)</p>
            </div>

            {/* Selectors */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Team Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Team
                        </label>
                        <select
                            value={selectedTeamId}
                            onChange={(e) => setSelectedTeamId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">Choose a team...</option>
                            <optgroup label="Active Teams">
                                {teams.filter(t => t.is_active).map(team => (
                                    <option key={team.id} value={team.id}>
                                        {team.display_name}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Historical Teams">
                                {teams.filter(t => !t.is_active).map(team => (
                                    <option key={team.id} value={team.id}>
                                        {team.display_name}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {/* Season Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Season
                        </label>
                        <select
                            value={selectedSeason || ''}
                            onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                            disabled={!selectedTeamId || availableSeasons.length === 0}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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

                {/* Team Info Banner */}
                {selectedTeam && selectedSeason && (
                    <div
                        className="mt-4 p-4 rounded-lg flex items-center gap-4"
                        style={{
                            backgroundColor: selectedTeam.primary_color + '15',
                            borderLeft: `4px solid ${selectedTeam.primary_color}`
                        }}
                    >
                        {selectedTeam.logo_url && (
                            <img
                                src={selectedTeam.logo_url}
                                alt={selectedTeam.display_name}
                                className="w-12 h-12 object-contain"
                            />
                        )}
                        <div>
                            <h3 className="font-semibold text-lg">{selectedTeam.display_name}</h3>
                            <p className="text-sm text-gray-600">{selectedSeason} Season • {roster.length} Players</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            {/* Roster Table */}
            {roster.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Player Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Position
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Height
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        College
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Years Pro
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {roster.map((player, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {player.jersey_number || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {player.player_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {player.position || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {player.height || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {player.college || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {player.years_pro ?? '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Action Buttons */}
                    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
                        <button
                            onClick={handleSaveToLibrary}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <Save size={18} />
                            Save to Library
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Download size={18} />
                            Export CSV
                        </button>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading roster...</p>
                </div>
            )}

            {/* Empty State */}
            {!loading && selectedTeamId && selectedSeason && roster.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <p className="text-gray-600">No roster data available for this selection.</p>
                    <p className="text-sm text-gray-500 mt-1">Try selecting a different season or team.</p>
                </div>
            )}
        </div>
    );
}
