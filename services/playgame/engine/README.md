# engine/ — the pure wall

Authoritative, pure, deterministic, framework-free game engine for `/play`.
Server and client both import from this folder to run identical code against
identical state.

**Specification**: `docs/spec-engine-isolation.md` (Roadmap 0.2).

## Purity contract (ESLint-enforced; see `eslint.config.js`)

Code in `engine/` MUST NOT import:

- `solid-js` / `solid-js/store` / `solid-js/web` (no reactivity)
- `@/components/**` (no UI)
- `@/contexts/**` (no presentation state)
- `@/services/vfx/**` (no animations)
- `@/utils/id` (gameplay IDs use deterministic counters or the state-owned RNG)
- `howler` (no audio libraries)

Code in `engine/` MUST NOT use:

- `Math.random` — randomness flows through the `rng: Rng` parameter
- `Date.now` / `new Date()` / `performance.now` — no wallclock reads
- `fetch` / `XMLHttpRequest` — engine is pure, transport lives outside
- `crypto.*` — intent ids are generated outside the engine
- `document` / `window` / any DOM globals

## Layout

```
engine/
  apply.ts              pure reducer: (state, event) → state
  resolve.ts            intent → events (validator + event generator)
  resolveTurn.ts        full-turn orchestration
  eval.ts               recursive OR evaluator (revealPlayedCard, triggerOnReveal, evalEffect)
  rng/                  seeded PRNG (sfc32) + Rng interface
  manifest/             versioned game-data contract + bootstrap
    types.ts            Manifest, CardDef, LocationDef, ...
    bootstrap.ts        BOOTSTRAP_MANIFEST (launch card set, hand-assembled)
  projections/          pure queries over state (power, priority, ...)
  types/                State, Event, Intent, Ability DSL
    state.ts
    events.ts
    intents.ts
    ability.ts
    ids.ts
```

## Migration status (spec §10)

- [x] **Step 1** — skeleton + isolation (types, stubs, ESLint).
- [ ] **Step 2** — RNG (sfc32) + unit tests.
- [ ] **Step 3** — BOOTSTRAP_MANIFEST populated from current demo cards.
- [ ] **Step 4** — projections (power, lane power, priority, OR multiplier).
- [ ] **Step 5** — `apply` reducer, every variant.
- [ ] **Step 6** — selectors, predicates, numexpr, `evalEffect`, `revealPlayedCard`, `triggerOnReveal`.
- [ ] **Step 7** — `resolve` for STAGE_CARD / UNSTAGE_CARD intents.
- [ ] **Step 8** — `resolveTurn` full orchestration + enemy AI.
- [ ] **Step 9** — event → animation adapter.
- [ ] **Step 10** — legacy `script/actions.ts` deletion.
- [ ] **Step 11** — `pnpm engine:cli` headless match harness in CI.

Until a step lands, its function throws `not implemented`. This guarantees
we never silently run an incomplete engine.
