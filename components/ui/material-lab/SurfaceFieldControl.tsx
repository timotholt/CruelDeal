import { For, JSX, Show } from 'solid-js';
import type { SurfaceOptions } from './surfaceSchema';
import type { SurfaceFieldDefinition } from './surfaceFieldMetadata';
import {
  clearSurfaceField,
  patchSurfaceFieldWithContext,
  type SurfaceEditorMode,
  type SurfaceEditorPatch,
} from './surfaceEditorFilters';

const valueForField = <K extends keyof SurfaceOptions>(
  definition: SurfaceFieldDefinition<K>,
  value: Partial<SurfaceOptions>,
  inheritedValue?: Partial<SurfaceOptions>,
) => (
  value[definition.key] ?? inheritedValue?.[definition.key] ?? ''
) as SurfaceOptions[K] | '';

const numericValue = (value: unknown) => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const booleanValue = (value: unknown) => value === true;

const stringValue = (value: unknown) => (
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''
);

export const SurfaceFieldControl = <K extends keyof SurfaceOptions>(props: {
  definition: SurfaceFieldDefinition<K>;
  mode: SurfaceEditorMode;
  value: Partial<SurfaceOptions>;
  inheritedValue?: Partial<SurfaceOptions>;
  disabled?: boolean;
  onPatch: (patch: SurfaceEditorPatch) => void;
}) => {
  const hasOverride = () => Object.prototype.hasOwnProperty.call(props.value, props.definition.key);
  const current = () => valueForField(props.definition, props.value, props.inheritedValue);
  const disabled = () => !!props.disabled;
  const patch = (value: SurfaceOptions[K]) => props.onPatch(patchSurfaceFieldWithContext(
    props.definition.key,
    value,
    { ...props.inheritedValue, ...props.value },
  ));
  const clear = () => props.onPatch(clearSurfaceField(props.definition.key));

  const control = (): JSX.Element => {
    if (props.definition.control === 'toggle') {
      return (
        <div class="ui-lab-toggles">
          <button
            type="button"
            class={`ui-lab-mini-button ${booleanValue(current()) ? 'is-active' : ''}`}
            disabled={disabled()}
            onClick={() => patch(!booleanValue(current()) as SurfaceOptions[K])}
          >
            on
          </button>
        </div>
      );
    }

    if (props.definition.control === 'slider') {
      const value = () => numericValue(current());
      return (
        <label class="ui-lab-slider">
          <input
            type="range"
            min={props.definition.min ?? 0}
            max={props.definition.max ?? 100}
            step={props.definition.step ?? 1}
            value={value()}
            disabled={disabled()}
            onInput={(event) => patch(Number(event.currentTarget.value) as SurfaceOptions[K])}
          />
          <output>{value()}</output>
        </label>
      );
    }

    if (props.definition.control === 'select') {
      return (
        <select
          class="ui-lab-select"
          value={stringValue(current())}
          disabled={disabled() || !props.definition.options?.length}
          onChange={(event) => patch(event.currentTarget.value as SurfaceOptions[K])}
        >
          <For each={props.definition.options || []}>
            {(option) => <option value={option}>{props.definition.optionLabels?.[option] || option}</option>}
          </For>
        </select>
      );
    }

    if (props.definition.control === 'color') {
      return (
        <input
          class="ui-lab-color-input"
          type="color"
          value={stringValue(current()) || '#808080'}
          disabled={disabled()}
          onInput={(event) => patch(event.currentTarget.value as SurfaceOptions[K])}
        />
      );
    }

    if (props.definition.control === 'text') {
      return (
        <input
          class="ui-lab-input"
          value={stringValue(current())}
          disabled={disabled()}
          onInput={(event) => patch(event.currentTarget.value as SurfaceOptions[K])}
        />
      );
    }

    return (
      <textarea
        class="ui-lab-input"
        value={JSON.stringify(current() || null)}
        disabled
      />
    );
  };

  return (
    <div class={`ui-lab-control-row ${disabled() ? 'ui-lab-control-row--disabled' : ''}`}>
      <span class="ui-lab-control-label">{props.definition.label}</span>
      <div class="ui-lab-stack">
        <Show when={props.mode === 'state'}>
          <button
            type="button"
            class={`ui-lab-mini-button ${!hasOverride() ? 'is-active' : ''}`}
            disabled={disabled()}
            onClick={clear}
          >
            inherit
          </button>
        </Show>
        {control()}
      </div>
    </div>
  );
};
