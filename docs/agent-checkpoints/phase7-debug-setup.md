# Phase 7 Debug Setup Checkpoint

Status: complete

## Delivered

- `/play` exposes debug match setup only when both the Vite development build
  and the route adapter authorize it.
- The debug picker is dynamically imported and its UI copy is absent from the
  production bundle.
- Production `/play` accepts a validated `MatchBootstrap`; without one it fails
  closed instead of manufacturing a debug match.
- Debug opponent selection and match identity now derive from an explicit seed.
- Repeated random-opponent choices form a deterministic sequence for the same
  seed, player deck, and draw cursor.
- The superseded `/play/legacy` alias is removed.

## Proof

- `services/playgame/debug/debugMatchSetup.test.ts`
- `components/screens/play/phase7SetupArchitecture.test.ts`
- Phase 1.21 presentation architecture tests
- Phase 2 provider-boundary architecture tests
- touched-scope ESLint
- production Vite build
- production bundle string check for debug-picker UI copy

No card-motion or presentation choreography implementation changed in this
checkpoint.
