# Codex Response — Round 3 — MatchBootstrap incorporation

## Code verification

I independently verified the round-3 findings:

- `router.tsx` mounts `ClassicPlayScreen` at a parameterless `/play` route, and both Conquest and Ladder buttons in `HomeCommandBar.tsx` navigate to the same `PLAY` destination. `ClassicPlayScreen.tsx` reduces debug selection to two `Deck` arrays, creates a bare `MatchState`, and passes only that state to `PlayGameProvider`. `PlayGameContext.tsx` then defaults seat labels to `YOU` and `OPPONENT`.
- `services/playgame/script/actions.ts` imports and calls `planEnemyTurnFromPool` for the live remote seat, creates new instances from selected manifest definitions, and dispatches add/stage/energy events. Meanwhile `services/playgame/engine/resolve.ts` draws one real deck card per seat at the turn boundary. `services/playgame/engine/cli/runMatch.ts` already uses `planEnemyTurnFromHand`.
- `MatchConstants` has no `startingHandSize`. `services/playgame/script/flows.ts` performs four local opening deals; `runMatch.ts` hard-codes three opening draws for each seat and comments on the missing constant.
- `services/playgame/debug/buildDebugState.ts` warns and continues when a definition is unknown, so the resulting deck can be short.
- `Deck` accepts `variantId`, but both `createInitialMatchState` and `buildDebugMatchState` construct instances using only the definition. `CardInstance` contains no retained variant field, so the selection is discarded.
- The existing manifest declares `deckSize` and card variants but does not declare deck uniqueness or copy-limit rules. Bootstrap validation therefore needs a manifest/rules-schema declaration for those policies before it can enforce them without hard-coding an unstated rule.

## Change list

- Expanded the problem statement with the anonymous setup boundary, cosmetic opponent-deck bug, live/headless AI provenance split, 4-vs-3 opening-hand divergence, silent debug-deck shortening, and ignored variants.
- Added the complete `MatchBootstrap` shape with match, mode, seed, ruleset, manifest, viewer, participant, and frozen per-seat deck metadata.
- Defined session/bootstrap responsibilities: validate, copy, and deeply freeze both snapshots; retain presentation metadata in `MatchSession`; project only mechanical inputs into `MatchRuntime`; keep names and avatars out of `MatchState`; export the bootstrap with replay.
- Added Phase 0 deck-provenance and opening-hand divergence characterization requirements.
- Expanded Phase 1 to construct session/runtime from bootstrap, adapt the existing debug picker, enforce manifest/ruleset and deck length/definition/variant/copy/hash validation, make unknown debug entries hard errors, retain variants, introduce `startingHandSize`, switch live AI to real-hand intents, carry mode without ruleset branching, and include bootstrap in replay export.
- Expanded Phase 2 so `MatchSessionContext` supplies participant, deck, mode, match, viewer, name, and avatar metadata instead of `YOU`/`OPPONENT` provider defaults.
- Added the requested scope guards: collection wiring remains excluded because of the legacy-ID migration; collection ownership/possession checks are explicitly deferred; structural bootstrap validation remains in scope.
- Updated exit criteria, verification, module disposition, commit strategy, stop conditions, decisions, and approval questions to cover the bootstrap contract.

## Objections

None. The manifest-rule declaration noted above is necessary to implement the requested validation faithfully and is included in Phase 1.

EQUILIBRIUM
