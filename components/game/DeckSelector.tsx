import { Switch, Match } from 'solid-js';
import { DeckSelectorClassic } from './DeckSelectorClassic';
import { DeckSelector3D } from './DeckSelector3D';

interface DeckSelectorProps {
    activeDeckId: number;
    onSelectDeck: (id: number) => void;
}

/**
 * DECK SELECTOR HUB
 * Toggle between 'classic' and '3d' to test user experience.
 * Reverted to 'classic' for the Collection Screen to prioritize vertical space for cards.
 */
export const DeckSelector = (props: DeckSelectorProps) => {
    // CHANGE THIS TO 'classic' or '3d'
    const MODE: 'classic' | '3d' = 'classic';

    return (
        <Switch fallback={<DeckSelectorClassic {...props} />}>
            <Match when={MODE === '3d'}>
                <DeckSelector3D {...props} />
            </Match>
            <Match when={MODE === 'classic'}>
                <DeckSelectorClassic {...props} />
            </Match>
        </Switch>
    );
};
