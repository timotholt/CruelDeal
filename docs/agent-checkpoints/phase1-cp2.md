# Phase 1 Checkpoint 2 — Bootstrap Validation, Variants, and Shared Opening

Status: checkpoint complete. This lands the bootstrap/provenance/opening
foundation only; it does not migrate live script authority or construct the
Phase 1 session/queue/committer.

## Implemented

### Manifest-owned setup policy

- Added `startingHandSize` to `MatchConstants`; the bootstrap manifest sets it
  to 3.
- Added versioned manifest rulesets with declarative deck-construction policy:
  optional ruleset card enablement, default/per-definition copy limits, and
  explicit unique definitions. Omitted declarations are not inferred or
  enforced.
- Added the `standard` ruleset with a one-copy default and bumped the bootstrap
  manifest from version 1 to version 2 because setup mechanics changed.

### Bootstrap validation

- Added `computeDeckContentHash()` with a versioned canonical encoding of the
  ordered `(defId, variantId)` entries and a synchronous browser-safe SHA-256.
- Added `validateMatchBootstrap(input, manifest)` with structural checks for
  the complete checkpoint-1 descriptor, manifest version and ruleset
  resolution, exact manifest `deckSize`, known/enabled definitions, selected
  variant existence, and only the uniqueness/copy rules declared by the
  selected ruleset.
- Successful validation reconstructs session-owned plain data and deeply
  freezes the root, participant records, deck records, entry arrays, and every
  entry. Failed results return typed checkpoint-1 issue codes.
- Collection possession and ownership validation remains deferred, as scoped.

### Variant provenance and debug failure

- Added optional immutable `variantId` to `CardInstance`.
- Genesis and debug deck creation retain the selected entry variant.
- Normal reducer movement, opening draws, and replay folds retain it;
  transformation clears a now-inapplicable cosmetic variant deterministically.
- Replay initial-state validation rejects a variant absent from its card
  definition.
- `buildDebugMatchState` now throws on an unknown definition instead of warning,
  skipping it, and producing a short deck.

### Shared opening

- Added the DOM-free `buildOpeningTransaction()` runtime builder. It validates
  the opening preconditions and emits one frozen deterministic batch of normal
  `CARD_DRAWN` events in fixed P0-then-P1 order, drawing exactly
  `startingHandSize` for both seats.
- `engine/cli/runMatch.ts` now consumes this builder instead of a hard-coded
  three-card loop.
- The Phase 0 generated-match harness also consumes the same builder, removing
  its duplicate opening constant and event construction.
- `services/playgame/script/flows.ts` is intentionally untouched. Therefore the
  live-opening characterization remains an expected failure until the planned
  checkpoint 4/5 authority migration; no expected-fail test was falsely
  flipped here.

## Tests added

`services/playgame/runtime/__tests__/bootstrapValidation.test.ts` covers:

- valid bootstrap hashing, defensive copy, and deep freeze;
- short deck;
- unknown definition;
- unknown variant;
- duplicate beyond a manifest-declared copy limit;
- duplicate acceptance when the manifest declares no copy rule;
- content-hash mismatch;
- variant retention through genesis, opening draw, and replay;
- symmetric opening determinism and both-seat hand sizes;
- headless adoption of `startingHandSize`; and
- debug unknown-definition hard failure.

## Verification

- `npm run test:playgame:phase0` — exit 0 at 200 property cases: 7 files,
  27 passing tests, 9 expected failures.
- `npx vitest run services/playgame/runtime` — exit 0: 7 files, 27 passing
  tests, 9 expected failures.
- Focused checkpoint test — 11 passing tests.
- Focused ESLint over the checkpoint runtime/manifest/genesis/replay/debug
  surfaces — pass.
- `git diff --check` — pass.

## Explicitly deferred or unchanged

- collection ownership and per-player possession checks;
- `MatchSession.fromBootstrap`, live debug-picker bootstrap adaptation, replay
  bootstrap export, FIFO/commit behavior, and runtime state ownership;
- live hand-based AI migration and simultaneous lock/reveal scheduling;
- all `services/playgame/script/flows.ts` opening choreography and authoritative
  script removal.
