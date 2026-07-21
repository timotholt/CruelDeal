# CruelDeal Repository Guidance

## Compatibility policy

CruelDeal has no backward-compatibility requirement during active development.
When replacing an architecture, remove the superseded types, state shapes,
fallback reads, aliases, adapters, and dual-write paths. Prefer one clean
canonical implementation over preserving compatibility with old fixtures,
replays, saved state, or internal APIs. Migrate current callers and tests to the
new design instead.

## Local browser testing

When the local game opens on its login screen, click **Sign in with Google**.
The existing Google session completes the local login; do not treat that screen
as a testing blocker.

## First-class engine testing

Engine tests are a maintained product contract, not disposable subsystem work.
When adding or changing engine behavior, add or update a real Vitest suite and
keep the canonical regression map current in
`docs/playgame-engine-regression.md`.

- Use focused tests while iterating. `npm run test:engine:kernel` covers the
  deterministic rules kernel and architecture; `npm run test:engine:runtime`
  covers runtime/replay and its deterministic property corpus.
- `npm run test:engine:regression` is the full engine handoff gate. It runs the
  kernel, runtime property corpus, protocol conformance, content generation and
  validation, and engine typechecking. It normally takes about three minutes.
- Every full-gate run writes a timestamped, gitignored log under
  `.test-logs/engine/`; `.test-logs/engine/latest.log` is the stable link to
  inspect during or after the run.
- Do not automatically run the full gate for ordinary edits. Before a commit
  intended for merge, a push, or a handoff, offer to run it and link the result
  if it is run. Run it immediately when the user explicitly asks for full
  engine regression coverage.
- Do not claim the full gate covers a legacy script-style test until it has
  been converted to a real Vitest suite and added to the regression catalog.
