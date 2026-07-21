import { ErrorBoundary, onMount } from 'solid-js';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { RouterProvider } from '@tanstack/solid-router';
import { initReflex, publishShinyCssVars } from './components/ui/shiny';
import { router } from './router';

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
 * Application entry point. Route selection, authentication, application chrome,
 * and development layouts are owned by the router.
 */
export default function App() {
  publishShinyCssVars();
  onMount(initReflex);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary
        fallback={(err) => (
          <div class="w-full h-full bg-slate-950 flex flex-col items-center justify-center text-red-500 font-mono text-sm p-4 text-center">
            <div class="text-xl mb-4 text-white font-black italic">CRITICAL ERROR</div>
            <div class="max-w-md break-words whitespace-pre-wrap opacity-80">
              {err?.message || 'Unknown rendering error'}
            </div>
            <button
              class="mt-8 px-6 py-2 bg-indigo-600 text-white font-bold italic tracking-tighter skew-x-[-12deg] hover:bg-indigo-500 transition-colors"
              onClick={() => window.location.reload()}
            >
              REBOOT SYSTEM
            </button>
          </div>
        )}
      >
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
