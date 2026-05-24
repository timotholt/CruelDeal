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

/**
 * App Entry Component
 * Handles the initial data fetching and provider initialization.
 */
export default function App() {
  const [profile, setProfile] = createSignal<UserProfile | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = createSignal(false);
  const isUiTestPath = () => window.location.pathname.toLowerCase().startsWith('/uitest');
  const isLoginMaterialPath = () => window.location.pathname.toLowerCase().startsWith('/login-material');

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
          when={isUiTestPath() || isLoginMaterialPath()}
          fallback={
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
          }
        >
          <div class="w-full h-full bg-slate-950 text-white font-sans overflow-hidden">
            <Show when={isLoginMaterialPath()} fallback={<UiMaterialLabScreen />}>
              <LoginMaterialPreviewScreen />
            </Show>
          </div>
        </Show>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
