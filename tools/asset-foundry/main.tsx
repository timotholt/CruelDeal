import { render } from 'solid-js/web';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { AssetWorkbenchScreen } from './AssetWorkbenchScreen';
import { CardBackLabScreen } from '../../components/screens/CardBackLabScreen';
import '../../index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount Asset Foundry');
}

document.fonts.ready.then(() => {
  document.body.classList.add('fonts-ready');
});

render(() => (
  <QueryClientProvider client={queryClient}>
    {new URLSearchParams(window.location.search).get('tool') === 'card-backs'
      ? <CardBackLabScreen />
      : <AssetWorkbenchScreen />}
  </QueryClientProvider>
), rootElement);
