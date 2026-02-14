import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase.ts';
import {
    Library,
    Search,
    Globe,
    Trophy,
    ChevronRight,
    ChevronDown,
    History,
    Info,
    ExternalLink
} from 'lucide-react';

interface RosterDirectoryEntry {
    league: string;
    team_name: string;
    team_id: string;
    seasons_list: number[];
}

interface LeagueGroup {
    league: string;
    teams: {
        name: string;
        seasons: number[];
    }[];
}

const RosterDirectory: React.FC = () => {
    const [data, setData] = useState<LeagueGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedLeagues, setExpandedLeagues] = useState<string[]>([]);

    useEffect(() => {
        fetchDirectory();
    }, []);

    const fetchDirectory = async () => {
        setLoading(true);
        const { data: rawData, error } = await supabase
            .from('roster_directory_view')
            .select('*')
            .order('league', { ascending: true })
            .order('team_name', { ascending: true })
            .limit(10000);

        if (error) {
            console.error('Error fetching directory:', error);
            setLoading(false);
            return;
        }

        // Result is already aggregated per team from the view
        const leagueMap = new Map<string, { name: string, seasons: number[] }[]>();

        (rawData as RosterDirectoryEntry[]).forEach(entry => {
            if (!leagueMap.has(entry.league)) {
                leagueMap.set(entry.league, []);
            }
            leagueMap.get(entry.league)!.push({
                name: entry.team_name,
                seasons: entry.seasons_list
            });
        });

        const groups: LeagueGroup[] = [];
        leagueMap.forEach((teams, league) => {
            groups.push({ league, teams });
        });

        setData(groups);
        setLoading(false);
        // Expand first few by default
        if (groups.length > 0) setExpandedLeagues([groups[0].league]);
    };

    const toggleLeague = (league: string) => {
        setExpandedLeagues(prev =>
            prev.includes(league) ? prev.filter(l => l !== league) : [...prev, league]
        );
    };

    const formatSeasonRanges = (years: (number | null)[]): string => {
        const validYears = years.filter((y): y is number => y !== null && y !== undefined);
        if (validYears.length === 0) return 'Coming Soon';

        const sorted = [...new Set(validYears)].sort((a, b) => a - b);
        const ranges: string[] = [];
        let start = sorted[0];
        let end = sorted[0];

        for (let i = 1; i <= sorted.length; i++) {
            if (i < sorted.length && sorted[i] === end + 1) {
                end = sorted[i];
            } else {
                ranges.push(start === end ? `${start}` : `${start}-${end}`);
                if (i < sorted.length) {
                    start = sorted[i];
                    end = sorted[i];
                }
            }
        }
        return ranges.join(', ');
    };

    const filteredData = data.map(group => ({
        ...group,
        teams: group.teams.filter(team =>
            team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            group.league.toLowerCase().includes(searchTerm.toLowerCase())
        )
    })).filter(group => group.teams.length > 0);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-gray-900 p-8 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Library size={120} />
                </div>
                <div className="relative z-10 flex items-center gap-6">
                    <div className="p-4 bg-[#5B5FFF]/10 rounded-xl text-[#5B5FFF]">
                        <Library size={32} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight uppercase">Roster Directory</h1>
                        <p className="text-gray-500 font-medium">Complete coverage of all supported leagues, teams, and historical seasons.</p>
                    </div>
                </div>

                <div className="relative z-10 w-full md:w-72">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <Search size={18} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search teams or leagues..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl focus:ring-2 focus:ring-[#5B5FFF] font-medium outline-none transition-all dark:text-white"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-6">
                    <div className="w-16 h-16 border-4 border-[#5B5FFF] border-t-transparent rounded-full animate-spin shadow-lg"></div>
                    <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Scanning Database Coverage...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {filteredData.map((group, idx) => (
                        <div key={idx} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <button
                                onClick={() => toggleLeague(group.league)}
                                className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-[#5B5FFF]/5 flex items-center justify-center text-[#5B5FFF]">
                                        {group.league.includes('NCAA') ? <Trophy size={20} /> : <Globe size={20} />}
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">{group.league}</h3>
                                        <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{group.teams.length} Teams Matched</p>
                                    </div>
                                </div>
                                {expandedLeagues.includes(group.league) ? <ChevronDown size={24} className="text-gray-300" /> : <ChevronRight size={24} className="text-gray-300" />}
                            </button>

                            {expandedLeagues.includes(group.league) && (
                                <div className="border-t border-gray-50 dark:border-gray-800 animate-in slide-in-from-top-2 duration-300">
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead className="bg-gray-50/50 dark:bg-gray-800/10">
                                                <tr>
                                                    <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800/50">Team Name</th>
                                                    <th className="px-8 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800/50">Seasons Available</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                                {group.teams.map((team, tIdx) => (
                                                    <tr key={tIdx} className="group hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all">
                                                        <td className="px-8 py-4">
                                                            <span className="font-bold text-gray-700 dark:text-gray-200 group-hover:text-[#5B5FFF] transition-colors">{team.name}</span>
                                                        </td>
                                                        <td className="px-8 py-4">
                                                            <span className="font-bold text-gray-500 dark:text-gray-400 text-sm">
                                                                {formatSeasonRanges(team.seasons)}
                                                                {team.seasons.filter(y => y !== null).length === 1 && (
                                                                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] uppercase tracking-tighter opacity-50">Single Year</span>
                                                                )}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {filteredData.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-800">
                            <Info size={48} className="text-gray-200 mb-4" />
                            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm text-center px-8">No matching records found in the directory.</p>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-[#5B5FFF] p-8 rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-[#5B5FFF]/20">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl">
                        <Trophy size={24} />
                    </div>
                    <div>
                        <h4 className="text-lg font-black uppercase tracking-tight">Need specific season data?</h4>
                        <p className="text-white/70 text-sm font-medium">Our archive is updated weekly with new historical rosters.</p>
                    </div>
                </div>
                <button
                    onClick={() => window.location.href = 'mailto:support@rostersync.io'}
                    className="px-6 py-3 bg-white text-[#5B5FFF] rounded-xl font-bold text-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                >
                    Contact Support <ExternalLink size={16} />
                </button>
            </div>
        </div>
    );
};

export default RosterDirectory;
