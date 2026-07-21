import { DeckSelectorClassic } from './DeckSelectorClassic';

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
    return <DeckSelectorClassic {...props} />;
};
