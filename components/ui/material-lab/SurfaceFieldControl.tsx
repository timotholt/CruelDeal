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

const arrayValue = (value: unknown) => (
  Array.isArray(value) ? value.map((item) => String(item)) : []
);

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

    if (props.definition.control === 'multi-toggle') {
      const values = () => arrayValue(current());
      const toggle = (option: string) => {
        const next = values().includes(option)
          ? values().filter((item) => item !== option)
          : [...values(), option];
        patch(next as SurfaceOptions[K]);
      };

      return (
        <div class="ui-lab-toggles">
          <For each={props.definition.options || []}>
            {(option) => (
              <button
                type="button"
                class={`ui-lab-mini-button ${values().includes(option) ? 'is-active' : ''}`}
                disabled={disabled()}
                onClick={() => toggle(option)}
              >
                {props.definition.optionLabels?.[option] || option}
              </button>
            )}
          </For>
        </div>
      );
    }

    if (props.definition.control === 'slider') {
      const value = () => numericValue(current());
      const stops = () => props.definition.valueStops || [];
      const stopIndex = () => Math.max(0, stops().findIndex((stop) => stop === value()));
      const hasStops = () => stops().length > 0;
      return (
        <label class="ui-lab-slider">
          <input
            type="range"
            min={hasStops() ? 0 : props.definition.min ?? 0}
            max={hasStops() ? stops().length - 1 : props.definition.max ?? 100}
            step={hasStops() ? 1 : props.definition.step ?? 1}
            value={hasStops() ? stopIndex() : value()}
            disabled={disabled()}
            onInput={(event) => patch(
              (hasStops()
                ? stops()[Number(event.currentTarget.value)]
                : Number(event.currentTarget.value)) as SurfaceOptions[K],
            )}
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
