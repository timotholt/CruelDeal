# Phase 1.5 Checkpoint 2 — Location Folders

Status: complete.

## Scope

The active Vantaris location catalog is now authored as one JSON file per
definition under:

```text
services/playgame/engine/manifest/location-sets/core-v1/locations/
```

The generated static import index is the only active registry. The old
TypeScript catalog is archived under `location-sets/deprecated/` and has no
active imports.

## Preserved contracts

- The original 37 playable definitions retain their exact normalized IDs,
  versions, rarity, abilities, display data, accents, and asset references.
- The Phase 1.5 `ruin` system definition remains in the runtime manifest but is
  non-drawable (`rarity: 0`, `status: system`).
- Explicit `poolOrder` values preserve the former manifest insertion order used
  by seeded weighted location selection.
- Three representative seeds freeze both their leading selections and full
  location-deck content hashes.
- The normalized 38-entry manifest payload retains SHA-256
  `a28d7f13a8a6b2d7fa3b8b3df1367ac742c646a2f5d9984a0e9de1e4cef44188`.
- Manifest version remains unchanged because authoring structure changed, not
  runtime content or behavior.

## Authoring gates

```sh
npm run locations:generate
npm run locations:generate:check
npm run locations:validate
```

Validation rejects folder/ID drift, duplicate or non-contiguous pool order,
unknown hooks and DSL operators, missing required DSL parameters, malformed
metadata/cosmetics/assets, invalid definition references, missing map files,
and generated-index drift.

The asset workbench now reads and updates each location's JSON file directly.
