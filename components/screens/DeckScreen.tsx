
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { StandardHeader } from '../ui/StandardHeader';
import { DeckSelector } from '../game/DeckSelector';
import { CollectionGrid } from '../deck/CollectionGrid';
import { DeckVault } from '../deck/DeckVault';
import { ComicArchive } from '../deck/ComicArchive';
import { InventoryStash } from '../deck/InventoryStash';
import { CollectionDragOverlay } from '../CollectionDragOverlay';
import { useUser } from '../../contexts/UserContext';
import { useUI } from '../../contexts/UIContext';
import { useCollectionDrag } from '../../hooks/useCollectionDrag';
import { CARDS } from '../../constants';
import { CardDefinition, CollectionTab, ScreenKey } from '../../types';
import { GenomeBadge } from '../ui/GenomeBadge';
import { SlantedButton } from '../ui/SlantedButton';
import { ProgressionScreen } from './ProgressionScreen';

interface DeckScreenProps {
    _onNavigate: (_s: ScreenKey) => void;
    activeScreen?: ScreenKey; 
}

export const DeckScreen: React.FC<DeckScreenProps> = ({ activeScreen, _onNavigate }) => {
    const { user, updateDeck, activeDeck, setActiveDeck, debugAddLevels } = useUser();
    const { pendingLevelIncrement } = useUI();
    const [activeTab, setActiveTab] = useState<CollectionTab>('CARDS');
    const [isProgressionOpen, setIsProgressionOpen] = useState(false);
    const [showDebugMenu, setShowDebugMenu] = useState(false);

    useEffect(() => {
        if (activeScreen === 'DECK') {
            requestAnimationFrame(() => {
                setActiveTab('CARDS');
                // FIX: Only trigger "Open" on increment. 
                // Do NOT automatically set to false when increment hits 0.
                if (pendingLevelIncrement > 0) {
                    setIsProgressionOpen(true);
                }
            });
        }
    }, [activeScreen, pendingLevelIncrement]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const vaultRef = useRef<HTMLDivElement>(null);
    const archiveRef = useRef<HTMLDivElement>(null);

    const handleAddCard = useCallback((cardId: string) => {
        if (activeDeck.length < 12 && !activeDeck.includes(cardId)) {
            updateDeck(user.activeDeckId, [...activeDeck, cardId]);
        }
    }, [activeDeck, user.activeDeckId, updateDeck]);

    const handleRemoveCard = useCallback((cardId: string) => {
        updateDeck(user.activeDeckId, activeDeck.filter(id => id !== cardId));
    }, [activeDeck, user.activeDeckId, updateDeck]);

    const { dragState, handlePointerDown } = useCollectionDrag({
        onAdd: handleAddCard,
        onRemove: handleRemoveCard,
        scrollRef: scrollRef,
        vaultRef: vaultRef,
        archiveRef: archiveRef
    });

    const deckCards = useMemo(() => {
        return activeDeck
            .map(id => CARDS.find(c => c.id === id))
            .filter((c): c is CardDefinition => !!c)
            .sort((a, b) => {
                if (a.baseCost !== b.baseCost) {
                    return a.baseCost - b.baseCost;
                }
                return a.name.localeCompare(b.name);
            });
    }, [activeDeck]);

    const renderContent = () => {
        switch(activeTab) {
            case 'COMICS': return <ComicArchive />;
            case 'INVENTORY': return <InventoryStash />;
            default:
                return (
                    <div className="flex flex-col h-full overflow-hidden">
                        <div 
                            ref={vaultRef}
                            className={`shrink-0 border-b border-slate-700/50 z-20 transition-all duration-300 ${dragState?.active && dragState.origin === 'archive' ? 'ring-2 ring-inset ring-indigo-500/50' : ''}`}
                            data-drop-zone="vault"
                        >
                            <DeckSelector 
                                activeDeckId={user.activeDeckId} 
                                onSelectDeck={setActiveDeck}
                            />

                            <div className="px-3 pb-2">
                                <DeckVault 
                                    cards={deckCards} 
                                    draggingCardId={dragState?.active && dragState.origin === 'vault' ? dragState.card.id : undefined}
                                    onPointerDown={(e, card) => handlePointerDown(e, card, 'vault')}
                                />
                            </div>
                        </div>

                        <div 
                            ref={archiveRef}
                            className={`flex-1 min-h-0 relative transition-all duration-300 ${dragState?.active && dragState.origin === 'vault' ? 'bg-indigo-500/5' : ''}`}
                            data-drop-zone="archive"
                        >
                            <CollectionGrid 
                                scrollRef={scrollRef}
                                ownedIds={user.collection}
                                activeDeckIds={activeDeck}
                                draggingCardId={dragState?.active && dragState.origin === 'archive' ? dragState.card.id : undefined}
                                onPointerDown={(e, card) => handlePointerDown(e, card, 'archive')}
                            />
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-transparent overflow-hidden relative">
            {!isProgressionOpen && (
                <>
                    <StandardHeader 
                        title="COLLECTION" 
                        className="!pl-0.5 !pr-1" 
                        leftContent={
                            <div className="flex items-center gap-1.5">
                                <GenomeBadge 
                                    level={user.level} 
                                    onClick={() => setIsProgressionOpen(true)}
                                />
                            </div>
                        }
                        rightContent={
                            <div className="flex items-center gap-1.5">
                                <SlantedButton 
                                    variant={activeTab === 'CARDS' ? 'primary' : 'secondary'} 
                                    size="xs"
                                    className="!w-[9vw] max-w-[2.3rem] !h-[1.65rem] shadow-lg"
                                    onClick={() => setActiveTab('CARDS')}
                                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>}
                                />
                                <SlantedButton 
                                    variant={activeTab === 'COMICS' ? 'primary' : 'secondary'} 
                                    size="xs"
                                    className="!w-[9vw] max-w-[2.3rem] !h-[1.65rem] shadow-lg"
                                    onClick={() => setActiveTab('COMICS')}
                                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.247 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                                />
                                <SlantedButton 
                                    variant={activeTab === 'INVENTORY' ? 'primary' : 'secondary'} 
                                    size="xs"
                                    className="!w-[9vw] max-w-[2.3rem] !h-[1.65rem] shadow-lg"
                                    onClick={() => setActiveTab('INVENTORY')}
                                    icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                                />
                            </div>
                        }
                    />
                    
                    <CollectionDragOverlay dragState={dragState} />

                    <div className="flex-1 overflow-hidden">
                        {renderContent()}
                    </div>

                    {/* FLOATING HOLOGRAPHIC DEBUG TRIGGER - MOVED TO BOTTOM CENTER */}
                    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                         <div className="relative pointer-events-auto flex flex-col items-center">
                            <button 
                                onClick={() => setShowDebugMenu(!showDebugMenu)}
                                className={`w-10 h-10 rounded-full bg-slate-900/60 backdrop-blur-xl border border-indigo-500/50 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all duration-300 hover:scale-110 active:scale-90 ${showDebugMenu ? 'rotate-90 border-indigo-400' : ''}`}
                            >
                                <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <div className="absolute inset-0 rounded-full animate-ping bg-indigo-500/20 pointer-events-none" />
                            </button>

                            {showDebugMenu && (
                                <div className="absolute bottom-12 w-48 bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/30 rounded-xl shadow-2xl p-1 z-50 animate-pop origin-bottom flex flex-col gap-1 perspective-[1000px]">
                                    <div className="px-3 py-2 border-b border-white/5 mb-1 text-center">
                                        <span className="text-[0.5rem] font-black text-indigo-400 uppercase tracking-[0.2em]">Debug Command Matrix</span>
                                    </div>
                                    {[1, 4, 10, 25, 100].map(val => (
                                        <button 
                                            key={val}
                                            onClick={() => { debugAddLevels(val); setShowDebugMenu(false); }}
                                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-500/20 text-slate-300 hover:text-white transition-all active:scale-[0.97] flex items-center justify-between group"
                                        >
                                            <span className="text-xs font-black italic uppercase tracking-tighter">Gain +{val} CL</span>
                                            <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                        </button>
                                    ))}
                                    <div className="h-px bg-white/5 mx-2 my-1" />
                                    <button 
                                        onClick={() => setShowDebugMenu(false)}
                                        className="w-full px-3 py-2 text-[0.6rem] font-black text-slate-500 uppercase tracking-widest text-center hover:text-slate-300"
                                    >
                                        Close Matrix
                                    </button>
                                </div>
                            )}
                         </div>
                    </div>
                </>
            )}

            {isProgressionOpen && (
                <ProgressionScreen onClose={() => setIsProgressionOpen(false)} />
            )}
        </div>
    );
};
