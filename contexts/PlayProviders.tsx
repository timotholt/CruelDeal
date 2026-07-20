import type { JSX } from 'solid-js';
import type { MatchSession } from '@/services/playgame/runtime/matchSession';
import { MatchSessionProvider } from './MatchSessionContext';
import { PlayUiProvider } from './PlayUiContext';

export const PlayProviders = (props: {
  readonly children: JSX.Element;
  readonly session: MatchSession;
}) => (
  <MatchSessionProvider session={props.session}>
    <PlayUiProvider>{props.children}</PlayUiProvider>
  </MatchSessionProvider>
);
