import { createSignal, onMount, For, Show } from 'solid-js';
import { GameTextV3 as GameText } from '../ui/GameTextV3';
import { DynamicBackground } from '../ui/DynamicBackground';
import { api } from '../../services/api';
import { useUser } from '../../contexts/UserContext';

interface StashItemProps {
    title: string;
    count: number;
    icon: any;
}

const StashItem = (props: StashItemProps) => (
    <div class="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-xl p-4 flex items-center justify-between group cursor-pointer hover:bg-slate-800 transition-colors">
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                {props.icon}
            </div>
            <div>
                <h4 class="text-sm font-black text-white uppercase tracking-tight">{props.title}</h4>
                <p class="text-[0.6rem] text-slate-500 font-bold uppercase tracking-widest">Available In Stash</p>
            </div>
        </div>
        <div class="text-right">
            <div class="h-6 w-12">
                <GameText text={props.count.toString()} baseFontSize={1.1} class="text-white font-black italic" />
            </div>
        </div>
    </div>
);

export const InventoryStash = () => {
    const userContext = useUser();
    const [stash, setStash] = createSignal<any[]>([]);
    const [isLoading, setIsLoading] = createSignal(true);

    onMount(() => {
        api.archive.inventory(userContext.user.id).then(response => {
            if (response.success) {
                setStash(response.data || []);
            }
            setIsLoading(false);
        });
    });

    const getIcon = (type: string) => {
        switch(type) {
            case 'BOX': return <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
            case 'TICKET': return <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H6a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
            case 'BACK': return <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>;
            default: return null;
        }
    };

    return (
        <div class="w-full h-full flex flex-col bg-slate-950 overflow-hidden relative">
            <DynamicBackground opacity={0.6} />

            <div class="flex-1 overflow-y-auto p-4 space-y-3 pb-32 relative z-10">
                <Show when={!isLoading()} fallback={
                    <div class="flex items-center justify-center py-20 opacity-20">
                         <div class="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                }>
                    <For each={stash()}>
                        {(item) => (
                            <StashItem 
                                title={item.title} 
                                count={item.count} 
                                icon={getIcon(item.iconType)}
                            />
                        )}
                    </For>
                </Show>

                <Show when={!isLoading()}>
                    <div class="pt-8 text-center opacity-30">
                        <p class="text-[0.55rem] font-bold text-slate-600 uppercase tracking-[0.4em]">End of Storage Log</p>
                    </div>
                </Show>
            </div>
        </div>
    );
};
