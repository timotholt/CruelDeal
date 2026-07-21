import type { JSX } from 'solid-js';
import type { MatchClient } from '@/services/playgame/client/matchClient';
import { MatchSessionProvider } from './MatchSessionContext';
import { PlayUiProvider } from './PlayUiContext';

export const PlayProviders = (props: {
  readonly children: JSX.Element;
  readonly client: MatchClient;
}) => (
  <MatchSessionProvider client={props.client}>
    <PlayUiProvider>{props.children}</PlayUiProvider>
  </MatchSessionProvider>
);
