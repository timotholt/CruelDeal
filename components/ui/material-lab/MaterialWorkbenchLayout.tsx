import { For, JSX, Show } from 'solid-js';
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
  selectionPulseTick?: number;
  selectionPulseEnabled?: boolean;
}

export const MaterialPartSelector = <T extends string>(props: MaterialPartSelectorProps<T>) => (
  <div class="ui-lab-control-grid">
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">UI Tree</SectionLabel>
      <div class="material-workbench-parts">
        <For each={props.parts}>
          {(part) => {
            const isSelected = () => props.selectedPartId === part.id;
            const pulseClass = () => (
              props.selectionPulseEnabled && isSelected()
                ? `is-selection-flash is-selection-flash-${(props.selectionPulseTick || 0) % 2 === 0 ? 'a' : 'b'}`
                : ''
            );
            return (
              <button
                type="button"
                class={`ui-lab-mini-button material-workbench-part-button material-workbench-part-button--depth-${part.depth ?? 0} ${isSelected() ? 'is-active' : ''} ${pulseClass()}`}
                onClick={() => props.onSelect(part.id)}
              >
                <strong>{part.label}</strong>
                <span>{part.detail}</span>
              </button>
            );
          }}
        </For>
      </div>
    </div>
  </div>
);

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
