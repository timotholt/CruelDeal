
import React, { useState, useEffect } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { ModalFooter } from '../ui/ModalFooter';
import { HexBadge } from '../ui/HexBadge';
import { t } from '../../services/localization';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

interface LadderRankingScreenProps {
    onExit: () => void;
}

export const LadderRankingScreen: React.FC<LadderRankingScreenProps> = ({ onExit }) => {
    const { user } = useUser();
    const [leaders, setLeaders] = useState<any[]>([]);
    const [personalStats, setPersonalStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.ranking.leaderboard(),
            api.ranking.personal(user.id)
        ]).then(([leadersRes, personalRes]) => {
            if (leadersRes.success) setLeaders(leadersRes.data || []);
            if (personalRes.success) setPersonalStats(personalRes.data);
            setIsLoading(false);
        });
    }, [user.id]);

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden">
            <StandardHeader title={"\u00A0\u00A0LADDER RANK"} />
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-12">
                <div className="text-center py-4">
                    <h2 className="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">Season 14 Top Commanders</h2>
                    <div className="w-12 h-0.5 bg-indigo-500/30 mx-auto rounded-full" />
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-20 opacity-20">
                         <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="space-y-2">
                            {leaders.map((leader) => (
                                <div key={leader.rank} className="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex items-center gap-4 group hover:bg-slate-800 transition-colors">
                                    <div className="w-8 shrink-0 flex justify-center">
                                        <span className={`text-lg font-black italic ${leader.rank <= 3 ? 'text-yellow-400' : 'text-slate-500'}`}>
                                            #{leader.rank}
                                        </span>
                                    </div>
                                    
                                    <div className="w-10 h-10 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-xl shadow-inner">
                                        {leader.avatar}
                                    </div>

                                    <div className="flex-1">
                                        <div className="text-sm font-black text-white uppercase tracking-tight italic">{leader.name}</div>
                                        <div className="text-[0.6rem] font-bold text-slate-500 uppercase tracking-widest">Global Master</div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-black text-indigo-400 italic tabular-nums">{leader.score.toLocaleString()}</div>
                                        <div className="text-[0.5rem] font-black text-slate-600 uppercase tracking-widest">PTS</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {personalStats && (
                            <div className="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between animate-pop">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10">
                                        <HexBadge variant="primary" size="sm" glow>{personalStats.rank}</HexBadge>
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-white uppercase italic">{t('LADDER_YOU')}</div>
                                        <div className="text-[0.55rem] font-bold text-indigo-300 uppercase tracking-widest">{personalStats.percentile}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-white italic">{personalStats.points} PTS</div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <ModalFooter onClose={onExit} />
        </div>
    );
};
