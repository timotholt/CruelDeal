import { createMemo, For, JSX, Show } from 'solid-js';
import { Tree, type TreeNodeData } from '@timotholt/solid-tree';
import '@timotholt/solid-tree/theme.css';
import { MaterialPanel, SectionLabel } from './MaterialPrimitives';

export interface MaterialWorkbenchPart<T extends string = string> {
  id: T;
  label: string;
  detail?: string;
  depth?: number;
}

interface MaterialPartSelectorProps<T extends string> {
  parts: MaterialWorkbenchPart<T>[];
  selectedPartId: T;
  onSelect: (id: T) => void;
  storageKey?: string;
  selectionPulseTick?: number;
  selectionPulseEnabled?: boolean;
}

export const materialWorkbenchPartsToTreeData = <T extends string>(
  parts: MaterialWorkbenchPart<T>[],
): TreeNodeData[] => {
  const roots: TreeNodeData[] = [];
  const ancestors: TreeNodeData[] = [];
  for (const part of parts) {
    const requestedDepth = Math.max(0, Math.floor(part.depth ?? 0));
    const depth = Math.min(requestedDepth, ancestors.length);
    ancestors.length = depth;
    const node: TreeNodeData = {
      id: part.id,
      label: part.label,
      status: part.detail,
      type: 'material-workbench-part',
      children: [],
    };
    if (depth === 0) {
      roots.push(node);
    } else {
      ancestors[depth - 1].children!.push(node);
    }
    ancestors.push(node);
  }
  return roots;
};

export const MaterialPartSelector = <T extends string>(props: MaterialPartSelectorProps<T>) => {
  const treeData = createMemo(() => materialWorkbenchPartsToTreeData(props.parts));
  const pulseClass = () => props.selectionPulseEnabled
    ? `is-selection-flash-${(props.selectionPulseTick || 0) % 2 === 0 ? 'a' : 'b'}`
    : '';
  return (
    <div class="ui-lab-control-grid">
      <div class="ui-lab-control-group">
        <SectionLabel size="xs">UI Tree</SectionLabel>
        <div class={`material-workbench-parts ${pulseClass()}`}>
          <Tree
            data={treeData()}
            selectedId={props.selectedPartId}
            ariaLabel="Editable UI component tree"
            storageKey={props.storageKey}
            storagePrefix="cruel-deal"
            rowClickPolicy="select-only"
            basePadding={4}
            indentStep={13}
            onSelect={(node) => props.onSelect(node.id as T)}
            renderLabel={(node) => (
              <span class="material-workbench-tree-label">
                <strong>{node.label}</strong>
                <Show when={node.status}><span>{node.status}</span></Show>
              </span>
            )}
          />
        </div>
      </div>
    </div>
  );
};

interface MaterialWorkbenchLayoutProps<T extends string> {
  title: string;
  subtitle?: string;
  sidebarTabs?: Array<{ id: string; label: string }>;
  selectedSidebarTabId?: string;
  onSelectSidebarTab?: (id: string) => void;
  sidebarAlt?: JSX.Element;
  parts: MaterialWorkbenchPart<T>[];
  selectedPartId: T;
  onSelectPart: (id: T) => void;
  treeStorageKey?: string;
  selectionPulseTick?: number;
  selectionPulseEnabled?: boolean;
  preview: JSX.Element;
  editor: JSX.Element;
  footer?: JSX.Element;
  actions?: JSX.Element;
  class?: string;
}

export const MaterialWorkbenchLayout = <T extends string>(props: MaterialWorkbenchLayoutProps<T>) => (
  <main class={`material-workbench ${props.class || ''}`}>
    <aside class="material-workbench-sidebar material-workbench-sidebar--parts">
      <MaterialPanel
        material="white"
        texture="stone04"
        textureStrength={100}
        textureScale={512}
        borderOpacity={52}
        radius={8}
        padded
        class="ui-lab-controls-panel material-workbench-controls-panel material-workbench-controls-panel--parts"
      >
        <div class="ui-lab-controls-drag">
          <span>{props.title}</span>
          <span>Select</span>
        </div>
        <Show when={props.sidebarTabs?.length}>
          <div class="ui-lab-state-tabs material-workbench-sidebar-tabs">
            <For each={props.sidebarTabs}>
              {(tab) => (
                <button
                  type="button"
                  class={`ui-lab-state-tab ${props.selectedSidebarTabId === tab.id ? 'is-active' : ''}`}
                  onClick={() => props.onSelectSidebarTab?.(tab.id)}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>
        </Show>
        <Show
          when={!props.sidebarTabs?.length || !props.selectedSidebarTabId || props.selectedSidebarTabId === 'parts'}
          fallback={props.sidebarAlt}
        >
          <MaterialPartSelector
            parts={props.parts}
            selectedPartId={props.selectedPartId}
            onSelect={props.onSelectPart}
            storageKey={props.treeStorageKey ?? props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
            selectionPulseTick={props.selectionPulseTick}
            selectionPulseEnabled={props.selectionPulseEnabled}
          />
        </Show>
        <div class="material-workbench-footer">
          {props.actions}
          {props.footer}
        </div>
      </MaterialPanel>
    </aside>

    <section class="material-workbench-stage">
      {props.preview}
    </section>

    <aside class="material-workbench-sidebar material-workbench-sidebar--editor">
      <MaterialPanel
        material="white"
        texture="stone04"
        textureStrength={100}
        textureScale={512}
        borderOpacity={52}
        radius={8}
        padded
        class="ui-lab-controls-panel material-workbench-controls-panel"
      >
        <div class="ui-lab-controls-drag">
          <span>Controls</span>
          <span>Drag</span>
        </div>
        <div class="ui-lab-control-grid">
          {props.editor}
        </div>
      </MaterialPanel>
    </aside>
  </main>
);
