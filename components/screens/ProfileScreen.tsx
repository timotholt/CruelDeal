
import React, { useState, useEffect } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { useUser } from '../../contexts/UserContext';
import { GameText } from '../ui/GameText';
import { ModalFooter } from '../ui/ModalFooter';
import { t } from '../../services/localization';
import { api } from '../../services/api';

interface ProfileScreenProps {
    onExit: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onExit }) => {
    const { user } = useUser();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.stats.account(user.id).then(response => {
            if (response.success) {
                setStats(response.data);
            }
            setIsLoading(false);
        });
    }, [user.id]);

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
            <StandardHeader 
                title={`\u00A0\u00A0${t('PROF_TITLE')}`} 
                className="!pl-0.5 !pr-1"
                showCurrency={true}
            />

            <div className="flex-1 flex flex-col overflow-y-auto pb-8">
                {/* Profile Header Stats */}
                <div className="shrink-0 p-4 bg-gradient-to-b from-slate-900/80 to-transparent border-b border-white/5 mb-6">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-1">
                                {user.username}
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[0.6rem] font-black text-indigo-400 uppercase tracking-widest">{t('PROF_GLOBAL_RANK')}: {user.rank}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-700" />
                                <span className="text-[0.6rem] font-black text-indigo-400 uppercase tracking-widest">CL: {user.level}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                         <StatBox label={t('PROF_COLLECTED')} value={user.collection.length.toString()} />
                         <StatBox label={t('PROF_CQ_WINS')} value={Object.values(user.deckStats).reduce((a, b: any) => a + b.conquestWins, 0).toString()} />
                    </div>
                </div>

                {/* Account performance */}
                <div className="px-4 space-y-4">
                    {isLoading ? (
                         <div className="flex items-center justify-center py-20 opacity-20">
                            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : stats ? (
                        <>
                            <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4">
                                <h3 className="text-[0.6rem] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">{t('PROF_PERFORMANCE')}</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-300">{t('PROF_TOTAL_MATCHES')}</span>
                                        <span className="text-sm font-black italic">{stats.totalMatches}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-300">{t('PROF_WIN_RATE')}</span>
                                        <span className="text-sm font-black italic text-emerald-400">{stats.winRate}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-300">{t('PROF_FASTEST')}</span>
                                        <span className="text-sm font-black italic">{t('GAME_TURN')} {stats.fastestWinTurn}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4">
                                <h3 className="text-[0.6rem] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">{t('PROF_MILESTONES')}</h3>
                                <div className="space-y-3">
                                    {(stats.milestones || []).map((m: any, i: number) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <div className="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">{m.icon}</div>
                                            <span className="text-xs font-bold text-slate-300">{m.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            <ModalFooter onClose={onExit} />
        </div>
    );
};

const StatBox = ({ label, value }: { label: string, value: string }) => (
    <div className="bg-white/5 border border-white/5 rounded-lg p-2 flex flex-col items-center">
        <span className="text-[0.45rem] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{label}</span>
        <div className="h-6 w-full">
            <GameText text={value} baseFontSize={1.1} className="text-white font-black italic tracking-tighter" />
        </div>
    </div>
);
