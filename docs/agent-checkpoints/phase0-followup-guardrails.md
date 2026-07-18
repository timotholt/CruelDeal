# Phase 0 Follow-up — Guardrail Corrections

Recorded 2026-07-17 after review of commit `940a6c9`.

## Corrections delivered

- `P-EXACTLY-ONCE` now keys applications by stable transaction and event
  identity. Its adversarial check deliberately retries an event under the same
  identity and proves the oracle catches it.
- `P-NO-TIME` now also checks gameplay RNG output against cosmetic namespace
  consumption and cosmetic fork-order changes.
- Transaction frames use the reviewed `{ before, event, after }` contract with
  one frame per event and no synthetic genesis frame.
- The live opponent characterization imports the production planning seam used
  by `autoPlayRemoteSeat`; it records the current manifest-pool provenance bug
  as an expected failure.
- The live opening characterization imports the real `openingSequence` and
  records its four local-only deal actions as an expected failure.
- Reveal-loss characterizations now call the production reveal-handoff planner
  used by `revealByPriorityFromEngine`; the previous copied test transcription
  is gone.
- `npm run test:playgame:phase0` is the explicit merge gate and enforces 200
  generated matches for each of the five properties.

## Expected-failure policy

The five expected failures are desired-state contracts, not ignored tests.
Each is required to flip green when the corresponding Phase 1 behavior changes:

1. preserve events before the first flip;
2. preserve effects when every flip is already revealed;
3. preserve effects when no flips are emitted;
4. plan the remote seat from selected-deck hand cards;
5. open both seats through one symmetric runtime transaction.
