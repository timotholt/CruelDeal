
import React, { useState, useEffect } from 'react';
import { ComicIssueCard } from '../comic/ComicIssueCard';
import { DynamicBackground } from '../ui/DynamicBackground';
import { t } from '../../services/localization';
import { api } from '../../services/api';

export const ComicArchive: React.FC = () => {
    const [issues, setIssues] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        api.archive.comics().then(response => {
            if (response.success) {
                setIssues(response.data || []);
            }
            setIsLoading(false);
        });
    }, []);

    return (
        <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative">
            <DynamicBackground opacity={0.6} />
            
            <div className="flex-1 overflow-y-auto p-4 pb-32 relative z-10">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 opacity-20">
                         <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {issues.map(issue => (
                            <ComicIssueCard 
                                key={issue.issueNumber} 
                                issueNumber={issue.issueNumber} 
                                title={issue.title} 
                                isLocked={issue.isLocked} 
                            />
                        ))}
                    </div>
                )}
                 
                 {!isLoading && (
                    <>
                        <div className="mt-8 p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{t('LORE_COLLECT_MORE')}</p>
                        </div>
                        <div className="text-center py-10 opacity-20">
                            <div className="text-[0.5rem] font-black uppercase tracking-[0.5em]">{t('LORE_DB_TERM')}</div>
                        </div>
                    </>
                 )}
            </div>
        </div>
    );
};
