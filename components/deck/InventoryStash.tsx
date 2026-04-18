
import React, { useState, useEffect } from 'react';
import { GameText } from '../ui/GameText';
import { DynamicBackground } from '../ui/DynamicBackground';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

interface StashItemProps {
    title: string;
    count: number;
    icon: React.ReactNode;
}

const StashItem: React.FC<StashItemProps> = ({ title, count, icon }) => (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-4 flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-colors">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">{title}</h4>
                <p className="text-[0.6rem] text-slate-500 font-bold uppercase tracking-widest">Available In Stash</p>
            </div>
        </div>
        <div className="text-right">
            <div className="h-6 w-12">
                <GameText text={count.toString()} baseFontSize={1.1} className="text-white font-black italic" />
            </div>
        </div>
    </div>
);

export const InventoryStash: React.FC = () => {
    const { user } = useUser();
    const [stash, setStash] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.archive.inventory(user.id).then(response => {
            if (response.success) {
                setStash(response.data || []);
            }
            setIsLoading(false);
        });
    }, [user.id]);

    const getIcon = (type: string) => {
        switch(type) {
            case 'BOX': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
            case 'TICKET': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H6a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
            case 'BACK': return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
            default: return null;
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative">
            <DynamicBackground opacity={0.6} />

            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-32 relative z-10">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 opacity-20">
                         <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    stash.map(item => (
                        <StashItem 
                            key={item.id}
                            title={item.title} 
                            count={item.count} 
                            icon={getIcon(item.iconType)}
                        />
                    ))
                )}

                {!isLoading && (
                    <div className="pt-8 text-center opacity-30">
                        <p className="text-[0.55rem] font-bold text-slate-600 uppercase tracking-[0.4em]">End of Storage Log</p>
                    </div>
                )}
            </div>
        </div>
    );
};
