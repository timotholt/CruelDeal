import { createSignal, onMount, Show, For } from 'solid-js';
import { StandardHeader } from '../ui/StandardHeader';
import { ModalFooter } from '../ui/ModalFooter';
import { HexBadge } from '../ui/HexBadge';
import { t } from '../../services/localization';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

interface LadderRankingScreenProps {
    onExit: () => void;
}

export const LadderRankingScreen = (props: LadderRankingScreenProps) => {
    const { user } = useUser();
    const [leaders, setLeaders] = createSignal<any[]>([]);
    const [personalStats, setPersonalStats] = createSignal<any>(null);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => {
        Promise.all([
            api.ranking.leaderboard(),
            api.ranking.personal(user.id)
        ]).then(([leadersRes, personalRes]) => {
            if (leadersRes.success) setLeaders(leadersRes.data || []);
            if (personalRes.success) setPersonalStats(personalRes.data);
            setIsLoading(false);
        });
    });

    return (
        <div class="w-full h-full flex flex-col bg-transparent overflow-hidden">
            <StandardHeader title={"\u00A0\u00A0LADDER RANK"} />
            
            <div class="flex-1 overflow-y-auto p-4 space-y-3 pb-12">
                <div class="text-center py-4">
                    <h2 class="text-[0.65rem] font-black text-indigo-400 uppercase tracking-[0.4em] mb-1">Season 14 Top Commanders</h2>
                    <div class="w-12 h-0.5 bg-indigo-500/30 mx-auto rounded-full" />
                </div>

                <Show when={!isLoading()} fallback={
                    <div class="flex items-center justify-center py-20 opacity-20">
                         <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                }>
                    <div class="space-y-2">
                        <For each={leaders()}>
                            {(leader) => (
                                <div class="bg-slate-900/60 border border-white/5 rounded-xl p-3 flex items-center gap-4 group hover:bg-slate-800 transition-colors">
                                    <div class="w-8 shrink-0 flex justify-center">
                                        <span class={`text-lg font-black italic ${leader.rank <= 3 ? 'text-yellow-400' : 'text-slate-500'}`}>
                                            #{leader.rank}
                                        </span>
                                    </div>
                                    
                                    <div class="w-10 h-10 rounded-full bg-indigo-950 border border-indigo-500/30 flex items-center justify-center text-xl shadow-inner">
                                        {leader.avatar}
                                    </div>

                                    <div class="flex-1">
                                        <div class="text-sm font-black text-white uppercase tracking-tight italic">{leader.name}</div>
                                        <div class="text-[0.6rem] font-bold text-slate-500 uppercase tracking-widest">Global Master</div>
                                    </div>

                                    <div class="text-right shrink-0">
                                        <div class="text-sm font-black text-indigo-400 italic tabular-nums">{leader.score.toLocaleString()}</div>
                                        <div class="text-[0.5rem] font-black text-slate-600 uppercase tracking-widest">PTS</div>
                                    </div>
                                </div>
                            )}
                        </For>
                    </div>

                    <Show when={personalStats()}>
                        {(stats) => (
                            <div class="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between animate-pop">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10">
                                        <HexBadge variant="primary" size="sm" glow>{stats().rank}</HexBadge>
                                    </div>
                                    <div>
                                        <div class="text-xs font-black text-white uppercase italic">{t('LADDER_YOU')}</div>
                                        <div class="text-[0.55rem] font-bold text-indigo-300 uppercase tracking-widest">{stats().percentile}</div>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="text-xs font-black text-white italic">{stats().points} PTS</div>
                                </div>
                            </div>
                        )}
                    </Show>
                </Show>
            </div>

            <ModalFooter onClose={props.onExit} />
        </div>
    );
};
