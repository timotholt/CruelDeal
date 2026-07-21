import { describe, expect, it } from 'vitest';
import type { ResolvedCard, ResolvedLocation } from '@/services/playgame/view';
import { cardSurfaceModel } from './cardAppearance';
import { laneVisualModel, locationSurfaceModel } from './locationAppearance';

const card = (overrides: Partial<ResolvedCard> = {}): ResolvedCard => ({
  id: 'seat-token',
  defId: 'operative',
  name: 'Operative',
  cost: 2,
  baseCost: 2,
  power: 3,
  basePower: 3,
  art: '#123456',
  portraitPath: '/card.png',
  type: 'character',
  text: 'Rules.',
  textDisabled: false,
  owner: 'P0',
  zone: 'HAND',
  revealed: true,
  storedPowerDelta: 0,
  stats: null,
  ...overrides,
});

const location = (overrides: Partial<ResolvedLocation> = {}): ResolvedLocation => ({
  defId: 'pawn-shop',
  name: 'Pawn Shop',
  desc: 'Rules.',
  art: '#654321',
  mapArt: '/location.png',
  revealed: true,
  ...overrides,
});

describe('surface appearance mappers', () => {
  it('keeps dynamic card changes out of the static content key', () => {
    const original = cardSurfaceModel(card());
    const changed = cardSurfaceModel(card({ cost: 5, power: -2, textDisabled: true }));
    expect(original.face.kind).toBe('front');
    expect(changed.face.kind).toBe('front');
    if (original.face.kind !== 'front' || changed.face.kind !== 'front') return;
    expect(changed.face.content.cacheKey).toBe(original.face.content.cacheKey);
    expect(changed.cost?.value).toBe(5);
    expect(changed.power?.value).toBe(-2);
    expect(changed.statuses).toEqual([{ key: 'disabled', kind: 'disabled' }]);
  });

  it('changes the static key for card-authored pixel changes', () => {
    const original = cardSurfaceModel(card());
    const changed = cardSurfaceModel(card({ name: 'Different', text: 'New rules.' }));
    if (original.face.kind !== 'front' || changed.face.kind !== 'front') throw new Error('front expected');
    expect(changed.face.content.cacheKey).not.toBe(original.face.content.cacheKey);
  });

  it('creates identity-free card backs', () => {
    const hidden = cardSurfaceModel(card({
      defId: null,
      name: '',
      portraitPath: null,
      type: '',
      text: '',
    }));
    expect(hidden.face).toEqual({ kind: 'back', backStyle: 'default' });
    expect(hidden.cost).toBeNull();
    expect(hidden.power).toBeNull();
    expect(JSON.stringify(hidden)).not.toContain('seat-token');
    expect(JSON.stringify(hidden)).not.toContain('operative');
  });

  it('keeps lane scores outside the location surface model', () => {
    const surface = locationSurfaceModel(location());
    const lane = laneVisualModel(location(), -12, 34);
    expect(surface).not.toHaveProperty('topScore');
    expect(surface).not.toHaveProperty('bottomScore');
    expect(lane.topScore).toEqual({ value: -12, tone: 'remote' });
    expect(lane.bottomScore).toEqual({ value: 34, tone: 'local' });
  });

  it('creates identity-free location backs', () => {
    const hidden = locationSurfaceModel(location({ defId: '', revealed: false }));
    expect(hidden.face).toEqual({ kind: 'back', backStyle: 'default' });
    expect(JSON.stringify(hidden)).not.toContain('pawn-shop');
  });
});
