import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { CardBackMaterial } from './CardBackMaterial';

const mounted: HTMLElement[] = [];

const mount = (renderMaterial: () => ReturnType<typeof CardBackMaterial>) => {
  const host = document.createElement('div');
  document.body.append(host);
  mounted.push(host);
  render(renderMaterial, host);
  return host;
};

describe('CardBackMaterial', () => {
  afterEach(() => {
    mounted.splice(0).forEach(host => host.remove());
  });

  it('defaults to a static onyx material that does not register for reflex updates', () => {
    const host = mount(() => <CardBackMaterial />);
    const material = host.querySelector<HTMLElement>('.card-back-material');
    const base = host.querySelector<HTMLImageElement>('.card-back-material__base');
    const reflection = host.querySelector<HTMLElement>('.card-back-material__reflection');

    expect(material?.dataset.cardBackVariant).toBe('onyx');
    expect(material?.dataset.cardBackMotion).toBe('static');
    expect(base?.getAttribute('src')).toBe('/art/card-backs/scg-back-onyx.png');
    expect(reflection?.classList.contains('metal-surface-gold')).toBe(false);
  });

  it('registers only an explicitly dynamic back with the shared reflex controller', () => {
    const host = mount(() => <CardBackMaterial variant="ivory" motion="dynamic" />);
    const material = host.querySelector<HTMLElement>('.card-back-material');
    const base = host.querySelector<HTMLImageElement>('.card-back-material__base');
    const reflection = host.querySelector<HTMLElement>('.card-back-material__reflection');

    expect(material?.dataset.cardBackVariant).toBe('ivory');
    expect(material?.dataset.cardBackMotion).toBe('dynamic');
    expect(base?.getAttribute('src')).toBe('/art/card-backs/scg-back-ivory.png');
    expect(reflection?.classList.contains('metal-surface-gold')).toBe(true);
  });

  it('keeps the reflection layer mounted for an inexpensive static sample', () => {
    const staticHost = mount(() => <CardBackMaterial motion="static" />);
    const offHost = mount(() => <CardBackMaterial motion="off" />);

    expect(staticHost.querySelector('.card-back-material__reflection')).not.toBeNull();
    expect(offHost.querySelector<HTMLElement>('.card-back-material')?.dataset.cardBackMotion).toBe('off');
  });
});
