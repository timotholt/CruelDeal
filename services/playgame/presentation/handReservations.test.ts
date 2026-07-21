import { describe, expect, it } from 'vitest';

import type { ResolvedCard, UiState } from '../view';
import {
  releaseAllHandSlots,
  withHandReservations,
  type HandReservationCtx,
} from './handReservations';

const card = (id: string): ResolvedCard => ({ id } as ResolvedCard);

const fixture = () => {
  const ui = { handReservations: [] } as unknown as UiState;
  const ctx: HandReservationCtx = {
    setUi: ((key: keyof UiState, value: unknown) => {
      if (key !== 'handReservations') throw new Error(`unexpected UI key ${key}`);
      ui.handReservations = typeof value === 'function'
        ? value(ui.handReservations)
        : value as ResolvedCard[];
    }) as HandReservationCtx['setUi'],
  };
  return { ctx, ui };
};

describe('presentation hand reservations', () => {
  it('releases every owned slot after successful and failed presentation beats', async () => {
    const { ctx, ui } = fixture();

    await withHandReservations(ctx, [card('opening-1'), card('opening-2')], async () => {
      expect(ui.handReservations.map((item) => item.id)).toEqual(['opening-1', 'opening-2']);
    });
    expect(ui.handReservations).toEqual([]);

    await expect(withHandReservations(ctx, [card('opening-3')], async () => {
      expect(ui.handReservations.map((item) => item.id)).toEqual(['opening-3']);
      throw new Error('animation failed');
    })).rejects.toThrow('animation failed');
    expect(ui.handReservations).toEqual([]);
  });

  it('clears all residual reservations on a presentation abort', () => {
    const { ctx, ui } = fixture();
    ui.handReservations = [card('stuck-opening-card')];
    releaseAllHandSlots(ctx);

    expect(ui.handReservations).toEqual([]);
  });
});
