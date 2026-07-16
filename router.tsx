import { createRootRoute, createRoute, createRouter, Outlet, useNavigate, useRouter } from "@tanstack/solid-router";
import { MainMenuScreen } from "./components/screens/MainMenuScreen";
import { GameScreen } from "./components/screens/GameScreen";
import { CityMapScreen } from "./components/screens/CityMapScreen";
import { ClassicPlayScreen } from "./components/screens/ClassicPlayScreen";
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
import { TensorPlayScreen } from "./components/screens/TensorPlayScreen";
import { CardFrameLabScreen } from "./components/screens/CardFrameLabScreen";
import { UiMaterialLabScreen } from "./components/screens/UiMaterialLabScreen";
import { LoginMaterialPreviewScreen } from "./components/screens/LoginMaterialPreviewScreen";
import { MainMaterialPreviewScreen } from "./components/screens/MainMaterialPreviewScreen";
import { UiNodePreviewScreen } from "./components/screens/UiNodePreviewScreen";
import { CanonicalCardProofScreen } from "./components/screens/CanonicalCardProofScreen";
import { ShinyAuthoringScreen } from "./components/authoring/shiny/ShinyAuthoringScreen";
import { ShinyPerformanceScreen } from "./components/authoring/shiny/ShinyPerformanceScreen";
import { GameUiSkinProofScreen } from "./components/screens/GameUiSkinProofScreen";

// 1. Root Layout - Preserving existing CSS/Structure
const RootComponent = () => {
    const navigate = useNavigate();
    const router = useRouter();

    // Map current path to ScreenKey for the NavigationBar and BGM
    const activeScreen = createMemo<ScreenKey>(() => {
        const path = router.state.location.pathname.toLowerCase();
        
        // NOTE: /play must be tested BEFORE /game because `/play` doesn't
        // contain "/game" but we want them distinct.
        if (path.includes("/uitest")) return "GAME";
        if (path.includes("/login-material")) return "GAME";
        if (path.includes("/main-material")) return "GAME";
        if (path.includes("/ui-node")) return "GAME";
        if (path.includes("/game-ui-skin-proof")) return "GAME";
        if (path.includes("/dev")) return "GAME";
        if (path.includes("/citymap")) return "GAME";
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
    component: () => <GameScreen onExit={() => router.history.back()} />,
});

const playRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play",
    component: () => <ClassicPlayScreen onExit={() => router.history.back()} />,
});

const cityMapRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/citymap",
    component: () => <CityMapScreen onExit={() => router.history.back()} />,
});

const legacyPlayAliasRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/play/legacy",
    component: () => <ClassicPlayScreen onExit={() => router.history.back()} />,
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
    component: () => <ProfileScreen onExit={() => router.history.back()} />,
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

const devTensorPlayRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/tensor-play",
    component: () => <TensorPlayScreen />,
});

const devCardFrameRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/card-frame",
    component: () => <CardFrameLabScreen />,
});

const uiTestRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/uitest",
    component: () => <UiMaterialLabScreen />,
});

const loginMaterialRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login-material",
    component: () => <LoginMaterialPreviewScreen />,
});

const mainMaterialRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/main-material",
    component: () => <MainMaterialPreviewScreen />,
});

const uiNodeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/ui-node",
    component: () => <UiNodePreviewScreen />,
});

const gameUiSkinProofRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/game-ui-skin-proof",
    component: () => <GameUiSkinProofScreen />,
});

const devUiNodeRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/ui-node",
    component: () => <UiNodePreviewScreen />,
});

const devCanonicalCardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/canonical-card",
    component: () => <CanonicalCardProofScreen />,
});

const iconsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/icons",
    component: () => <ShinyAuthoringScreen />,
});

const devIconsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/icons",
    component: () => <ShinyAuthoringScreen />,
});

const devShinyRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/shiny",
    component: () => <ShinyAuthoringScreen />,
});

const devShinyPerformanceRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/dev/shiny-performance",
    component: () => <ShinyPerformanceScreen />,
});

// 3. Create Router Instance
const routeTree = rootRoute.addChildren([
    indexRoute,
    gameRoute,
    playRoute,
    cityMapRoute,
    legacyPlayAliasRoute,
    deckRoute,
    seasonRoute,
    storeRoute,
    profileRoute,
    inboxRoute,
    historyRoute,
    settingsRoute,
    rankRoute,
    progressionRoute,
    uiTestRoute,
    loginMaterialRoute,
    mainMaterialRoute,
    uiNodeRoute,
    gameUiSkinProofRoute,
    devUiNodeRoute,
    devCanonicalCardRoute,
    devCardFrameRoute,
    devTensorRoute,
    devTensorPlayRoute,
    iconsRoute,
    devIconsRoute,
    devShinyRoute,
    devShinyPerformanceRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/solid-router" {
    interface Register {
        router: typeof router;
    }
}
