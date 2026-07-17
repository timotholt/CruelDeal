import { createSignal, onMount, Show, For } from 'solid-js';
import { StandardHeader } from '../ui/StandardHeader';
import { useUser } from '../../contexts/UserContext';
import { GameTextV3 as GameText } from '../ui/GameTextV3';
import { ModalFooter } from '../ui/ModalFooter';
import { t } from '../../services/localization';
import { api } from '../../services/api';

interface ProfileScreenProps {
    onExit: () => void;
}

export const ProfileScreen = (props: ProfileScreenProps) => {
    const { user } = useUser();
    const [stats, setStats] = createSignal<any>(null);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => {
        api.stats.account(user.id).then(response => {
            if (response.success) {
                setStats(response.data);
            }
            setIsLoading(false);
        });
    });

    const conquestWins = () => Object.values(user.deckStats).reduce((a, b: any) => a + b.conquestWins, 0);

    return (
        <div class="w-full h-full flex flex-col bg-transparent overflow-hidden relative text-white">
            <StandardHeader 
                title={`\u00A0\u00A0${t('PROF_TITLE')}`} 
                class="!pl-0.5 !pr-1"
                showCurrency={true}
            />

            <div class="flex-1 flex flex-col overflow-y-auto pb-8">
                {/* Profile Header Stats */}
                <div class="shrink-0 p-4 bg-gradient-to-b from-slate-900/80 to-transparent border-b border-white/5 mb-6">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-16 h-16 rounded-2xl bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.4)]">
                            <svg class="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" />
                            </svg>
                        </div>
                        <div class="flex-1">
                            <h2 class="text-2xl font-black text-white italic tracking-tighter uppercase leading-none mb-1">
                                {user.username}
                            </h2>
                            <div class="flex items-center gap-2">
                                <span class="text-[0.6rem] font-black text-indigo-400 uppercase tracking-widest">{t('PROF_GLOBAL_RANK')}: {user.rank}</span>
                                <div class="w-1 h-1 rounded-full bg-slate-700" />
                                <span class="text-[0.6rem] font-black text-indigo-400 uppercase tracking-widest">CL: {user.level}</span>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                         <StatBox label={t('PROF_COLLECTED')} value={user.collection.length.toString()} />
                         <StatBox label={t('PROF_CQ_WINS')} value={conquestWins().toString()} />
                    </div>
                </div>

                {/* Account performance */}
                <div class="px-4 space-y-4">
                    <Show when={!isLoading()} fallback={
                         <div class="flex items-center justify-center py-20 opacity-20">
                            <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    }>
                        <Show when={stats()}>
                            {(s) => (
                                <>
                                    <div class="bg-slate-900/40 border border-white/5 rounded-xl p-4">
                                        <h3 class="text-[0.6rem] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">{t('PROF_PERFORMANCE')}</h3>
                                        <div class="space-y-3">
                                            <div class="flex justify-between items-center">
                                                <span class="text-xs font-bold text-slate-300">{t('PROF_TOTAL_MATCHES')}</span>
                                                <span class="text-sm font-black italic">{s().totalMatches}</span>
                                            </div>
                                            <div class="flex justify-between items-center">
                                                <span class="text-xs font-bold text-slate-300">{t('PROF_WIN_RATE')}</span>
                                                <span class="text-sm font-black italic text-emerald-400">{s().winRate}</span>
                                            </div>
                                            <div class="flex justify-between items-center">
                                                <span class="text-xs font-bold text-slate-300">{t('PROF_FASTEST')}</span>
                                                <span class="text-sm font-black italic">{t('GAME_TURN')} {s().fastestWinTurn}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="bg-slate-900/40 border border-white/5 rounded-xl p-4">
                                        <h3 class="text-[0.6rem] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">{t('PROF_MILESTONES')}</h3>
                                        <div class="space-y-3">
                                            <For each={s().milestones || []}>
                                                {(m: any) => (
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-6 h-6 rounded bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">{m.icon}</div>
                                                        <span class="text-xs font-bold text-slate-300">{m.text}</span>
                                                    </div>
                                                )}
                                            </For>
                                        </div>
                                    </div>
                                </>
                            )}
                        </Show>
                    </Show>
                </div>
            </div>

            <ModalFooter onClose={props.onExit} />
        </div>
    );
};

const StatBox = (props: { label: string, value: string }) => (
    <div class="bg-white/5 border border-white/5 rounded-lg p-2 flex flex-col items-center">
        <span class="text-[0.45rem] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{props.label}</span>
        <div class="h-6 w-full">
            <GameText text={props.value} baseFontSize={1.1} class="text-white font-black italic tracking-tighter" />
        </div>
    </div>
);
