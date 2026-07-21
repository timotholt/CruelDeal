# Retired Legacy Game

This directory quarantines the superseded pre-`services/playgame` match
architecture. It is historical source only: active application code must not
import it, and it is not kept runnable or type-checkable.

The retired graph includes:

- the mock authoritative match API (`services/api/matchService.ts`)
- the old phase/queue engine (`services/engine/**`)
- its AI, planning, effects, triggers, mutation, stat, and query modules
- the TypeScript card-effect implementations consumed only by that engine

Shared meta-game data remains in active source. In particular, `types.ts`,
`constants.ts`, configuration, collection, deck-editor, store, and progression
code were not migrated or repaired as part of this retirement.

CruelDeal's only active gameplay architecture is `services/playgame`.
