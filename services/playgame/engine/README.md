# engine/ — the pure wall

Authoritative, pure, deterministic, framework-free game engine for `/play`.
Server and client both import from this folder to run identical code against
identical state.

**Specification**: `docs/playgame-transactional-rules-kernel-spec.md`.

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
  resolve.ts            intent/turn orchestration → governed commands
  effects/
    rulesInterpreter.ts authored rules → canonical command/effect work
    builtinCommandPlanner.ts exceptional builtins → commands
  kernel/
    rulesTransaction.ts one private candidate-state work queue
    operations/         command validation and event planning
    reactions/          deterministic reaction discovery
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

## Mutation authority

Product callers submit present-tense commands through
`executeRulesCommands`. The rules transaction is the only simulation-side
client of `apply`; domain transaction modules expose pure semantic capture and
reaction collection, not standalone executors. Authored effects and builtins
may plan commands but cannot construct or apply mutation events directly.

The runtime remains the publication/replay authority. It folds committed
events, but it does not make gameplay decisions.
