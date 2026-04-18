import { createSignal, Show, createMemo } from 'solid-js';
import { useUser } from '../../contexts/UserContext';
import { CARDS } from '../../constants';
import { SlantedButton } from '../ui/SlantedButton';
import { audio } from '../../services/audio';

interface DeckEditorHeaderProps {
    deckId: number;
    onClose: () => void;
}

export const DeckEditorHeader = (props: DeckEditorHeaderProps) => {
    const { user, renameDeck } = useUser();
    const [isEditingName, setIsEditingName] = createSignal(false);
    
    const deckName = () => user.deckNames[props.deckId] || `DECK ${props.deckId}`;
    const cardIds = () => user.decks[props.deckId] || [];
    
    const stats = createMemo(() => {
        const ids = cardIds();
        if (ids.length === 0) return { avgCost: "0.0", avgPower: "0.0", count: 0 };
        const deckCards = ids.map(id => CARDS.find(c => c.id === id)).filter((c): c is any => !!c);
        const totalCost = deckCards.reduce((acc, accCard) => acc + (accCard.baseCost || 0), 0);
        const totalPower = deckCards.reduce((acc, accCard) => acc + (accCard.basePower || 0), 0);
        return {
            avgCost: (totalCost / Math.max(1, deckCards.length)).toFixed(1),
            avgPower: (totalPower / Math.max(1, deckCards.length)).toFixed(1),
            count: deckCards.length
        };
    });

    const handleNameChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        renameDeck(props.deckId, target.value.toUpperCase());
    };

    const isValid = () => stats().count === 12;

    return (
        <div class="w-full bg-slate-900/80 backdrop-blur-xl border-b border-indigo-500/30 px-4 pt-1 pb-2 shadow-2xl relative z-50">
            <div class="flex items-center justify-between gap-4">
                <div class="flex flex-col flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-0.5">
                        <span class="text-[0.45rem] font-black text-indigo-400/60 uppercase tracking-widest">Editing Deck {props.deckId < 10 ? `0${props.deckId}` : props.deckId}</span>
                        <div class={`px-1.5 py-0.5 rounded-[2px] text-[0.4rem] font-black uppercase tracking-tighter ${isValid() ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {stats().count} / 12 Cards
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 group cursor-pointer" onClick={() => { setIsEditingName(true); audio.playUiClick(); }}>
                        <Show when={isEditingName()} fallback={
                            <h2 class="text-xl font-black italic text-white tracking-tighter truncate uppercase drop-shadow-md">
                                {deckName()}
                            </h2>
                        }>
                            <input 
                                autoFocus
                                class="bg-black/40 border-b border-indigo-500 text-xl font-black italic text-white tracking-tighter uppercase w-full outline-none px-1"
                                value={deckName()}
                                onInput={handleNameChange}
                                onBlur={() => setIsEditingName(false)}
                                onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                            />
                        </Show>
                        <Show when={!isEditingName()}>
                            <svg class="w-3 h-3 text-white/20 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width={3} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </Show>
                    </div>
                </div>

                <div class="flex items-center gap-4 px-4 bg-black/40 rounded-lg py-1 border border-white/5">
                    <div class="flex flex-col items-center">
                        <span class="text-[0.4rem] font-black uppercase text-white/40 tracking-tighter leading-none mb-1">Avg Cost</span>
                        <span class="text-xs font-black text-blue-400 italic tracking-tighter">{stats().avgCost}</span>
                    </div>
                    <div class="flex flex-col items-center">
                        <span class="text-[0.4rem] font-black uppercase text-white/40 tracking-tighter leading-none mb-1">Avg Power</span>
                        <span class="text-xs font-black text-amber-400 italic tracking-tighter">{stats().avgPower}</span>
                    </div>
                    <Show when={user.deckStats[props.deckId]}>
                        {(s) => (
                            <>
                                <div class="w-px h-6 bg-white/10" />
                                <div class="flex flex-col items-center">
                                    <span class="text-[0.4rem] font-black uppercase text-white/40 tracking-tighter leading-none mb-1">Win Rate</span>
                                    <span class="text-xs font-black text-emerald-400 italic tracking-tighter">{(s().ladderWinRate * 100).toFixed(0)}%</span>
                                </div>
                            </>
                        )}
                    </Show>
                </div>

                <div class="shrink-0 flex items-center">
                    <SlantedButton 
                        variant="primary" 
                        size="sm" 
                        onClick={() => { props.onClose(); audio.playUiClick(); }}
                        class="shadow-xl"
                    >
                        DONE
                    </SlantedButton>
                </div>
            </div>
        </div>
    );
};
