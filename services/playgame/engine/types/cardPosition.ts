/**
 * Owner-relative position inside a lane's 2×2 card grid.
 *
 * Slots are intentionally 1-based for rules text and JSON authoring:
 *
 *   slot 1  slot 2   row 1 — nearest the location
 *   slot 3  slot 4   row 2 — farthest from the location
 *   column 1 column 2
 *
 * The opponent grid is mirrored for presentation, but its logical positions
 * use the same owner-relative numbering.
 */
export type CardSlot = 1 | 2 | 3 | 4;
export type CardRow = 1 | 2;
export type CardColumn = 1 | 2;

export interface CardPositionCriteria {
  readonly slot?: CardSlot | readonly CardSlot[];
  readonly row?: CardRow | readonly CardRow[];
  readonly column?: CardColumn | readonly CardColumn[];
}

export interface CardBoardPosition {
  readonly slot: CardSlot;
  readonly row: CardRow;
  readonly column: CardColumn;
}
