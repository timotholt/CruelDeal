import { createSignal, Show, ErrorBoundary } from 'solid-js';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { UIProvider } from './contexts/UIContext';
import { UserProvider } from './contexts/UserContext';
import { api } from './services/api';
import { UserProfile } from './types';
import { router } from './router';
import { RouterProvider } from '@tanstack/solid-router';
import { LoginScreen } from './components/screens/LoginScreen';
import { UiMaterialLabScreen } from './components/screens/UiMaterialLabScreen';
import { LoginMaterialPreviewScreen } from './components/screens/LoginMaterialPreviewScreen';
import { MainMaterialPreviewScreen } from './components/screens/MainMaterialPreviewScreen';
import { UiNodePreviewScreen } from './components/screens/UiNodePreviewScreen';
import { GameTextTestScreen } from './components/screens/GameTextTestScreen';
import { AppViewport } from './components/ui/AppViewport';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    },
  },
});

/**
 * AppContent Component
 * The main container for the application once the user profile is loaded.
 */
function AppContent() {
  return (
    <div class="w-full h-full bg-slate-950 text-white font-sans overflow-hidden">
      <RouterProvider router={router} />
    </div>
  );
}

const devLinks = [
  {
    href: '/gametext-test',
    title: 'GameText V1 Test',
    detail: 'Legacy fit-text lab',
  },
  {
    href: '/gametextv2-test',
    title: 'GameText V2 Test',
    detail: 'Fit modes, style matrix, and script stress tests',
  },
  {
    href: '/uitest',
    title: 'Material UI Editor',
    detail: 'Material primitives and recipe editor',
  },
  {
    href: '/main-material',
    title: 'Main Material Editor',
    detail: 'Main screen skin and node editor',
  },
];

const DevIndexScreen = () => (
  <main class="min-h-full overflow-auto bg-[#080908] text-[#f4eee0]">
    <div class="mx-auto grid w-[min(920px,calc(100vw-32px))] gap-5 py-8">
      <header class="grid gap-2">
        <div class="text-[10px] font-black uppercase tracking-[0.16em] text-[#efc85d]">// DEV INDEX</div>
        <h1 class="m-0 text-4xl font-black italic leading-none text-[#fff7dd]">Cruel Deal Dev</h1>
      </header>

      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {devLinks.map((link) => (
          <a
            href={link.href}
            class="grid min-h-28 gap-2 rounded-md border border-white/15 bg-white/[0.055] p-4 text-[#f4eee0] no-underline shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)] transition hover:border-[#efc85d]/60 hover:bg-[#efc85d]/10"
          >
            <strong class="text-lg font-black uppercase leading-none">{link.title}</strong>
            <span class="text-sm font-semibold leading-snug text-[#f4eee0]/65">{link.detail}</span>
            <span class="mt-auto text-xs font-black uppercase tracking-[0.08em] text-[#efc85d]">{link.href}</span>
          </a>
        ))}
      </section>
    </div>
  </main>
);

/**
 * App Entry Component
 * Handles the initial data fetching and provider initialization.
 */
export default function App() {
  const [profile, setProfile] = createSignal<UserProfile | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = createSignal(false);
  const isDevPath = () => window.location.pathname.toLowerCase().startsWith('/dev');
  const isUiTestPath = () => window.location.pathname.toLowerCase().startsWith('/uitest');
  const isLoginMaterialPath = () => window.location.pathname.toLowerCase().startsWith('/login-material');
  const isMainMaterialPath = () => window.location.pathname.toLowerCase().startsWith('/main-material');
  const isUiNodePath = () => window.location.pathname.toLowerCase().startsWith('/ui-node');
  const isGameTextTestPath = () => window.location.pathname.toLowerCase().startsWith('/gametext-test');
  const isGameTextV2TestPath = () => {
    const path = window.location.pathname.toLowerCase();
    return path.startsWith('/gametextv2-test') || path.startsWith('/gametext-v2-test');
  };

  const performLogin = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      console.log("App: Starting profile sync (u1)...");
      const res = await api.profile.get('u1');
      if (res.success && res.data) {
        console.log("App: Profile sync successful", res.data);
        setProfile(res.data);
      } else {
        setError("Failed to load profile data.");
      }
    } catch (e) {
      console.error("Profile sync failed", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallback={(err) => (
          <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-red-500 font-mono text-sm p-4 text-center">
              <div class="text-xl mb-4 text-white font-black italic">CRITICAL ERROR</div>
              <div class="max-w-md break-words whitespace-pre-wrap opacity-80">{err?.message || "Unknown rendering error"}</div>
              <button 
                  class="mt-8 px-6 py-2 bg-indigo-600 text-white font-bold italic tracking-tighter skew-x-[-12deg] hover:bg-indigo-500 transition-colors"
                  onClick={() => window.location.reload()}
              >
                  REBOOT SYSTEM
              </button>
          </div>
      )}>
        <Show
          when={isDevPath() || isUiTestPath() || isLoginMaterialPath() || isMainMaterialPath() || isUiNodePath() || isGameTextTestPath() || isGameTextV2TestPath()}
          fallback={
            <AppViewport>
              <Show
                  when={profile()}
                  fallback={
                    <Show when={isAuthenticating()} fallback={
                        <LoginScreen onLogin={performLogin} />
                    }>
                        <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-slate-400 font-mono text-sm animate-pulse whitespace-pre uppercase tracking-[0.5em]">
                            {error() ? (
                                <div class="text-red-500 animate-none flex flex-col items-center gap-4">
                                    <span>Error: {error()}</span>
                                    <button onClick={() => setError(null)} class="text-xs underline tracking-normal">Back to Login</button>
                                </div>
                            ) : (
                                "Linking Neural Grid..."
                            )}
                        </div>
                    </Show>
                  }
              >
                  <UIProvider>
                    <UserProvider initialUser={profile()!}>
                      <AppContent />
                    </UserProvider>
                  </UIProvider>
              </Show>
            </AppViewport>
          }
        >
          <div class="w-full h-full bg-slate-950 text-white font-sans overflow-hidden">
            <Show when={isDevPath()} fallback={(
              <Show when={isGameTextTestPath() || isGameTextV2TestPath()} fallback={(
                <Show when={isLoginMaterialPath()} fallback={(
                  <Show when={isMainMaterialPath()} fallback={(
                    <Show when={isUiNodePath()} fallback={<UiMaterialLabScreen />}>
                      <UiNodePreviewScreen />
                    </Show>
                  )}>
                    <MainMaterialPreviewScreen />
                  </Show>
                )}>
                  <LoginMaterialPreviewScreen />
                </Show>
              )}>
                <GameTextTestScreen version={isGameTextV2TestPath() ? 'v2' : 'v1'} />
              </Show>
            )}>
              <DevIndexScreen />
            </Show>
          </div>
        </Show>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
