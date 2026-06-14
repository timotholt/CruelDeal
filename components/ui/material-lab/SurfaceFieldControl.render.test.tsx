import { afterEach, describe, expect, it } from 'vitest';
import { render } from 'solid-js/web';
import { SurfaceFieldControl } from './SurfaceFieldControl';
import { surfaceFieldDefinitionByKey } from './surfaceFieldMetadata';
import type { SurfaceOptions } from './surfaceSchema';
import type { SurfaceEditorPatch } from './surfaceEditorFilters';

let container: HTMLDivElement | undefined;
let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  container?.remove();
  dispose = undefined;
  container = undefined;
});

const mountControl = <K extends keyof SurfaceOptions>(options: {
  key: K;
  value?: Partial<SurfaceOptions>;
  inheritedValue?: Partial<SurfaceOptions>;
  mode?: 'rest' | 'state';
  disabled?: boolean;
}) => {
  const patches: SurfaceEditorPatch[] = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  dispose = render(() => (
    <SurfaceFieldControl
      definition={surfaceFieldDefinitionByKey[options.key]}
      mode={options.mode ?? 'rest'}
      value={options.value ?? {}}
      inheritedValue={options.inheritedValue}
      disabled={options.disabled}
      onPatch={(patch) => patches.push(patch)}
    />
  ), container);
  return { element: container, patches };
};

const inputValue = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const selectValue = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('SurfaceFieldControl generated control interactions', () => {
  it('emits boolean patches from toggle controls', () => {
    const { element, patches } = mountControl({ key: 'glass', value: { glass: false } });
    element.querySelector('button')!.click();
    expect(patches).toEqual([{ glass: true }]);
  });

  it('emits array patches from multi-toggle controls', () => {
    const { element, patches } = mountControl({ key: 'bevelCorners', value: { bevelCorners: ['top-left'] } });
    const buttons = element.querySelectorAll('button');
    buttons[1].click();
    buttons[0].click();
    expect(patches).toEqual([
      { bevelCorners: ['top-left', 'top-right'] },
      { bevelCorners: [] },
    ]);
  });

  it('emits numeric patches from range sliders', () => {
    const { element, patches } = mountControl({ key: 'glassBlur', value: { glassBlur: 2 } });
    inputValue(element.querySelector('input[type="range"]')!, '3.5');
    expect(patches).toEqual([{ glassBlur: 3.5 }]);
  });

  it('emits exact stop values from stop sliders', () => {
    const { element, patches } = mountControl({ key: 'edgeWearScale', value: { edgeWearScale: 256 } });
    const input = element.querySelector('input[type="range"]')!;
    expect(input.min).toBe('0');
    expect(input.max).toBe('6');
    expect(input.step).toBe('1');
    inputValue(input, '5');
    expect(patches).toEqual([{ edgeWearScale: 2048 }]);
  });

  it('emits contextual select patches', () => {
    const { element, patches } = mountControl({ key: 'texture', value: { texture: 'none', textureStrength: 0 } });
    selectValue(element.querySelector('select')!, 'silver01');
    expect(patches).toEqual([{ texture: 'silver01', textureStrength: 100 }]);
  });

  it('emits color and text input patches', () => {
    const color = mountControl({ key: 'materialColor', value: { materialColor: '#808080' } });
    inputValue(color.element.querySelector('input[type="color"]')!, '#ffcc00');
    expect(color.patches).toEqual([{ materialColor: '#ffcc00' }]);
    dispose?.();
    color.element.remove();
    dispose = undefined;
    container = undefined;

    const text = mountControl({ key: 'textContent', value: { textContent: 'Launch' } });
    inputValue(text.element.querySelector('input.ui-lab-input')!, 'Deploy');
    expect(text.patches).toEqual([{ textContent: 'Deploy' }]);
  });

  it('emits inherit clear patches in state mode', () => {
    const { element, patches } = mountControl({
      key: 'contentTone',
      mode: 'state',
      value: { contentTone: 'gold' },
      inheritedValue: { contentTone: 'white' },
    });
    element.querySelector('button')!.click();
    expect(patches).toEqual([{ contentTone: undefined }]);
  });

  it('does not emit patches from disabled toggle controls', () => {
    const { element, patches } = mountControl({ key: 'glass', value: { glass: false }, disabled: true });
    const button = element.querySelector('button')!;
    expect(button.disabled).toBe(true);
    button.click();
    expect(patches).toEqual([]);
  });
});
