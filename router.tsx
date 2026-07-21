import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useMatches,
  useNavigate,
} from '@tanstack/solid-router';
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  lazy,
  Show,
  Suspense,
  useContext,
  type Component,
  type JSX,
} from 'solid-js';
import { MainMenuScreen } from './components/screens/MainMenuScreen';
import { ClassicPlayScreen } from './components/screens/ClassicPlayScreen';
import { DeckScreen } from './components/screens/DeckScreen';
import { SeasonScreen } from './components/screens/SeasonScreen';
import { StoreScreen } from './components/screens/StoreScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { InboxScreen } from './components/screens/InboxScreen';
import { HistoryScreen } from './components/screens/HistoryScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { LadderRankingScreen } from './components/screens/LadderRankingScreen';
import { ProgressionScreen } from './components/screens/ProgressionScreen';
import { LoginScreen } from './components/screens/LoginScreen';
import { NavigationBar } from './components/ui/NavigationBar';
import { AppViewport } from './components/ui/AppViewport';
import { InspectorOverlay } from './components/InspectorOverlay';
import { UIProvider } from './contexts/UIContext';
import { UserProvider } from './contexts/UserContext';
import { audio } from './services/audio';
import { api } from './services/api';
import type { ScreenKey, UserProfile } from './types';

declare module '@tanstack/router-core' {
  interface StaticDataRouteOption {
    screen?: ScreenKey;
    surface?: 'authenticated' | 'play' | 'development' | 'public';
  }
}

interface AuthSession {
  profile: () => UserProfile | null;
  error: () => string | null;
  isAuthenticating: () => boolean;
  login: () => Promise<boolean>;
  clearError: () => void;
}

const AuthSessionContext = createContext<AuthSession>();

const useAuthSession = () => {
  const session = useContext(AuthSessionContext);
  if (!session) throw new Error('Authentication routes must be rendered below RouterRoot');
  return session;
};

const RouterRoot = () => {
  const [profile, setProfile] = createSignal<UserProfile | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = createSignal(false);

  const login = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const response = await api.profile.get('u1');
      if (!response.success || !response.data) {
        setError(response.error?.message || 'Failed to load profile data.');
        return false;
      }
      setProfile(response.data);
      return true;
    } catch (cause) {
      console.error('Profile sync failed', cause);
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const session: AuthSession = {
    profile,
    error,
    isAuthenticating,
    login,
    clearError: () => setError(null),
  };

  return (
    <AuthSessionContext.Provider value={session}>
      <Outlet />
    </AuthSessionContext.Provider>
  );
};

const AuthenticationPrompt = () => {
  const auth = useAuthSession();

  return (
    <Show
      when={!auth.isAuthenticating()}
      fallback={(
        <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono text-sm animate-pulse whitespace-pre uppercase tracking-[0.5em]">
          Linking Neural Grid...
        </div>
      )}
    >
      <Show
        when={!auth.error()}
        fallback={(
          <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-red-500 font-mono text-sm gap-4 p-4 text-center">
            <span>Error: {auth.error()}</span>
            <button onClick={auth.clearError} class="text-xs underline tracking-normal">Back to Login</button>
          </div>
        )}
      >
        <LoginScreen onLogin={() => void auth.login()} />
      </Show>
    </Show>
  );
};

const ApplicationChrome = () => {
  const navigate = useNavigate();
  const routePresentation = useMatches({
    select: (matches) => {
      const leaf = matches[matches.length - 1];
      return {
        screen: leaf?.staticData.screen ?? 'MENU',
        surface: leaf?.staticData.surface ?? 'authenticated',
      };
    },
  });
  const activeScreen = createMemo<ScreenKey>(() => routePresentation().screen);

  createEffect(() => {
    const presentation = routePresentation();
    audio.playBgm(presentation.surface === 'play' ? 'bgm_game' : 'bgm_menu');
  });

  const handleNavigate = (screen: ScreenKey) => {
    audio.play('sfx_ui_navigate');
    navigate({ to: screen === 'MENU' ? '/' : `/${screen.toLowerCase()}` });
  };

  return (
    <div class="w-full h-full relative overflow-hidden bg-black flex flex-col">
      <div class="flex-1 relative overflow-hidden">
        <Outlet />
      </div>

      <Show when={routePresentation().surface !== 'play'}>
        <NavigationBar activeScreen={activeScreen()} onNavigate={handleNavigate} />
      </Show>

      <InspectorOverlay />
    </div>
  );
};

const AuthenticatedLayout = () => {
  const auth = useAuthSession();

  return (
    <AppViewport>
      <Show when={auth.profile()} fallback={<AuthenticationPrompt />}>
        {(profile) => (
          <UIProvider>
            <UserProvider initialUser={profile()}>
              <ApplicationChrome />
            </UserProvider>
          </UIProvider>
        )}
      </Show>
    </AppViewport>
  );
};

const PublicLoginLayout = () => {
  const auth = useAuthSession();
  const navigate = useNavigate();

  const login = async () => {
    if (await auth.login()) navigate({ to: '/' });
  };

  return (
    <AppViewport>
      <Show when={!auth.profile()} fallback={<MainMenuRedirect />}>
        <LoginScreen onLogin={() => void login()} />
      </Show>
    </AppViewport>
  );
};

const MainMenuRedirect = () => {
  const navigate = useNavigate();
  createEffect(() => navigate({ to: '/', replace: true }));
  return null;
};

const DevelopmentLayout = () => (
  <div class="w-full h-full bg-slate-950 text-white font-sans overflow-hidden">
    <Suspense fallback={<DevelopmentLoading />}>
      <Outlet />
    </Suspense>
  </div>
);

const DevelopmentLoading = () => (
  <div class="w-full h-full grid place-items-center bg-[#080908] text-[#efc85d] font-mono text-xs uppercase tracking-[0.3em]">
    Loading lab...
  </div>
);

const devLinks = [
  ['/dev/diegetic-login/index.html', 'Diegetic Login Prototype', 'Perspective-mapped cinematic login UI'],
  ['/gametext-test', 'GameText V1 Test', 'Legacy fit-text lab'],
  ['/gametextv2-test', 'GameText V2 Test', 'Fit modes, style matrix, and script stress tests'],
  ['/gametextv3-test', 'GameText V3 Test', 'Live-geometry font fitting engine'],
  ['/uitest', 'Material UI Editor', 'Material primitives and recipe editor'],
  ['/main-material', 'Main Material Editor', 'Main screen skin and node editor'],
  ['/dev/ui-node', 'UiNode Surface Preview', 'Node payload and skin registry proof'],
  ['/game-ui-skin-proof', 'Game UI Skin/CMS Proof', 'Theme tokens, skins, and placements'],
  ['/dev/shiny', 'Shiny Material Authoring', 'Metallic, reflex, icon, and authoring surface'],
  ['/dev/shiny-performance', 'Gold Reflex Mobile Proof', 'Phone-oriented reflex performance lab'],
] as const;

const DevIndexScreen = () => (
  <main class="min-h-full overflow-auto bg-[#080908] text-[#f4eee0]">
    <div class="mx-auto grid w-[min(920px,calc(100vw-32px))] gap-5 py-8">
      <header class="grid gap-2">
        <div class="text-[10px] font-black uppercase tracking-[0.16em] text-[#efc85d]">// DEV INDEX</div>
        <h1 class="m-0 text-4xl font-black italic leading-none text-[#fff7dd]">Cruel Deal Dev</h1>
      </header>
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <For each={devLinks}>
          {([href, title, detail]) => (
            <a href={href} class="grid min-h-28 gap-2 rounded-md border border-white/15 bg-white/[0.055] p-4 text-[#f4eee0] no-underline shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)] transition hover:border-[#efc85d]/60 hover:bg-[#efc85d]/10">
              <strong class="text-lg font-black uppercase leading-none">{title}</strong>
              <span class="text-sm font-semibold leading-snug text-[#f4eee0]/65">{detail}</span>
              <span class="mt-auto text-xs font-black uppercase tracking-[0.08em] text-[#efc85d]">{href}</span>
            </a>
          )}
        </For>
      </section>
    </div>
  </main>
);

type LazyScreenModule = Record<string, unknown>;

// Vite owns this module catalog. Unlike literal import() expressions, the glob
// boundary does not pull experimental source into the shipped TypeScript
// project, while Vite still emits one lazy chunk per screen at build time.
const experimentalScreenModules = import.meta.glob<LazyScreenModule>([
  './components/screens/CityMapScreen.tsx',
  './services/playgame/city-map/tensor/TensorMapView.tsx',
  './components/screens/TensorPlayScreen.tsx',
  './components/screens/CardFrameLabScreen.tsx',
  './components/screens/UiMaterialLabScreen.tsx',
  './components/screens/LoginMaterialPreviewScreen.tsx',
  './components/screens/MainMaterialPreviewScreen.tsx',
  './components/screens/UiNodePreviewScreen.tsx',
  './components/screens/CanonicalCardProofScreen.tsx',
  './components/screens/MinimalSurfaceProofScreen.tsx',
  './components/authoring/shiny/ShinyAuthoringScreen.tsx',
  './components/authoring/shiny/ShinyPerformanceScreen.tsx',
  './components/screens/GameUiSkinProofScreen.tsx',
  './components/screens/GameTextTestScreen.tsx',
]);

const lazyScreen = <Props extends Record<string, unknown> = Record<string, never>>(
  modulePath: keyof typeof experimentalScreenModules,
  exportName = 'default',
) => lazy(async () => {
  const loadModule = experimentalScreenModules[modulePath];
  if (!loadModule) throw new Error(`Missing lazy route module: ${modulePath}`);

  const module = await loadModule();
  const component = module[exportName];
  if (typeof component !== 'function') {
    throw new Error(`Lazy route module ${modulePath} has no component export ${exportName}`);
  }

  return { default: component as Component<Props> };
});

const CityMapScreen = lazyScreen<{ onExit?: () => void }>('./components/screens/CityMapScreen.tsx', 'CityMapScreen');
const TensorMapView = lazyScreen('./services/playgame/city-map/tensor/TensorMapView.tsx');
const TensorPlayScreen = lazyScreen('./components/screens/TensorPlayScreen.tsx', 'TensorPlayScreen');
const CardFrameLabScreen = lazyScreen('./components/screens/CardFrameLabScreen.tsx', 'CardFrameLabScreen');
const UiMaterialLabScreen = lazyScreen('./components/screens/UiMaterialLabScreen.tsx', 'UiMaterialLabScreen');
const LoginMaterialPreviewScreen = lazyScreen('./components/screens/LoginMaterialPreviewScreen.tsx', 'LoginMaterialPreviewScreen');
const MainMaterialPreviewScreen = lazyScreen('./components/screens/MainMaterialPreviewScreen.tsx', 'MainMaterialPreviewScreen');
const UiNodePreviewScreen = lazyScreen('./components/screens/UiNodePreviewScreen.tsx', 'UiNodePreviewScreen');
const CanonicalCardProofScreen = lazyScreen('./components/screens/CanonicalCardProofScreen.tsx', 'CanonicalCardProofScreen');
const MinimalSurfaceProofScreen = lazyScreen('./components/screens/MinimalSurfaceProofScreen.tsx', 'MinimalSurfaceProofScreen');
const ShinyAuthoringScreen = lazyScreen('./components/authoring/shiny/ShinyAuthoringScreen.tsx', 'ShinyAuthoringScreen');
const ShinyPerformanceScreen = lazyScreen('./components/authoring/shiny/ShinyPerformanceScreen.tsx', 'ShinyPerformanceScreen');
const GameUiSkinProofScreen = lazyScreen('./components/screens/GameUiSkinProofScreen.tsx', 'GameUiSkinProofScreen');
const GameTextTestScreen = lazyScreen<{ version: 'v1' | 'v2' | 'v3' }>('./components/screens/GameTextTestScreen.tsx', 'GameTextTestScreen');

const rootRoute = createRootRoute({ component: RouterRoot });

const authenticatedLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  component: AuthenticatedLayout,
});

const publicLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'public',
  component: () => <Outlet />,
});

const developmentLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'development',
  component: DevelopmentLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/',
  staticData: { screen: 'MENU', surface: 'authenticated' },
  component: () => <MainMenuScreen onNavigate={(screen) => router.navigate({ to: screen === 'MENU' ? '/' : `/${screen.toLowerCase()}` })} onLogout={() => console.log('Logout')} />,
});

const playRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/play',
  staticData: { screen: 'PLAY', surface: 'play' },
  component: () => <ClassicPlayScreen allowDebugSetup={import.meta.env.DEV} onExit={() => router.navigate({ to: '/' })} />,
});

const cityMapRoute = createRoute({
  getParentRoute: () => authenticatedLayoutRoute,
  path: '/citymap',
  staticData: { screen: 'GAME', surface: 'play' },
  component: () => <Suspense fallback={<DevelopmentLoading />}><CityMapScreen onExit={() => router.history.back()} /></Suspense>,
});

const authenticatedRoutes = [
  indexRoute,
  playRoute,
  cityMapRoute,
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/deck', staticData: { screen: 'DECK', surface: 'authenticated' }, component: () => <DeckScreen onNavigate={(screen) => router.navigate({ to: screen === 'MENU' ? '/' : `/${screen.toLowerCase()}` })} activeScreen="DECK" /> }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/season', staticData: { screen: 'SEASON', surface: 'authenticated' }, component: SeasonScreen }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/store', staticData: { screen: 'STORE', surface: 'authenticated' }, component: StoreScreen }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/profile', staticData: { screen: 'PROFILE', surface: 'authenticated' }, component: () => <ProfileScreen onExit={() => router.history.back()} /> }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/inbox', staticData: { screen: 'INBOX', surface: 'authenticated' }, component: InboxScreen }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/history', staticData: { screen: 'HISTORY', surface: 'authenticated' }, component: HistoryScreen }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/settings', staticData: { screen: 'SETTINGS', surface: 'authenticated' }, component: SettingsScreen }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/rank', staticData: { screen: 'RANK', surface: 'authenticated' }, component: LadderRankingScreen }),
  createRoute({ getParentRoute: () => authenticatedLayoutRoute, path: '/progression', staticData: { screen: 'PROGRESSION', surface: 'authenticated' }, component: ProgressionScreen }),
];

const loginRoute = createRoute({
  getParentRoute: () => publicLayoutRoute,
  path: '/login',
  staticData: { surface: 'public' },
  component: PublicLoginLayout,
});

type DevelopmentRouteSpec = {
  path: string;
  component: () => JSX.Element;
};

const developmentRouteSpecs: DevelopmentRouteSpec[] = [
  { path: '/dev', component: DevIndexScreen },
  { path: '/dev/tensor', component: () => <div class="w-full h-full"><TensorMapView /></div> },
  { path: '/dev/tensor-play', component: () => <TensorPlayScreen /> },
  { path: '/dev/card-frame', component: () => <CardFrameLabScreen /> },
  { path: '/uitest', component: () => <UiMaterialLabScreen /> },
  { path: '/login-material', component: () => <LoginMaterialPreviewScreen /> },
  { path: '/main-material', component: () => <MainMaterialPreviewScreen /> },
  { path: '/ui-node', component: () => <UiNodePreviewScreen /> },
  { path: '/game-ui-skin-proof', component: () => <GameUiSkinProofScreen /> },
  { path: '/dev/ui-node', component: () => <UiNodePreviewScreen /> },
  { path: '/dev/canonical-card', component: () => <CanonicalCardProofScreen /> },
  { path: '/dev/minimal-surface', component: () => <MinimalSurfaceProofScreen /> },
  { path: '/icons', component: () => <ShinyAuthoringScreen /> },
  { path: '/dev/icons', component: () => <ShinyAuthoringScreen /> },
  { path: '/dev/shiny', component: () => <ShinyAuthoringScreen /> },
  { path: '/dev/shiny-performance', component: () => <ShinyPerformanceScreen /> },
  { path: '/gametext-test', component: () => <GameTextTestScreen version="v1" /> },
  { path: '/gametextv2-test', component: () => <GameTextTestScreen version="v2" /> },
  { path: '/gametext-v2-test', component: () => <GameTextTestScreen version="v2" /> },
  { path: '/gametextv3-test', component: () => <GameTextTestScreen version="v3" /> },
  { path: '/gametext-v3-test', component: () => <GameTextTestScreen version="v3" /> },
];

const developmentRoutes = developmentRouteSpecs.map(({ path, component }) => createRoute({
  getParentRoute: () => developmentLayoutRoute,
  path,
  staticData: { screen: 'GAME', surface: 'development' },
  component,
}));

const routeTree = rootRoute.addChildren([
  authenticatedLayoutRoute.addChildren(authenticatedRoutes),
  publicLayoutRoute.addChildren([loginRoute]),
  developmentLayoutRoute.addChildren(developmentRoutes),
]);

export const router = createRouter({ routeTree });

export const supportedRoutePaths = [
  '/', '/play', '/citymap', '/deck', '/season', '/store', '/profile', '/inbox',
  '/history', '/settings', '/rank', '/progression', '/login',
  ...developmentRouteSpecs.map(({ path }) => path),
] as const;

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
