import { createSignal, onMount, For, Show } from 'solid-js';
import { ComicIssueCard } from '../comic/ComicIssueCard';
import { DynamicBackground } from '../ui/DynamicBackground';
import { t } from '../../services/localization';
import { api } from '../../services/api';

/**
 * COMIC ARCHIVE
 * Visual collection of story assets and lore.
 */
export const ComicArchive = () => {
    const [issues, setIssues] = createSignal<any[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(async () => {
        try {
            const response = await api.archive.comics();
            if (response.success) {
                setIssues(response.data || []);
            }
        } finally {
            setIsLoading(false);
        }
    });

    return (
        <div class="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative">
            <DynamicBackground opacity={0.6} />
            
            <div class="flex-1 overflow-y-auto p-4 pb-32 relative z-10">
                <Show when={!isLoading()} fallback={
                    <div class="flex items-center justify-center py-20 opacity-20">
                         <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                }>
                    <div class="grid grid-cols-2 gap-4">
                        <For each={issues()}>
                            {(issue) => (
                                <ComicIssueCard 
                                    issueNumber={issue.issueNumber} 
                                    title={issue.title} 
                                    isLocked={issue.isLocked} 
                                />
                            )}
                        </For>
                    </div>

                    <div class="mt-8 p-4 bg-slate-900/50 rounded-xl border border-slate-800 text-center">
                        <p class="text-xs text-slate-500 font-bold uppercase tracking-widest">{t('LORE_COLLECT_MORE')}</p>
                    </div>
                    <div class="text-center py-10 opacity-20">
                        <div class="text-[0.5rem] font-black uppercase tracking-[0.5em]">{t('LORE_DB_TERM')}</div>
                    </div>
                </Show>
            </div>
        </div>
    );
};
