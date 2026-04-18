import React from 'react';
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
export const DeckSelector: React.FC<DeckSelectorProps> = (props) => {
    // CHANGE THIS TO 'classic' or '3d'
    const MODE: 'classic' | '3d' = 'classic';

    // Fixed: Cast MODE to string to prevent TypeScript from complaining about non-overlapping literal types in a configuration toggle.
    if ((MODE as string) === '3d') {
        return <DeckSelector3D {...props} />;
    }

    return <DeckSelectorClassic {...props} />;
};