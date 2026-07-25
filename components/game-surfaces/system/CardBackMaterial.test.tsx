import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { CardBackMaterial } from './CardBackMaterial';
import { ReferenceCardBackMaterial } from './card-backs/ReferenceCardBackMaterial';

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
    const base = host.querySelector<SVGSVGElement>('.card-back-material__base');
    const reflection = host.querySelector<SVGSVGElement>('.card-back-material__reflection');

    expect(material?.dataset.cardBackDesign).toBe('cruel-company-master-01');
    expect(material?.dataset.cardBackVariant).toBe('onyx');
    expect(material?.dataset.cardBackMotion).toBe('static');
    expect(base?.getAttribute('viewBox')).toBe('0 0 1000 1400');
    const substrate = base?.querySelector('image[href="/art/card-backs/cruel-company-substrate-onyx-albedo-v5.png"]');
    expect(substrate).not.toBeNull();
    expect(substrate?.getAttribute('x')).toBe('0');
    expect(substrate?.getAttribute('y')).toBe('0');
    expect(substrate?.getAttribute('width')).toBe('1000');
    expect(substrate?.getAttribute('height')).toBe('1400');
    expect(base?.querySelector('.card-back-artwork__structural-gold')).not.toBeNull();
    expect(base?.querySelector('.card-back-artwork__identity')).not.toBeNull();
    expect(material?.classList.contains('metal-surface-gold')).toBe(false);
    expect(reflection).not.toBeNull();
  });

  it('keeps the Three.js authoring surface, SVG fallback, gold finish, and reflection distinct', () => {
    const rebuiltHost = mount(() => <CardBackMaterial />);
    const referenceHost = mount(() => <ReferenceCardBackMaterial />);

    expect(Array.from(rebuiltHost.querySelector('.card-back-material')?.children ?? []).map(layer => layer.getAttribute('class'))).toEqual([
      'card-back-material__surface',
      'procedural-card-back-art card-back-material__base',
      'card-back-material__gold-finish',
      'card-back-material__reflection',
    ]);
    expect(rebuiltHost.querySelector('[data-card-back-three="extruded-geometry-lighting"]')).not.toBeNull();
    expect(Array.from(referenceHost.querySelector('.reference-card-back-material')?.children ?? []).map(layer => layer.className)).toEqual([
      'reference-card-back-material__base',
      'reference-card-back-material__gold-response',
      'reference-card-back-material__key-light',
      'reference-card-back-material__reflection',
    ]);
  });

  it('can render lightweight proof cards without creating another WebGL scene', () => {
    const host = mount(() => <CardBackMaterial renderSurface={false} />);

    expect(host.querySelector('[data-card-back-three]')).toBeNull();
    expect(host.querySelector('.card-back-material__base')).not.toBeNull();
    expect(host.querySelector('.card-back-material__gold-finish')).not.toBeNull();
    expect(host.querySelector('.card-back-material__key-light')).not.toBeNull();
    expect(host.querySelector('.card-back-material__reflection')).not.toBeNull();
  });

  it('registers only an explicitly dynamic HTML shell with the shared reflex controller', () => {
    const host = mount(() => (
      <CardBackMaterial
        variant="ivory"
        motion="dynamic"
        caption="CC-7"
        emblem="CX"
        emblemFont="monospace"
        microTextA="TEXT A"
        microTextB="TEXT B"
        relief={{ hexWidth: 31 }}
      />
    ));
    const material = host.querySelector<HTMLElement>('.card-back-material');
    const base = host.querySelector<SVGSVGElement>('.card-back-material__base');
    const reflection = host.querySelector<SVGSVGElement>('.card-back-material__reflection');

    expect(material?.dataset.cardBackVariant).toBe('ivory');
    expect(material?.dataset.cardBackMotion).toBe('dynamic');
    expect(material?.classList.contains('metal-surface-gold')).toBe(true);
    expect(base?.querySelector('[data-card-back-text="CC-7"]')).not.toBeNull();
    expect(base?.querySelector('[data-card-back-text="TEXT A"]')).not.toBeNull();
    expect(base?.querySelector('[data-card-back-text="TEXT B"]')).not.toBeNull();
    const captionOutlines = Array.from(host.querySelectorAll<SVGPathElement>('[data-card-back-text="CC-7"]'));
    expect(captionOutlines.length).toBe(3);
    expect(new Set(captionOutlines.map(path => path.getAttribute('d'))).size).toBe(1);
    const emblemOutlines = Array.from(host.querySelectorAll<SVGPathElement>('[data-card-back-emblem="CX"]'));
    expect(emblemOutlines.length).toBe(3);
    expect(new Set(emblemOutlines.map(path => path.getAttribute('d'))).size).toBe(1);
    const hexOutlines = Array.from(host.querySelectorAll<SVGPathElement>('mask [data-card-back-structure="hex"]'));
    expect(hexOutlines.length).toBeGreaterThanOrEqual(3);
    expect(new Set(hexOutlines.map(path => path.getAttribute('stroke-width')))).toEqual(new Set(['31']));
    const structuralPaths = reflection?.querySelectorAll('mask path');
    expect(structuralPaths?.length).toBeGreaterThanOrEqual(5);
    expect(reflection?.querySelector('mask image')).toBeNull();
  });

  it('can independently disable every material layer', () => {
    const host = mount(() => (
      <CardBackMaterial layers={{
        substrate: false,
        grooves: false,
        structuralGold: false,
        identity: false,
        finish: false,
        keyLight: false,
        reflection: false,
      }} />
    ));

    expect(host.querySelector('.card-back-artwork__substrate')).toBeNull();
    expect(host.querySelector('.card-back-artwork__grooves')).toBeNull();
    expect(host.querySelector('.card-back-artwork__structural-gold')).toBeNull();
    expect(host.querySelector('.card-back-artwork__identity')).toBeNull();
    expect(host.querySelector('.card-back-material__gold-finish')).toBeNull();
    expect(host.querySelector('.card-back-material__key-light')).toBeNull();
    expect(host.querySelector('.card-back-material__reflection')).toBeNull();
  });

  it('falls back to ambient groove depth when the key light is disabled', () => {
    const host = mount(() => <CardBackMaterial layers={{ keyLight: false }} />);
    const grooves = host.querySelector('[data-groove-lighting]');

    expect(grooves?.getAttribute('data-groove-lighting')).toBe('ambient');
    expect(grooves?.getAttribute('filter')).toContain('groove-ambient');
    expect(host.querySelector('.card-back-material__key-light')).toBeNull();
  });

  it('keeps the reflection layer mounted for an inexpensive static sample', () => {
    const staticHost = mount(() => <CardBackMaterial motion="static" />);
    const offHost = mount(() => <CardBackMaterial motion="off" />);

    expect(staticHost.querySelector('.card-back-material__reflection')).not.toBeNull();
    expect(offHost.querySelector<HTMLElement>('.card-back-material')?.dataset.cardBackMotion).toBe('off');
  });
});
