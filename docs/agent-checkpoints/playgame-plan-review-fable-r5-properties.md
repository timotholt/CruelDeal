# Fable Review — Round 5 (part B) — Property-based upgrade of Phase 0

Phase 0's test list is example-based (11 hand-picked scenarios). Examples
prove the cases someone thought of; determinism and provenance bugs live in
the cases nobody thought of. Upgrade Phase 0 with generated-input
properties. Keep the examples — they are readable documentation — but the
properties are the real gate.

## Generator

One seeded generator producing random valid match setups and intent
sequences: random (but manifest-valid) 12-card decks for both seats, random
seed, random legal intent sequence to match completion (stage/unstage/end
turn in legal orders, both seats, varying counts). The generator itself is
seeded so failures reproduce from a printed seed.

## Properties (each runs over N generated matches, N >= 200 in CI)

P-PARITY: for every generated (seed, decks, intents): live-runtime
execution and headless replay of the exported log produce identical final
state, identical ordered event log, identical (turn, phase, priority,
energy, result).

P-EXACTLY-ONCE: for every generated match: each committed event index is
applied exactly once — no skips, no double-application (assert via a
counting reducer wrapper).

P-PROVENANCE: for every generated match: every card that appears in any
hand, lane, or discard originates from that seat's frozen deck snapshot
or from an explicit creation event. (This generalizes the round-3 debug
proof to all inputs.)

P-FOLD: for every generated match: MatchState after commit N equals the
fold of the event log prefix [0..N] over the initial state — for ALL N,
not just the final state. Catches order-dependent reducer bugs that
cancel out by match end.

P-NO-TIME: resolution output is a pure function of (initial state, intent
sequence, seed). Run the same generated match twice with different
wall-clock conditions (fake timers at different times) and assert identical
logs. Guards the determinism boundary against accidental Date.now/
Math.random leaks into engine or runtime code.

P-INTERLEAVE (after the round-5A concurrency model lands): for generated
presentation-abort points (abort after frame k of each transaction) and
random fast-forward injections: final authoritative state and log are
IDENTICAL to the no-presentation run of the same intents. Presentation
becomes provably irrelevant to outcomes, which is the plan's central
invariant stated as an executable property.

## Plumbing requirements

- Properties live beside the runtime tests (services/playgame/runtime) and
  run in the standard vitest gate; N is configurable so local runs stay
  fast and CI runs deep.
- Any property failure prints the generator seed; a fixture helper replays
  a printed seed as a focused test case.
- Mutation check (one-time, manual): temporarily break the reducer (skip
  one event type) and confirm P-PARITY/P-FOLD fail. A property suite that
  cannot fail is decoration; record the check in the plan's Phase 0 exit
  criteria.

## Amendment requested

Add the generator + six properties to Phase 0 work, and to exit criteria:
"the six named properties pass over generated inputs, and the mutation
check proves they can fail." Phase 1 exit criteria reference P-PARITY,
P-EXACTLY-ONCE, and P-INTERLEAVE as gates.
