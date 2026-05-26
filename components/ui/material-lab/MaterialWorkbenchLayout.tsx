import { For, JSX } from 'solid-js';
import { MaterialPanel, SectionLabel } from './MaterialPrimitives';

export interface MaterialWorkbenchPart<T extends string = string> {
  id: T;
  label: string;
  detail?: string;
}

interface MaterialPartSelectorProps<T extends string> {
  parts: MaterialWorkbenchPart<T>[];
  selectedPartId: T;
  onSelect: (id: T) => void;
}

export const MaterialPartSelector = <T extends string>(props: MaterialPartSelectorProps<T>) => (
  <div class="ui-lab-control-grid">
    <div class="ui-lab-control-group">
      <SectionLabel size="xs">Parts</SectionLabel>
      <div class="material-workbench-parts">
        <For each={props.parts}>
          {(part) => (
            <button
              type="button"
              class={`ui-lab-mini-button ${props.selectedPartId === part.id ? 'is-active' : ''}`}
              onClick={() => props.onSelect(part.id)}
            >
              <strong>{part.label}</strong>
              <span>{part.detail}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  </div>
);

interface MaterialWorkbenchLayoutProps<T extends string> {
  title: string;
  subtitle?: string;
  parts: MaterialWorkbenchPart<T>[];
  selectedPartId: T;
  onSelectPart: (id: T) => void;
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
        material="raw"
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
        <MaterialPartSelector
          parts={props.parts}
          selectedPartId={props.selectedPartId}
          onSelect={props.onSelectPart}
        />
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
        material="raw"
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
