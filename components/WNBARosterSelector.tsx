import React, { useState, useEffect } from 'react';
import { Download, Users, Calendar, ChevronDown, Loader2, Search } from 'lucide-react';
import { 
  getWNBATeams, 
  getWNBATeamSeasons, 
  getWNBARosterData,
  convertWNBAPlayersToAthletes,
  getWNBATeamMetadata,
  WNBATeam,
  WNBAPlayer 
} from '../services/wnbaData';
import { generateExport, downloadFile } from '../services/export';
import { ExportFormat, SubscriptionTier } from '../types';

interface WNBARosterSelectorProps {
  subscriptionTier?: SubscriptionTier;
  onRosterSelect?: (athletes: any[], teamName: string, metadata: any) => void;
}

const EXPORT_FORMATS: { value: ExportFormat; label: string; requiresTier: SubscriptionTier }[] = [
  { value: 'CSV_FLAT', label: 'CSV (Flat)', requiresTier: 'BASIC' },
  { value: 'ICONIK_JSON', label: 'Iconik JSON', requiresTier: 'PRO' },
  { value: 'CATDV_JSON', label: 'CatDV JSON', requiresTier: 'PRO' },
  { value: 'ROSS_XML', label: 'Ross XML', requiresTier: 'PRO' },
  { value: 'VIZRT_JSON', label: 'Vizrt JSON', requiresTier: 'PRO' },
  { value: 'VIZRT_XML', label: 'Vizrt XML', requiresTier: 'NETWORK' },
  { value: 'VIZRT_DATACENTER_CSV', label: 'Vizrt DataCenter CSV', requiresTier: 'NETWORK' },
  { value: 'CHYRON_CSV', label: 'Chyron CSV', requiresTier: 'STUDIO' },
  { value: 'NEWBLUE_CSV', label: 'NewBlue CSV', requiresTier: 'STUDIO' },
  { value: 'TAGBOARD_CSV', label: 'Tagboard CSV', requiresTier: 'STUDIO' },
];

export function WNBARosterSelector({ 
  subscriptionTier = 'BASIC',
  onRosterSelect 
}: WNBARosterSelectorProps) {
  const [teams, setTeams] = useState<WNBATeam[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<WNBATeam | null>(null);
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [players, setPlayers] = useState<WNBAPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('CSV_FLAT');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch teams on mount
  useEffect(() => {
    loadTeams();
  }, []);

  // Fetch available seasons when team is selected
  useEffect(() => {
    if (selectedTeam) {
      loadTeamSeasons(selectedTeam.id);
    } else {
      setAvailableSeasons([]);
      setSelectedSeason(null);
    }
  }, [selectedTeam]);

  // Fetch roster when team and season are selected
  useEffect(() => {
    if (selectedTeam && selectedSeason) {
      loadRoster(selectedTeam.id, selectedSeason);
    }
  }, [selectedTeam, selectedSeason]);

  const loadTeams = async () => {
    try {
      setLoadingTeams(true);
      const data = await getWNBATeams();
      setTeams(data);
    } catch (err) {
      setError('Failed to load WNBA teams');
      console.error(err);
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadTeamSeasons = async (teamId: string) => {
    try {
      const seasons = await getWNBATeamSeasons(teamId);
      setAvailableSeasons(seasons);
      // Default to most recent season
      if (seasons.length > 0) {
        setSelectedSeason(seasons[0]);
      }
    } catch (err) {
      console.error('Failed to load seasons:', err);
      setAvailableSeasons([]);
    }
  };

  const loadRoster = async (teamId: string, season: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getWNBARosterData(teamId, season);
      setPlayers(data.players);
      
      // Notify parent component
      if (onRosterSelect) {
        const athletes = convertWNBAPlayersToAthletes(data.players, season);
        const metadata = getWNBATeamMetadata(data.team);
        onRosterSelect(athletes, data.team.display_name, metadata);
      }
    } catch (err) {
      setError('Failed to load roster data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!selectedTeam || !selectedSeason || players.length === 0) return;

    const athletes = convertWNBAPlayersToAthletes(players, selectedSeason);
    const metadata = getWNBATeamMetadata(selectedTeam);

    const exportData = generateExport(
      athletes,
      selectedFormat,
      selectedTeam.display_name,
      'EN',
      subscriptionTier,
      metadata.primaryColor,
      metadata.secondaryColor
    );

    downloadFile(exportData.content, exportData.filename, exportData.mimeType);
    setShowExportMenu(false);
  };

  const filteredPlayers = players.filter(player => 
    player.player_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (player.jersey_number && player.jersey_number.includes(searchTerm)) ||
    (player.position && player.position.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const availableFormats = EXPORT_FORMATS.filter(
    format => isTierAllowed(format.requiresTier, subscriptionTier)
  );

  function isTierAllowed(required: SubscriptionTier, current: SubscriptionTier): boolean {
    const tiers: SubscriptionTier[] = ['BASIC', 'PRO', 'STUDIO', 'NETWORK'];
    return tiers.indexOf(current) >= tiers.indexOf(required);
  }

  if (loadingTeams) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading WNBA teams...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-pink-600" />
          WNBA Historical Rosters
        </h2>
        <p className="text-gray-600 mt-1">
          Browse and export WNBA rosters from 1997 to present
        </p>
      </div>

      {/* Team and Season Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Team Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Team
          </label>
          <select
            value={selectedTeam?.id || ''}
            onChange={(e) => {
              const team = teams.find(t => t.id === e.target.value);
              setSelectedTeam(team || null);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
          >
            <option value="">Choose a team...</option>
            <optgroup label="Active Teams">
              {teams.filter(t => t.is_active).map(team => (
                <option key={team.id} value={team.id}>
                  {team.display_name}
                </option>
              ))}
            </optgroup>
            {teams.filter(t => !t.is_active).length > 0 && (
              <optgroup label="Historical Teams">
                {teams.filter(t => !t.is_active).map(team => (
                  <option key={team.id} value={team.id}>
                    {team.display_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Season Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Season Year
          </label>
          <select
            value={selectedSeason || ''}
            onChange={(e) => setSelectedSeason(Number(e.target.value))}
            disabled={!selectedTeam || availableSeasons.length === 0}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">
              {!selectedTeam ? 'Select a team first' : 
               availableSeasons.length === 0 ? 'No data available' : 'Choose season...'}
            </option>
            {availableSeasons.map(year => (
              <option key={year} value={year}>
                {year} Season
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Roster Display */}
      {selectedTeam && selectedSeason && (
        <div className="space-y-4">
          {/* Header with Team Info and Export */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center gap-4">
              {selectedTeam.logo_url && (
                <img 
                  src={selectedTeam.logo_url} 
                  alt={selectedTeam.display_name}
                  className="w-16 h-16 object-contain"
                />
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {selectedTeam.display_name}
                </h3>
                <p className="text-gray-600">
                  {selectedSeason} Season • {players.length} Players
                </p>
              </div>
            </div>

            {/* Export Controls */}
            <div className="flex items-center gap-2">
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500"
              >
                {availableFormats.map(format => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleExport}
                disabled={players.length === 0 || loading}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search players by name, number, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              <span className="ml-2 text-gray-600">Loading roster...</span>
            </div>
          )}

          {/* Players Table */}
          {!loading && filteredPlayers.length > 0 && (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Jersey
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
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
                      Experience
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredPlayers.map((player, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.jersey_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {player.player_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.position || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.height || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.college || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.years_pro !== undefined ? `${player.years_pro} years` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredPlayers.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">
                {searchTerm ? 'No players match your search.' : 'No roster data available for this season.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Initial State - No Selection */}
      {!selectedTeam && (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            Select a team and season to view historical roster data
          </p>
        </div>
      )}
    </div>
  );
}

export default WNBARosterSelector;
