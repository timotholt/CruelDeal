# Deprecated /play Presentation Helpers

Phase 1.21 replaced the transposed three-row board and imperative lane-map
measurement with stable, keyed vertical `LaneColumn` components.

These files are retained only as implementation history:

- `laneLayout.ts` projected independent row columns.
- `useLaneMaps.ts` measured those rows and appended map nodes imperatively.

Canonical `/play` code must not import this folder.
