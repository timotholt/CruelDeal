import { createRootRoute, createRoute, createRouter, Outlet, useNavigate, useRouter } from "@tanstack/solid-router";
import { MainMenuScreen } from "./components/screens/MainMenuScreen";
import { GameScreen } from "./components/screens/GameScreen";
import { PlayScreen } from "./components/screens/PlayScreen";
import { LegacyPlayScreen } from "./components/screens/LegacyPlayScreen";
import { DeckScreen } from "./components/screens/DeckScreen";
import { SeasonScreen } from "./components/screens/SeasonScreen";
import { StoreScreen } from "./components/screens/StoreScreen";
import { ProfileScreen } from "./components/screens/ProfileScreen";
import { InboxScreen } from "./components/screens/InboxScreen";
import { HistoryScreen } from "./components/screens/HistoryScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { LadderRankingScreen } from "./components/screens/LadderRankingScreen";
import { ProgressionScreen } from "./components/screens/ProgressionScreen";
import { NavigationBar } from "./components/ui/NavigationBar";
import { InspectorOverlay } from "./components/InspectorOverlay";
import { audio } from "./services/audio";
import { createEffect, createMemo, Show } from "solid-js";
import { ScreenKey } from "./types";
import TensorMapView from "./services/playgame/city-map/tensor/TensorMapView";

// 1. Root Layout - Preserving existing CSS/Structure
const RootComponent = () => {
    const navigate = useNavigate();
    const router = useRouter();

    // Map current path to ScreenKey for the NavigationBar and BGM
    const activeScreen = createMemo<ScreenKey>(() => {
        const path = router.state.location.pathname.toLowerCase();
        
        // NOTE: /play must be tested BEFORE /game because `/play` doesn't
        // contain "/game" but we want them distinct.
        if (path.includes("/dev")) return "GAME";
        if (path.includes("/play")) return "PLAY";
        if (path.includes("/game")) return "GAME";
        if (path.includes("/deck")) return "DECK";
        if (path.includes("/season")) return "SEASON";
        if (path.includes("/store")) return "STORE";
        if (path.includes("/profile")) return "PROFILE";
        if (path.includes("/inbox")) return "INBOX";
        if (path.includes("/history")) return "HISTORY";
        if (path.includes("/settings")) return "SETTINGS";
        if (path.includes("/rank")) return "RANK";
        if (path.includes("/progression")) return "PROGRESSION";
        
        return "MENU";
    });

    // BGM Orchestration (migrated from MainNavigator)
    createEffect(() => {
        const screen = activeScreen();
        if (screen === "GAME" || screen === "PLAY") {
            audio.playBgm("bgm_game");
        } else {
            audio.playBgm("bgm_menu");
        }
    });

    const handleNavigate = (screen: ScreenKey) => {
        audio.play("sfx_ui_navigate");
        const path = screen === "MENU" ? "/" : `/${screen.toLowerCase()}`;
        navigate({ to: path });
    };

    return (
        <div class="w-full h-full relative overflow-hidden bg-black flex flex-col">
            {/* Screen Layer - EXACT structure preserved */}
            <div class="flex-1 relative overflow-hidden">
                <Outlet />
            </div>

            {/* Persistent Navigation Layer */}
            <Show when={activeScreen() !== "GAME" && activeScreen() !== "PLAY"}>
                <NavigationBar 
                    activeScreen={activeScreen()} 
                    onNavigate={handleNavigate} 
                />
            </Show>

            {/* Global Inspector Overlay */}
            <InspectorOverlay />
        </div>
    );
};

export const rootRoute = createRootRoute({
    component: RootComponent,
});

// 2. Route Definitions
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <MainMenuScreen onNavigate={(s) => router.navigate({ to: s === 'MENU' ? '/' : `/${s.toLowerCase()}` })} onLogout={() => console.log('Logout')} />,
});

const gameRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/game",
    component: () => <GameScreen onBack={() => router.history.back()} />,
});

// NEW game screen — the port of the vfx-engine demo. See components/screens/PlayScreen.tsx.
const playRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play",
    component: () => <PlayScreen onExit={() => router.history.back()} />,
});

const legacyPlayRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play/legacy",
    component: () => <LegacyPlayScreen onExit={() => router.history.back()} />,
});

const deckRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/deck",
    component: () => <DeckScreen onNavigate={(s) => router.navigate({ to: s === 'MENU' ? '/' : `/${s.toLowerCase()}` })} activeScreen="DECK" />,
});

const seasonRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/season",
    component: SeasonScreen,
});

const storeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/store",
    component: StoreScreen,
});

const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profile",
    component: () => <ProfileScreen onNavigate={(s) => router.navigate({ to: s === 'MENU' ? '/' : `/${s.toLowerCase()}` })} />,
});

const inboxRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/inbox",
    component: InboxScreen,
});

const historyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/history",
    component: HistoryScreen,
});

const settingsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/settings",
    component: SettingsScreen,
});

const rankRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/rank",
    component: LadderRankingScreen,
});

const progressionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/progression",
    component: ProgressionScreen,
});

const devTensorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/tensor",
    component: () => (
        <div class="w-full h-full">
            <TensorMapView />
        </div>
    ),
});

// 3. Create Router Instance
const routeTree = rootRoute.addChildren([
    indexRoute,
    gameRoute,
    playRoute,
    legacyPlayRoute,
    deckRoute,
    seasonRoute,
    storeRoute,
    profileRoute,
    inboxRoute,
    historyRoute,
    settingsRoute,
    rankRoute,
    progressionRoute,
    devTensorRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
    interface Register {
        router: typeof router;
    }
}
