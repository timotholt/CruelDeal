# Phase 0 Task B — Seeded Engine Properties

## Delivered

- Added a standalone seeded generator at `services/playgame/runtime/__tests__/properties/generator.ts`.
- Added the five Phase 0 BUILD NOW properties at `services/playgame/runtime/__tests__/properties/engine-properties.test.ts`.
- The suite imports the public engine API directly (`createInitialMatchState`, `resolve`, `apply`, `createRng`, and `replayMatch`) and has no dependency on runtime/session files from other tasks.
- No pre-existing source or test file was modified.

## Generator coverage

Each generator seed deterministically produces:

- a separate random 12-card deck for `P0` and `P1`;
- decks containing distinct, enabled definitions present in the bootstrap manifest;
- deeply frozen deck entries, deck arrays, and two-seat deck snapshot;
- an independent random match seed;
- three opening draws per seat through normal `CARD_DRAWN` events;
- state-aware random `STAGE_CARD`, `UNSTAGE_CARD`, and `UNDO_TURN` intents accepted by `resolve`;
- one legal `END_TURN` intent per turn until the match reaches `ENDED` with a result.

Intent resolution uses a stable RNG fork derived from match seed, intent index, and intent type, so generation and subsequent execution resolve the exact same sequence.

## Properties

- `P-PARITY`: compares direct resolve/apply execution with `replayMatch`, including complete final state, ordered event log, turn, phase, priority, energy, and result.
- `P-EXACTLY-ONCE`: counts reducer application by global committed event index, requires every index exactly once, and verifies the result against replay.
- `P-PROVENANCE`: checks both frozen input deck snapshots, genesis deck membership, every replay frame, every zone reference, and requires non-deck cards to first appear through an explicit card-creation event with non-deck provenance.
- `P-FOLD`: checks the replay frame at every commit boundary against the state captured after that direct local commit.
- `P-NO-TIME`: executes each generated match under two fake wall-clock values, rejects any `Math.random()` call, requires zero `Date.now()` calls, and compares logs and final state exactly.

No property produced a legitimate current-engine failure at the required depth, so no `test.failing` characterization was needed.

## Depth and reproduction

- Local default: 8 generated matches per property.
- Override: `PLAYGAME_PROPERTY_CASES=<count>` (the shorter `PROPERTY_CASES` alias is also accepted).
- CI: when `CI=true`, the suite enforces at least 200 matches per property even if a lower count is configured.
- Suite seed override: `PLAYGAME_PROPERTY_SEED=<seed>`.
- Exact failing-case replay: `PLAYGAME_PROPERTY_CASE_SEED=<printed-generator-seed>`.

Every caught generation or assertion failure reports the suite seed, exact generator seed, generated match seed, both deck lists, intent count, and a copy-paste Vitest reproduction command.

## Verification

- `npx vitest run services/playgame/runtime/__tests__/properties/engine-properties.test.ts`
  - 1 file passed, 5 tests passed.
- `PLAYGAME_PROPERTY_CASES=200 npx vitest run services/playgame/runtime/__tests__/properties/engine-properties.test.ts`
  - 1 file passed, 5 tests passed.
  - 200 generated matches per property; 1,000 property cases total.
- Focused ESLint over both new TypeScript files passed with zero warnings or errors.
- A focused TypeScript invocation reached three pre-existing errors in imported engine files (`effects/evaluator.ts` twice and `replay.ts` once); it reported no error in either new property-suite file.
