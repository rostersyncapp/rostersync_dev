import React from 'react';
import { X, Shield } from 'lucide-react';

interface CandidateTeam {
    name: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    sport?: string;
    league?: string;
}

interface TeamSelectionModalProps {
    isOpen: boolean;
    candidates: CandidateTeam[];
    onSelect: (team: CandidateTeam) => void;
    onClose: () => void;
}

export const TeamSelectionModal: React.FC<TeamSelectionModalProps> = ({
    isOpen,
    candidates,
    onSelect,
    onClose
}) => {
    if (!isOpen || candidates.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl animate-in zoom-in duration-300 border border-gray-100 dark:border-gray-800">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4">
                        <Shield size={32} />
                    </div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Multiple Teams Found
                    </h3>
                    <p className="text-sm text-gray-500 font-medium mt-2">
                        Please select the correct team to apply branding
                    </p>
                </div>

                <div className="grid gap-3">
                    {candidates.map((team, index) => (
                        <button
                            key={index}
                            onClick={() => onSelect(team)}
                            className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-[#5B5FFF] hover:bg-[#5B5FFF]/5 transition-all group"
                            style={{
                                '--team-primary': team.primaryColor,
                                '--team-secondary': team.secondaryColor
                            } as React.CSSProperties}
                        >
                            <div
                                className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden"
                                style={{ backgroundColor: team.primaryColor + '20' }}
                            >
                                <img
                                    src={team.logoUrl}
                                    alt={team.name}
                                    className="w-10 h-10 object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                />
                            </div>
                            <div className="flex-1 text-left">
                                <div className="font-bold text-gray-900 dark:text-white group-hover:text-[#5B5FFF] transition-colors">
                                    {team.name}
                                </div>
                                {team.league && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mt-0.5">
                                        {team.league}
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <div
                                        className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600"
                                        style={{ backgroundColor: team.primaryColor }}
                                        title="Primary Color"
                                    />
                                    <div
                                        className="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-600"
                                        style={{ backgroundColor: team.secondaryColor }}
                                        title="Secondary Color"
                                    />
                                    <span className="text-xs text-gray-400 font-mono ml-1">
                                        {team.primaryColor}
                                    </span>
                                </div>
                            </div>
                            <div className="text-gray-300 dark:text-gray-600 group-hover:text-[#5B5FFF] transition-colors">
                                →
                            </div>
                        </button>
                    ))}
                </div>

                <p className="text-xs text-gray-400 text-center mt-6">
                    Tip: Type the full team name (e.g., "Sacramento Kings") to avoid this prompt
                </p>
            </div>
        </div>
    );
};

export default TeamSelectionModal;
