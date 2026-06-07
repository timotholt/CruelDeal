import {
  serializeEditorOutput,
  type EditorOutputModeId,
} from '../ui/editor-output';

export type GameUiSkinProofJsonTabId = 'theme' | 'cms' | 'placements';

export const gameUiSkinProofOutputModeByTab = {
  theme: 'game-ui-theme',
  cms: 'game-cms-content',
  placements: 'game-ui-placements',
} as const satisfies Record<GameUiSkinProofJsonTabId, EditorOutputModeId>;

export const createGameUiSkinProofJsonReadout = (
  tab: GameUiSkinProofJsonTabId,
  value: unknown,
): string => (
  serializeEditorOutput(gameUiSkinProofOutputModeByTab[tab], value) || '{}\n'
);
