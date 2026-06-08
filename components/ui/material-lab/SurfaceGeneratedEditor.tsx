import { For, Show } from 'solid-js';
import { SectionLabel } from './MaterialPrimitives';
import type { SurfaceOptions } from './surfaceSchema';
import type { SurfaceFieldGroup } from './surfaceFieldMetadata';
import { SurfaceFieldControl } from './SurfaceFieldControl';
import {
  surfaceFieldDisabledByCapabilities,
  visibleSurfaceFieldDefinitions,
  type SurfaceEditorCapabilities,
  type SurfaceEditorMode,
  type SurfaceEditorPatch,
} from './surfaceEditorFilters';

export const SurfaceGeneratedEditor = (props: {
  title: string;
  mode: SurfaceEditorMode;
  value: Partial<SurfaceOptions>;
  inheritedValue?: Partial<SurfaceOptions>;
  groups?: readonly SurfaceFieldGroup[];
  fields?: readonly (keyof SurfaceOptions)[];
  capabilities?: SurfaceEditorCapabilities;
  enabled?: boolean;
  inheritControls?: boolean;
  onPatch: (patch: SurfaceEditorPatch) => void;
}) => {
  const fields = () => visibleSurfaceFieldDefinitions({
    mode: props.mode,
    groups: props.groups,
    fields: props.fields,
    capabilities: props.capabilities,
  });
  const enabled = () => props.enabled ?? true;

  return (
    <Show when={fields().length > 0}>
      <div class={`ui-lab-control-group ${enabled() ? '' : 'ui-lab-control-group--disabled'}`}>
        <SectionLabel size="xs">{props.title}</SectionLabel>
        <For each={fields()}>
          {(definition) => (
            <SurfaceFieldControl
              definition={definition}
              mode={props.mode}
              value={props.value}
              inheritedValue={props.inheritedValue}
              disabled={!enabled() || surfaceFieldDisabledByCapabilities(definition, props.capabilities)}
              inheritControls={props.inheritControls}
              onPatch={props.onPatch}
            />
          )}
        </For>
      </div>
    </Show>
  );
};
