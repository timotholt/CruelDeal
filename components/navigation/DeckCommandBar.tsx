import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import { useUser, CollectionSortOption } from '../../contexts/UserContext';
import { SlantedButton } from '../ui/SlantedButton';
import { t } from '../../services/localization';

interface DeckCommandBarProps {
    isActive: boolean;
}

export const DeckCommandBar = (props: DeckCommandBarProps) => {
    const user = useUser();

    const [showSortMenu, setShowSortMenu] = createSignal(false);
    const [showFilterMenu, setShowFilterMenu] = createSignal(false);

    createEffect(() => {
        if (!props.isActive) {
            const timer = setTimeout(() => {
                setShowSortMenu(false);
                setShowFilterMenu(false);
            }, 0);
            onCleanup(() => clearTimeout(timer));
        }
    });

    const sortOptions: CollectionSortOption[] = ['Cost', 'Power', 'Name', 'Newest'];
    const filterTags = [
        { label: 'On Reveal', tag: 'OnReveal' },
        { label: 'Ongoing', tag: 'Ongoing' },
        { label: 'Destroy', tag: 'Destroy' },
        { label: 'No Ability', tag: 'None' }
    ];

    return (
        <div class="w-full h-full flex items-end justify-between px-2.5 pb-2 relative pointer-events-none">
            <Show when={showSortMenu()}>
                <div class="absolute bottom-14 left-1 w-40 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-1 z-50 animate-pop flex flex-col gap-1 pointer-events-auto">
                    <For each={sortOptions}>
                        {(opt) => (
                            <button 
                                onClick={() => { user.setCollectionSort(opt); setShowSortMenu(false); }}
                                class={`px-3 py-2 rounded-lg text-left text-[0.7rem] font-black uppercase tracking-tighter flex justify-between items-center transition-colors ${user.collectionSort() === opt ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
                            >
                                {opt}
                                {user.collectionSort() === opt && <div class="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]" />}
                            </button>
                        )}
                    </For>
                </div>
            </Show>

            <Show when={showFilterMenu()}>
                <div class="absolute bottom-14 right-1 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-pop pointer-events-auto">
                    <div class="mb-3">
                        <div class="relative">
                            <input 
                                type="text" 
                                placeholder={t('UI_SEARCH_CARDS')}
                                value={user.collectionFilterSearch()}
                                onInput={(e) => user.setCollectionFilterSearch(e.currentTarget.value)}
                                class="w-full bg-black/40 border border-slate-700 rounded-lg py-1.5 pl-8 pr-3 text-[0.7rem] text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600" 
                            />
                            <svg class="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-1.5">
                        <For each={filterTags}>
                            {({ label, tag }) => {
                                const isActiveTag = () => user.collectionFilterTags().includes(tag);
                                return (
                                    <button 
                                        onClick={() => user.toggleCollectionFilterTag(tag)}
                                        class={`px-2 py-1.5 border rounded text-[0.6rem] font-black transition-all text-center uppercase tracking-tighter ${isActiveTag() ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800'}`}
                                    >
                                        {label}
                                    </button>
                                );
                            }}
                        </For>
                    </div>
                </div>
            </Show>
            
            <Show when={showSortMenu() || showFilterMenu()}>
                <div class="fixed inset-0 z-40 pointer-events-auto" onClick={() => { setShowSortMenu(false); setShowFilterMenu(false); }} />
            </Show>

            <div class="pointer-events-auto">
                <SlantedButton 
                    variant={showSortMenu() ? 'primary' : 'glass'}
                    size="sm"
                    class="w-9"
                    onClick={() => { setShowSortMenu(!showSortMenu()); setShowFilterMenu(false); }}
                    icon={
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                        </svg>
                    }
                />
            </div>

            <div class="pointer-events-auto">
                <SlantedButton 
                    variant={showFilterMenu() ? 'primary' : 'glass'}
                    size="sm"
                    class="w-9"
                    onClick={() => { setShowFilterMenu(!showFilterMenu()); setShowSortMenu(false); }}
                    icon={
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                    }
                />
            </div>
        </div>
    );
};
