import { createSignal, Show, Switch, Match, createEffect } from 'solid-js';
import { ScreenKey } from '../types';
import { MainMenuScreen } from './screens/MainMenuScreen';
import { GameScreen } from './screens/GameScreen';
import { DeckScreen } from './screens/DeckScreen';
import { SeasonScreen } from './screens/SeasonScreen';
import { StoreScreen } from './screens/StoreScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { InboxScreen } from './screens/InboxScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { NavigationBar } from './ui/NavigationBar';
import { InspectorOverlay } from './InspectorOverlay';
import { audio } from '../services/audio';

/**
 * MAIN NAVIGATOR
 * Orchestrates high-level screen transitions and persistent navigation bars.
 * Manages the transition stack and global overlay states.
 */
export const MainNavigator = () => {
    const [activeScreen, setActiveScreen] = createSignal<ScreenKey>('MENU');
    const [prevScreen, setPrevScreen] = createSignal<ScreenKey | null>(null);

    // BGM Orchestration
    createEffect(() => {
        const screen = activeScreen();
        if (screen === 'GAME') {
            audio.playBgm('bgm_game');
        } else {
            audio.playBgm('bgm_menu');
        }
    });

    const handleNavigate = (screen: ScreenKey) => {
        if (screen === activeScreen()) return;
        
        audio.play('sfx_ui_navigate');
        setPrevScreen(activeScreen());
        setActiveScreen(screen);
    };

    const handleBack = () => {
        if (prevScreen()) {
            handleNavigate(prevScreen()!);
        } else {
            handleNavigate('MENU');
        }
    };

    return (
        <div class="w-full h-full relative overflow-hidden bg-black flex flex-col">
            {/* Screen Layer */}
            <div class="flex-1 relative overflow-hidden">
                <Switch>
                    <Match when={activeScreen() === 'MENU'}>
                        <MainMenuScreen onNavigate={handleNavigate} onLogout={() => console.log('Logout')} />
                    </Match>
                    <Match when={activeScreen() === 'GAME'}>
                        <GameScreen onBack={handleBack} />
                    </Match>
                    <Match when={activeScreen() === 'DECK'}>
                        <DeckScreen onNavigate={handleNavigate} activeScreen={activeScreen()} />
                    </Match>
                    <Match when={activeScreen() === 'SEASON'}>
                        <SeasonScreen />
                    </Match>
                    <Match when={activeScreen() === 'STORE'}>
                        <StoreScreen />
                    </Match>
                    <Match when={activeScreen() === 'PROFILE'}>
                        <ProfileScreen onNavigate={handleNavigate} />
                    </Match>
                    <Match when={activeScreen() === 'INBOX'}>
                        <InboxScreen />
                    </Match>
                    <Match when={activeScreen() === 'HISTORY'}>
                        <HistoryScreen />
                    </Match>
                    <Match when={activeScreen() === 'SETTINGS'}>
                        <SettingsScreen />
                    </Match>
                </Switch>
            </div>

            {/* Persistent Navigation Layer */}
            <Show when={activeScreen() !== 'GAME'}>
                <NavigationBar activeScreen={activeScreen()} onNavigate={handleNavigate} />
            </Show>

            {/* Global Inspector Overlay (z-index managed internally via portals/absolute positioning) */}
            <InspectorOverlay />
        </div>
    );
};
