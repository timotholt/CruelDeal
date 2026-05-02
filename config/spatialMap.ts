
import type { Component } from 'solid-js';
import { ScreenKey } from '../types';

// Screen Imports
import { MainMenuScreen } from '../components/screens/MainMenuScreen';
import { GameScreen } from '../components/screens/GameScreen';
import { DeckScreen } from '../components/screens/DeckScreen';
import { SeasonScreen } from '../components/screens/SeasonScreen';
import { StoreScreen } from '../components/screens/StoreScreen';
import { HistoryScreen } from '../components/screens/HistoryScreen';
import { InboxScreen } from '../components/screens/InboxScreen';
import { ProfileScreen } from '../components/screens/ProfileScreen';
import { SettingsScreen } from '../components/screens/SettingsScreen';
import { LadderRankingScreen } from '../components/screens/LadderRankingScreen';

export interface ScreenConfig {
    x: number; // Viewport Multiplier
    y: number; // Viewport Multiplier
    component: Component<any>;
    isPersistent?: boolean; // If true, stays mounted in DOM once initialized
}

/**
 * THE SPATIAL GRID CONFIGURATION
 */
export const WORLDS: Record<ScreenKey, ScreenConfig> = {
    SEASON:  { x: -2, y: 0, component: SeasonScreen, isPersistent: true },
    INBOX:   { x: -1, y: 0, component: InboxScreen, isPersistent: true },
    MENU:    { x: 0,  y: 0, component: MainMenuScreen, isPersistent: true },
    DECK:    { x: 1,  y: 0, component: DeckScreen, isPersistent: true },
    STORE:   { x: 2,  y: 0, component: StoreScreen, isPersistent: true },
    
    // Vertical Layers
    GAME:    { x: 0,  y: -1, component: GameScreen, isPersistent: false },
    PROFILE: { x: 0,  y: 1,  component: ProfileScreen, isPersistent: true },
    HISTORY: { x: 1,  y: 1,  component: HistoryScreen, isPersistent: true },
    RANK:    { x: -1, y: 1,  component: LadderRankingScreen, isPersistent: true },
    SETTINGS: { x: -1, y: -1, component: SettingsScreen, isPersistent: true },

    PROGRESSION: { x: 99, y: 99, component: () => null, isPersistent: false }, 
};
