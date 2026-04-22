/**
 * Brand types for engine identifiers. See spec §3.1.
 *
 * Branded strings prevent accidental swaps between CardId and LocationId at
 * type-check time. Use `mkCardId(...)` etc. at the boundary; internal engine
 * code just passes them around as opaque.
 */

export type CardId = string & { readonly __brand: 'CardId' };
export type LocationId = string & { readonly __brand: 'LocationId' };

export type Owner = 'PLAYER' | 'OPP';
export type LaneIdx = 0 | 1 | 2;

export const mkCardId = (s: string): CardId => s as CardId;
export const mkLocationId = (s: string): LocationId => s as LocationId;
