import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import appearanceFixture from './__fixtures__/mission-v2-r0.appearance.json';
import expectedPaintIr from './__fixtures__/mission-v2-r0.paint-ir.json';
import expectedAllocation from './__fixtures__/mission-v2-r0.chromium-150.allocation.json';
import { compileMissionPaintV1, serializePaintArtifact } from './paintCompiler';

const expectedCss = readFileSync(
  'components/ui/semantic-compiler/paint/__fixtures__/mission-v2-r0.appearance.css',
  'utf8',
);

describe('Mission Paint compiler for primary Chromium', () => {
  it('allocates every enabled layer exactly once with no helpers', () => {
    const result = compileMissionPaintV1(appearanceFixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.allocation.helpers).toEqual([]);

    const enabledLayerCount = appearanceFixture.graphs.flatMap((graph) => graph.layers).filter((layer) => layer.enabled).length;
    const allocated = result.allocation.entries.filter((entry) => entry.layerId !== '$geometry' && entry.enabled);
    expect(allocated).toHaveLength(enabledLayerCount);
    expect(new Set(allocated.map((entry) => `${entry.graphId}:${entry.layerId}`)).size).toBe(enabledLayerCount);
    expect(result.allocation.entries.filter((entry) => !entry.enabled).every((entry) => entry.slot === 'omitted')).toBe(true);
    expect(result.css).not.toContain('data-paint-helper');
    expect(result.css.split('}')[0]).not.toContain('position:');
    expect(result.css).not.toContain('var(--ui-fingerprint-mask-v1)');
    expect(result.css).toContain('/art/ui/fingerprint-svgrepo-v1.svg');
    expect(result.css).toContain('background-size: 100% 100%, 100% 100%, 18px 18px, 100% 100%, 100% 100%');
    expect(result.css).toContain('background-repeat: no-repeat, no-repeat, repeat, no-repeat, no-repeat');
    expect(result.css).toContain('calc(100% - 38px) 0, 100% 38px');
    expect(result.css).toContain("viewBox='0 0 100 100'");
    expect(result.css).toContain('border-top: 1px solid rgb(194 214 220 / 0.38)');
    expect(result.css).not.toContain('border: 1px solid rgb(194 214 220 / 0.38)');
  });

  it('uses the required host and pseudo-element allocations', () => {
    const result = compileMissionPaintV1(appearanceFixture);
    if (!result.ok) throw new Error('Fixture must compile.');
    const slot = (graphId: string, layerId: string) => result.allocation.entries.find(
      (entry) => entry.graphId === graphId && entry.layerId === layerId,
    )?.slot;
    expect(slot('mission-v2-r0.panel.idle', 'base')).toBe('host.background');
    expect(slot('mission-v2-r0.panel.idle', 'glass')).toBe('host.backdrop-filter');
    expect(slot('mission-v2-r0.panel.idle', 'reflection')).toBe('host.background');
    expect(slot('mission-v2-r0.panel.idle', 'rough-edge')).toBe('host.background');
    expect(slot('mission-v2-r0.primary-action.holding', 'fingerprint')).toBe('host::before');
    expect(slot('mission-v2-r0.primary-action.holding', 'brackets')).toBe('host.background');
    expect(slot('mission-v2-r0.primary-action.holding', 'scan')).toBe('host::after');
  });

  it('emits byte-identical IR, allocation, and CSS for identical input', () => {
    const first = compileMissionPaintV1(appearanceFixture);
    const second = compileMissionPaintV1(structuredClone(appearanceFixture));
    if (!first.ok || !second.ok) throw new Error('Fixture must compile.');
    expect(serializePaintArtifact(second.paintIr)).toBe(serializePaintArtifact(first.paintIr));
    expect(serializePaintArtifact(second.allocation)).toBe(serializePaintArtifact(first.allocation));
    expect(second.css).toBe(first.css);
    expect(serializePaintArtifact(first.paintIr)).toBe(serializePaintArtifact(expectedPaintIr));
    expect(serializePaintArtifact(first.allocation)).toBe(serializePaintArtifact(expectedAllocation));
    expect(first.css).toBe(expectedCss);
  });

  it('makes authored layer order an inspectable Paint IR delta', () => {
    const reordered = structuredClone(appearanceFixture);
    const layers = reordered.graphs[0].layers;
    [layers[0], layers[1]] = [layers[1], layers[0]];
    const first = compileMissionPaintV1(appearanceFixture);
    const second = compileMissionPaintV1(reordered);
    if (!first.ok || !second.ok) throw new Error('Fixtures must compile.');
    expect(second.paintIr.operations.slice(0, 2).map((operation) => operation.layerId)).toEqual(['glass', 'base']);
    expect(second.css).not.toBe(first.css);
  });

  it('rejects a graph that would require two exclusive before slots', () => {
    const invalid = structuredClone(appearanceFixture);
    invalid.graphs[2].layers.push({
      id: 'fingerprint-secondary',
      type: 'maskImage',
      enabled: true,
      assetId: 'fingerprint-svgrepo-v1',
      color: '#ffffff',
      opacity: 0.1,
    } as never);
    const result = compileMissionPaintV1(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].message).toContain('one host::before slot');
  });
});
