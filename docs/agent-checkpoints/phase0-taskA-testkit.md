# Phase 0 Task A — Characterization Testkit

Completed the runtime characterization testkit without changing existing implementation files.

## Added

- `services/playgame/engine/testkit/runtimeFixture.ts`
  - Builds deterministic runtime fixtures from explicit seed, local seat, turn, phase, priority, decks, hands, three lanes, and three location slots.
  - Supports explicit energy, max energy, next-turn bonus, staging order, pending effects, card instance IDs, revealed state, stat deltas, tags, and provenance.
  - Rejects duplicate card IDs and invalid staging-order references.
  - Includes small manifest/card/location definition builders for isolated engine contracts.
- `services/playgame/engine/testkit/transactionFrames.ts`
  - Defines the future shared live/replay transaction-frame shape.
  - Records a genesis frame and one immutable state frame after every committed event.
  - Adds exact parity assertion for final state, ordered log, transaction events, turn, phase, priority, energy, and result.
- `services/playgame/runtime/__tests__/characterization/runtime-characterization.test.ts`
  - 11 passing examples: empty end turn; end-of-turn effects without flips; reveal cascade; priority-ordered multi-reveal; effects after final flip and before `TURN_ENDED`; boundary location reveal/effect; non-full hand draw; full-hand no-draw; match end/result stability; local `P0`; local `P1`.
- `services/playgame/runtime/__tests__/characterization/reveal-event-loss.contract.test.ts`
  - Three expected-failing contracts reproduce the current live handoff branches: loss before the first flip, loss when all engine flips are already revealed in UI state, and loss when the engine emitted no flips.
  - The contract uses an executable transcription of the relevant `revealByPriorityFromEngine`/`advanceTurnFromEngine` slicing branches so it remains headless and does not pull animation/DOM dependencies into runtime tests.

## Verification

`npx vitest run services/playgame/runtime/__tests__/characterization`

- 2 test files passed
- 11 tests passed
- 3 expected failures passed as `test.fails` contracts

Focused ESLint passed with zero warnings:

`npx eslint services/playgame/engine/testkit services/playgame/runtime/__tests__/characterization --report-unused-disable-directives --max-warnings 0`

A repository-wide `npx tsc --noEmit` remains red on pre-existing errors outside the new files. A targeted type check reached two existing errors in `services/playgame/engine/effects/evaluator.ts` (`TextOverride` nullability and a missing return); it reported no errors in the added testkit or characterization files.
