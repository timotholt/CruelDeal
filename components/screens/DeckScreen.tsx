import { createSignal, createMemo, createEffect, Show, Switch, Match, For } from 'solid-js';
import { StandardHeader } from '../ui/StandardHeader';
import { DeckSelector } from '../game/DeckSelector';
import { CollectionGrid } from '../deck/CollectionGrid';
import { DeckVault } from '../deck/DeckVault';
import { ComicArchive } from '../deck/ComicArchive';
import { InventoryStash } from '../deck/InventoryStash';
import { CollectionDragOverlay } from '../CollectionDragOverlay';
import { DeckEditorHeader } from '../deck/DeckEditorHeader';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';
import { useCollectionDrag } from '../../hooks/useCollectionDrag';
import { CARDS } from '../../constants';
import { CardDefinition, CollectionTab, ScreenKey } from '../../types';
import { GenomeBadge } from '../ui/GenomeBadge';
import { SlantedButton } from '../ui/SlantedButton';
import { ProgressionScreen } from './ProgressionScreen';
import { audio } from '../../services/audio';

interface DeckScreenProps {
    onNavigate: (s: ScreenKey) => void;
    activeScreen?: ScreenKey; 
}

type DeckScreenMode = 'BROWSE' | 'EDITOR';

export const DeckScreen = (props: DeckScreenProps) => {
    const { user, updateDeck, activeDeck, setActiveDeck, debugAddLevels } = useUser();
    const ui = useUI();
    const [activeTab, setActiveTab] = createSignal<CollectionTab>('CARDS');
    const [isProgressionOpen, setIsProgressionOpen] = createSignal(false);
    const [showDebugMenu, setShowDebugMenu] = createSignal(false);
    const [mode, setMode] = createSignal<DeckScreenMode>('BROWSE');

    createEffect(() => {
        if (props.activeScreen === 'DECK') {
            setActiveTab('CARDS');
            // Reset mode if we leave/enter to keep things fresh
            if (ui.pendingLevelIncrement() > 0) {
                setIsProgressionOpen(true);
            }
        } else {
            setMode('BROWSE');
        }
    });

    let scrollRef: HTMLDivElement | undefined;
    let vaultRef: HTMLDivElement | undefined;
    let archiveRef: HTMLDivElement | undefined;

    const handleAddCard = (cardId: string) => {
        const currentDeck = activeDeck();
        if (currentDeck.length < 12 && !currentDeck.includes(cardId)) {
            updateDeck(user.activeDeckId, [...currentDeck, cardId]);
            audio.play('sfx_ui_navigate', 0.5);
        }
    };

    const handleRemoveCard = (cardId: string) => {
        updateDeck(user.activeDeckId, activeDeck().filter(id => id !== cardId));
        audio.play('sfx_ui_navigate', 0.4);
    };

    const { dragState, handlePointerDown } = useCollectionDrag({
        onAdd: handleAddCard,
        onRemove: handleRemoveCard,
        scrollRef: () => scrollRef!,
        vaultRef: () => vaultRef!,
        archiveRef: () => archiveRef!
    });

    const deckCards = createMemo(() => {
        const activeIds = activeDeck();
        return activeIds
            .map(id => CARDS.find(c => c.id === id))
            .filter((c): c is CardDefinition => !!c)
            .sort((a, b) => {
                if (a.baseCost !== b.baseCost) return a.baseCost - b.baseCost;
                return a.name.localeCompare(b.name);
            });
    });

    return (
        <div class="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
            <Show when={!isProgressionOpen()}>
                {/* HEADER SYSTEM */}
                <Switch>
                    <Match when={mode() === 'EDITOR'}>
                        <DeckEditorHeader 
                            deckId={user.activeDeckId} 
                            onClose={() => setMode('BROWSE')} 
                        />
                    </Match>
                    <Match when={true}>
                        <StandardHeader 
                            title="COLLECTION" 
                            class="!pl-0.5 !pr-1" 
                            leftContent={
                                <div class="flex items-center gap-1.5">
                                    <GenomeBadge 
                                        level={user.level} 
                                        onClick={() => setIsProgressionOpen(true)}
                                    />
                                </div>
                            }
                            rightContent={
                                <div class="flex items-center gap-1.5">
                                    <SlantedButton 
                                        variant={activeTab() === 'CARDS' ? 'primary' : 'secondary'} 
                                        size="xs"
                                        class="!w-[9vw] max-w-[2.3rem] !h-[1.65rem] shadow-lg"
                                        onClick={() => setActiveTab('CARDS')}
                                        icon={<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                                    />
                                    <SlantedButton 
                                        variant={activeTab() === 'COMICS' ? 'primary' : 'secondary'} 
                                        size="xs"
                                        class="!w-[9vw] max-w-[2.3rem] !h-[1.65rem] shadow-lg"
                                        onClick={() => setActiveTab('COMICS')}
                                        icon={<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                                    />
                                    <SlantedButton 
                                        variant={activeTab() === 'INVENTORY' ? 'primary' : 'secondary'} 
                                        size="xs"
                                        class="!w-[9vw] max-w-[2.3rem] !h-[1.65rem] shadow-lg"
                                        onClick={() => setActiveTab('INVENTORY')}
                                        icon={<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                                    />
                                </div>
                            }
                        />
                    </Match>
                </Switch>
                
                <CollectionDragOverlay dragState={() => dragState()} />

                <div class="flex-1 overflow-hidden relative">
                    <Switch>
                        <Match when={activeTab() === 'COMICS'}>
                            <ComicArchive />
                        </Match>
                        <Match when={activeTab() === 'INVENTORY'}>
                            <InventoryStash />
                        </Match>
                        <Match when={true}>
                            <div class="flex flex-col h-full overflow-hidden">
                                {/* DECK AREA (Vault or Selection) */}
                                <div 
                                    ref={(el) => vaultRef = el}
                                    class={`shrink-0 border-b border-indigo-500/20 z-20 transition-all duration-300 relative ${dragState()?.active && dragState()?.origin === 'archive' ? 'bg-indigo-500/10' : ''}`}
                                    data-drop-zone="vault"
                                >
                                    <Show when={mode() === 'BROWSE'}>
                                        <div class="animate-enter-right">
                                            <DeckSelector 
                                                activeDeckId={user.activeDeckId} 
                                                onSelectDeck={setActiveDeck}
                                            />
                                        </div>
                                    </Show>

                                    <div class="px-3 pb-2 pt-1">
                                        <div 
                                            class={`transition-all duration-500 ${mode() === 'EDITOR' ? 'scale-[1.02] mt-2 mb-2' : ''} cursor-pointer`}
                                            onClick={() => mode() === 'BROWSE' && setMode('EDITOR')}
                                        >
                                            <DeckVault 
                                                cards={deckCards()} 
                                                draggingCardId={dragState()?.active && dragState()?.origin === 'vault' ? dragState()?.card.id : undefined}
                                                onPointerDown={(e, card) => handlePointerDown(e, card, 'vault')}
                                            />
                                            
                                            <Show when={mode() === 'BROWSE'}>
                                                <div class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                                                    <div class="bg-indigo-600/90 text-white px-4 py-1 rounded-full text-[0.6rem] font-bold uppercase tracking-widest shadow-2xl border border-white/20">
                                                        Edit Deck
                                                    </div>
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                </div>

                                {/* COLLECTION GRID */}
                                <div 
                                    ref={(el) => archiveRef = el}
                                    class={`flex-1 min-h-0 relative transition-all duration-300 ${dragState()?.active && dragState()?.origin === 'vault' ? 'bg-indigo-500/5' : ''}`}
                                    data-drop-zone="archive"
                                >
                                    <CollectionGrid 
                                        scrollRef={(el) => scrollRef = el}
                                        ownedIds={user.collection || []}
                                        activeDeckIds={activeDeck() || []}
                                        draggingCardId={dragState()?.active && dragState()?.origin === 'archive' ? dragState()?.card.id : undefined}
                                        onPointerDown={(e, card) => handlePointerDown(e, card, 'archive')}
                                    />
                                    
                                    {/* Subtitle for the grid if in editor mode */}
                                    <Show when={mode() === 'EDITOR'}>
                                        <div class="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10 hidden" />
                                    </Show>
                                </div>
                            </div>
                        </Match>
                    </Switch>
                </div>

                {/* DEBUG TRIGGER */}
                <Show when={mode() === 'BROWSE'}>
                    <div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                         <div class="relative pointer-events-auto flex flex-col items-center">
                            <button 
                                onClick={() => setShowDebugMenu(!showDebugMenu())}
                                class={`w-10 h-10 rounded-full bg-slate-900/60 backdrop-blur-xl border border-indigo-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-300 hover:scale-110 active:scale-90 ${showDebugMenu() ? 'rotate-90 border-indigo-400' : ''}`}
                            >
                                <svg class="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div class="absolute inset-0 rounded-full animate-ping bg-indigo-500/20 pointer-events-none" />
                            </button>

                            <Show when={showDebugMenu()}>
                                <div class="absolute bottom-12 w-48 bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/30 rounded-xl shadow-2xl p-1 z-50 animate-pop origin-bottom flex flex-col gap-1 perspective-[1000px]">
                                    <div class="px-3 py-2 border-b border-white/5 mb-1 text-center">
                                        <span class="text-[0.5rem] font-black text-indigo-400 uppercase tracking-[0.2em]">Debug Command Matrix</span>
                                    </div>
                                    <For each={[1, 4, 10, 25, 100]}>
                                        {(val) => (
                                            <button 
                                                onClick={() => { debugAddLevels(val); setShowDebugMenu(false); }}
                                                class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-slate-300 hover:text-white transition-all active:scale-[0.97] flex items-center justify-between group"
                                            >
                                                <span class="text-xs font-black italic uppercase tracking-tighter">Gain +{val} CL</span>
                                                <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                            </button>
                                        )}
                                    </For>
                                    <button 
                                        onClick={() => {
                                            ui.inspect({
                                                type: 'level_info',
                                                rewardType: 'card',
                                                rewardAmount: '1',
                                                level: 99,
                                                cardDef: CARDS[0],
                                                isClaimed: false
                                            });
                                            setShowDebugMenu(false);
                                        }}
                                        class="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-slate-300 hover:text-white transition-all active:scale-[0.97] flex items-center justify-between group"
                                    >
                                        <span class="text-xs font-black italic uppercase tracking-tighter">Inspect Sample Reward</span>
                                        <svg class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </button>
                                </div>
                            </Show>
                         </div>
                    </div>
                </Show>
            </Show>

            <Show when={isProgressionOpen()}>
                <ProgressionScreen onClose={() => setIsProgressionOpen(false)} />
            </Show>
        </div>
    );
};
