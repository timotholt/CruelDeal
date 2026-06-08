import {
  serializeEditorOutput,
  type EditorOutputModeId,
} from '../ui/editor-output';

export type UiNodePreviewJsonTabId = 'template' | 'cms' | 'theme';

export const uiNodePreviewOutputModeByTab = {
  template: 'ui-node',
  cms: 'ui-node-content',
  theme: 'ui-node-theme',
} as const satisfies Record<UiNodePreviewJsonTabId, EditorOutputModeId>;

export const createUiNodePreviewJsonReadout = (
  tab: UiNodePreviewJsonTabId,
  value: unknown,
): string => (
  serializeEditorOutput(uiNodePreviewOutputModeByTab[tab], value) || '{}\n'
);
