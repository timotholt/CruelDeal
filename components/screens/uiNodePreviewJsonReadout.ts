import {
  serializeEditorOutput,
  type EditorOutputModeId,
} from '../ui/editor-output';

export type UiNodePreviewJsonTabId = 'template' | 'cms' | 'theme';

export const uiNodePreviewOutputModeByTab = {
  template: 'ui-node',
} as const satisfies Partial<Record<UiNodePreviewJsonTabId, EditorOutputModeId>>;

export const createUiNodePreviewJsonReadout = (
  tab: UiNodePreviewJsonTabId,
  value: unknown,
): string => {
  const mode = uiNodePreviewOutputModeByTab[tab];
  if (mode) return serializeEditorOutput(mode, value) || '{}\n';
  return `${JSON.stringify(value, null, 2)}\n`;
};
