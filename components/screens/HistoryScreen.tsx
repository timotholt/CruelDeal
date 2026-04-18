
import React, { useState, useMemo, useEffect } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { BattleLogItem } from '../history/BattleLogItem';
import { ModalFooter } from '../ui/ModalFooter';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

interface HistoryScreenProps {
    onExit: () => void;
}

type ResultFilter = 'ALL' | 'VICTORY' | 'DEFEAT' | 'DRAW';
type ModeFilter = 'ALL' | 'CONQUEST' | 'LADDER';

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onExit }) => {
    const { user } = useUser();
    const [resFilter, setResFilter] = useState<ResultFilter>('ALL');
    const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL');
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        api.stats.history(user.id).then(response => {
            if (response.success) {
                setLogs(response.data || []);
            }
            setIsLoading(false);
        });
    }, [user.id]);

    const filteredLogs = useMemo(() => logs.filter(log => {
        const matchesRes = resFilter === 'ALL' || log.res === resFilter;
        const matchesMode = modeFilter === 'ALL' || log.mode === modeFilter;
        return matchesRes && matchesMode;
    }), [logs, resFilter, modeFilter]);

    const resultFilters: { label: string; value: ResultFilter }[] = [
        { label: t('HIST_ALL'), value: 'ALL' },
        { label: t('HIST_WIN'), value: 'VICTORY' },
        { label: t('HIST_LOSS'), value: 'DEFEAT' },
        { label: t('HIST_TIE'), value: 'DRAW' },
    ];

    const modeFilters: { label: string; value: ModeFilter; icon?: React.ReactNode }[] = [
        { label: t('HIST_ALL'), value: 'ALL' },
        { 
            label: t('HIST_CONQUEST'), 
            value: 'CONQUEST',
            icon: (
                <svg className="w-3.5 h-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l7-7m-7 7l-4 4-4-4 7-7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l-7 7m7-7l4-4 4 4-7 7z" />
                </svg>
            )
        },
        { 
            label: t('HIST_LADDER'), 
            value: 'LADDER',
            icon: (
                <svg className="w-3.5 h-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v18M16 3v18M8 7h8M8 12h8M8 17h8" />
                </svg>
            )
        },
    ];

    const tightButtonClass = "[&_div.z-20]:!px-0 min-w-[1.8rem] !px-0 shadow-none border-white/10";

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden">
            <StandardHeader title={`\u00A0\u00A0${t('HIST_TITLE')}`} />
            
            <div className="shrink-0 z-10 flex flex-col pt-4">
                <div className="flex items-center justify-between px-5 pb-2">
                    <div className="flex gap-0.5">
                        {resultFilters.map((f) => (
                            <SlantedButton 
                                key={f.value}
                                variant={resFilter === f.value ? 'primary' : 'ghost'}
                                size="xs"
                                onClick={() => setResFilter(f.value)}
                                className={`!h-6 ${tightButtonClass}`}
                            >
                                <span className="text-[0.6rem] font-black tracking-tighter">{f.label}</span>
                            </SlantedButton>
                        ))}
                    </div>

                    <div className="flex gap-0.5">
                        {modeFilters.map((f) => (
                            <SlantedButton 
                                key={f.value}
                                variant={modeFilter === f.value ? 'blue' : 'ghost'}
                                size="xs"
                                onClick={() => setModeFilter(f.value)}
                                className={`!h-6 ${tightButtonClass} ${f.icon ? 'min-w-[1.4rem]' : ''}`}
                            >
                                {f.icon ? (
                                    <div className="flex items-center justify-center w-full h-full scale-[0.85]">
                                        {f.icon}
                                    </div>
                                ) : (
                                    <span className="text-[0.6rem] font-black tracking-tighter">{f.label}</span>
                                )}
                            </SlantedButton>
                        ))}
                    </div>
                </div>

                <div className="mt-2 px-6 pb-2 text-center whitespace-nowrap overflow-hidden">
                    <h2 className="text-[0.55rem] font-black text-white uppercase tracking-[0.4em] italic leading-none inline-block">
                        {t('HIST_LIMIT_NOTE')}
                    </h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 pb-24">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 opacity-20">
                         <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((game, i) => (
                        <BattleLogItem 
                            key={i}
                            result={game.res as any}
                            opponent={game.opp}
                            mode={game.mode as any}
                            date={game.date}
                            time={game.time}
                            score={game.score}
                            cubes={game.cubes}
                        />
                    ))
                ) : (
                    <div className="text-center py-20 opacity-30">
                        <p className="text-[0.6rem] font-black text-slate-500 uppercase tracking-widest italic">No matching records found</p>
                    </div>
                )}
                
                {!isLoading && (
                    <div className="text-center py-10">
                        <div className="inline-block h-1 w-12 bg-white/5 rounded-full mb-4"></div>
                        <p className="text-[0.55rem] text-slate-700 font-bold uppercase tracking-[0.4em]">{t('HIST_END')}</p>
                    </div>
                )}
            </div>

            <ModalFooter onClose={onExit} />
        </div>
    );
};
