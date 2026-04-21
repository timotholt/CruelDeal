# engine/ — the pure wall

This folder is the **pure, framework-free, deterministic** game engine. The
authoritative gameplay rules live here, and ONLY here. Server and client
both import from this folder to run the same code against the same state.

## Rules (enforced by ESLint; see `eslint.config.js`)

Code in `engine/` MUST NOT import:

- `solid-js` / `solid-js/store` (no reactivity)
- `@/components/**` (no UI)
- `@/contexts/**` (no presentation state)
- `@/services/vfx/**` (no animations)
- `@/utils/id` (id generation goes through the seeded `rng.uid()` instead)

Code in `engine/` MUST NOT use:

- `Math.random` — randomness flows through the `rng: Rng` parameter
- `Date.now` / `new Date()` / `performance.now` — time flows through event
  payloads or the `MatchState` turn counter
- `fetch` / `XMLHttpRequest` — engine is pure, transport is elsewhere
- `crypto.*` — intent ids are generated outside the engine
- `document` / `window` / any DOM globals

## What goes here

- `apply(state, event, manifest) → state` — pure reducer
- `resolve(state, intent, rng, manifest) → MatchEvent[]` — pure intent → events
- `resolveTurn(state, seed, manifest) → MatchEvent[]` — deterministic turn resolution
- `rng.ts` — seeded PRNG (sfc32)
- `events.ts` — `MatchEvent` discriminated union
- `intents.ts` — `MatchIntent` discriminated union
- `rules/` — per-concern rule modules (staging, draw, priority, etc.)
- `builtins.ts` — stable-id registry of unique card effects

## What does NOT go here

- Solid components, Solid stores, reactivity primitives
- DOM animations, particle emitters, CSS class toggles
- Server functions, HTTP / SSE / WebSocket code
- Persistence (DB, localStorage, IndexedDB)
- Match-state storage (Redis, Durable Objects, etc.)

See `PLAY_REFACTOR_PLAN.md` §2 for the target architecture.
