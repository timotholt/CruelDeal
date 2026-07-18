import type { SetStoreFunction } from 'solid-js/store';

import type { ResolvedCard, UiState } from '../view';

export interface HandReservationCtx {
  setUi: SetStoreFunction<UiState>;
}

export const reserveHandSlots = (
  ctx: HandReservationCtx,
  cards: readonly ResolvedCard[],
): void => {
  if (cards.length === 0) return;
  ctx.setUi('handReservations', (previous) => {
    const known = new Set(previous.map((card) => card.id));
    const additions = cards.filter((card) => !known.has(card.id));
    return additions.length === 0 ? previous : [...previous, ...additions];
  });
};

export const releaseHandSlots = (
  ctx: HandReservationCtx,
  cardIds: readonly string[],
): void => {
  if (cardIds.length === 0) return;
  const released = new Set(cardIds);
  ctx.setUi('handReservations', (previous) => (
    previous.filter((card) => !released.has(card.id))
  ));
};

export const releaseAllHandSlots = (ctx: HandReservationCtx): void => {
  ctx.setUi('handReservations', []);
};

/**
 * Owns reservations for one presentation beat. Cleanup is unconditional:
 * animations are best-effort and may never leave gameplay interactivity gated.
 */
export const withHandReservations = async <T>(
  ctx: HandReservationCtx,
  cards: readonly ResolvedCard[],
  present: () => Promise<T>,
): Promise<T> => {
  reserveHandSlots(ctx, cards);
  try {
    return await present();
  } finally {
    releaseHandSlots(ctx, cards.map((card) => card.id));
  }
};
