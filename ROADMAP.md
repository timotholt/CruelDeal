# Galactic Snap — Roadmap

> One living document. Groundwork-first order: items at the top create foundations; deferring them increases rework on everything below.

---

## Tier 0 — Critical Debt (do now or pay interest on every card added)

### 0.1 Ability DSL
- **Why first:** Every card implemented before a data-driven effect system is more hardcoded TypeScript to extract later.
- **Current state:** Effects are hardcoded functions in `services/effects.ts`.
- **Target:** JSON schema + interpreter (`TARGET: "ENEMIES", STAT: "POWER", DELTA: -1`) so designers can balance without redeploying.
- **Acceptable shortcut:** Keep hardcoded builtins for complex cards; DSL covers the 80% common cases.

### 0.2 Engine Isolation & Pure Reducer
- **Why first:** Right now `services/playgame/script/actions.ts` mutates state **and** reaches into the DOM in the same step. The engine cannot run headless, cannot be unit-tested in Node, and cannot move to the server.
- **Target:** `services/playgame/engine/` folder with zero imports from `solid-js`, DOM globals, or `Math.random`. ESLint-enforced.
- **Concrete deliverable:**
  - `apply(state, event, manifest) -> state` — pure reducer, one event at a time.
  - Every current `produce()` body in `actions.ts` and `PlayGameContext.tsx` maps to one `MatchEvent` case.
  - `resolve(state, intent, rng) -> MatchEvent[]` — pure intent validator + event generator.
  - `resolveTurn(state, seed, manifest) -> MatchEvent[]` — deterministic full-turn resolution.
- **Success criteria:** A Node CLI can run a full match end-to-end with zero browser.

---

## Tier 1 — Engine Core (blocks multiplayer, replays, anti-cheat)

### 1.1 Seeded PRNG + Deterministic Simulation
- Replace `Math.random`, `uid()`, and `randomCardDef()` with `sfc32` seeded from a server turn seed.
- Same seed → same card draws, same enemy lane picks, same ids on client and server.
- Move `drawQueue` into `MatchState` as `deck: CardDef[]` so it's snapshot-able and restorable.

### 1.2 Card / Location Model Redesign
- **Cards:** `defId` (stable forever) + `version` (bumps on balance changes). `name` becomes display-only in `CardCosmetic`.
- **Locations:** `rarity` weight for weighted random roll. Support `LOCATION_REPLACED`, `DESTROYED`, `SHIFTED` events.
- **Deck shape:** `{ defId; variantId? }[]` — references into manifest, never copies stats.
- **Per-card folders:** `cards/<defId>/card.ts` + art assets. Manifest assembled at build time via `import.meta.glob`.

### 1.3 Enemy AI (Deterministic)
- Move `enemyPlayRandom` from DOM action into `engine/ai.ts`. Use seeded RNG.
- Keep it simple for now (weighted random), but it must be deterministic and testable.

---

## Tier 2 — Presentation (can iterate in parallel with Tier 1, but benefits from event contract)

### 2.1 Event-Driven Renderer
- Replace all `el.style.transition = ...` imperative animation with CSS-class choreography driven by `MatchEvent` types.
- `choreography.ts` maps each event to `{ addClass: [...], particles: [...], sfx: "..." }`.
- All animation timing lives in CSS (`vfx/transitions/classes.css`), not JS.

### 2.2 Particle Overlay
- Single `<canvas>` over `boardWrap`, RAF loop, pointer-events: none.
- `particles.burst({ at, palette, count })` API. ~150 lines.
- Budget: 500 live particles max. Palette driven by card `art` color or event type.

### 2.3 Inspector Overlay (Zoom)
- Already partially implemented (`ZoomInspector.tsx`).
- Wire click-to-zoom on cards and locations. 150ms interaction lockout to prevent double-tap closures.

---

## Tier 3 — Multiplayer & Transport (only after engine is pure)

### 3.1 TanStack Start Migration
- Swap Vite for Vinxi. File-based routes in `src/routes/`.
- `createServerFn` for intent submission. SSE route for event streaming.
- **Not before:** engine isolation is complete. Transport is worthless if the engine can't run on the server.

### 3.2 Server-Side Source of Truth
- Move `services/playgame/engine/` to a Node backend (or Cloudflare Durable Objects).
- Client submits intents; server runs `resolve`, streams `MatchEvent[]` back.
- Anti-cheat comes for free: enemy face-down cards never send `power` until `CARD_REVEALED` event.

### 3.3 Deep Prediction (Zero-Round-Trip Cinematics)
- Server emits `TURN_SEED` (per-turn RNG seed + enemy plays).
- Client runs `resolveTurn(state, seed)` locally, plays full cinematic without waiting.
- Server events are reconciliation checks. Divergence → rollback + replay.

### 3.4 Reconnection & Spectator Mode
- SSE `Last-Event-ID` replay for reconnects.
- Snapshot every turn for fast catch-up.
- Spectator: read-only SSE subscription to an active match.

---

## Tier 4 — Live-Ops & Infrastructure (deferred until gameplay is solid)

### 4.1 Persistent Database
- Move progress from `localStorage` to PostgreSQL/Mongo + auth (Firebase/Auth0).
- Profile, decks, collection, match history.

### 4.2 Multi-Language CMS
- Web UI for Live-Ops to author inbox/news messages with scheduled release windows.
- Current `mockData.ts` is the placeholder.

### 4.3 Asset CDN & Delta Patching
- Content-hashed filenames for immutable caching.
- Background download of high-res textures.
- `AssetRef.hash` field for cache-busting.

---

## Tier 5 — Polish & Features (nice-to-have, queue after Tier 2)

### 5.1 Known Bugs
- **Font snap on load:** IBM Plex Sans snaps from system font after 100–300ms. Preload + `font-display: block` didn't fix. May need Base64 embedding or a loader screen.
- **Sticky hover on mobile:** `@media (hover: hover)` logic needs testing on physical tablets with trackpads.

### 5.2 Deck Builder
- Search filters: rarity, power range, cost, keyword.
- Collection grid with drag-to-deck.

### 5.3 Matchmaking Simulation
- "Searching for Opponent" animation with fake player profiles.

### 5.4 Audio Mixdown
- Global volume slider in settings menu.
- BGM ducking during SFX.

### 5.5 Visual Effects
- "Gold Foil" and "Inkify" rarity effects on cards.
- Variant frame styles: classic, holo, prismatic, signature.

---

## Appendix: Deferred Open Questions

These don't block current work but need answers before Tier 3 ships:

1. **Priority tie-break:** Real Snap uses "whoever lost priority last round gets it this round." Keep "player always wins ties" stub or implement full rule?
2. **Turn limit:** Hard-coded 6 turns, or configurable per match?
3. **Retreat / concede:** Immediate forfeit, or surrender on next turn with a grace window?
4. **Per-card timing rules:** "On Reveal" vs "Ongoing" — model now or post-refactor?
5. **Runtime target:** Node on Fly/Railway? Cloudflare Workers + Durable Objects? Vercel Edge?
6. **Match state storage:** In-memory (single instance), Redis pub/sub, or Durable Objects?
7. **AI quality:** Keep random enemy AI, or upgrade to heuristics / min-max?
8. **Replay files:** Export match as JSON event log + seed — worth the disk space?

---

## Deleted / Merged Documents

| Old File | Fate | Content Moved To |
|---|---|---|
| `MIGRATION_TO_SOLIDJS.md` | **Deleted** | Migration is complete. |
| `MIGRATION_PLAN.md` | **Merged** | Tier 3.1 (TanStack Start) above. |
| `PLAY_REFACTOR_PLAN.md` | **Merged** | Tiers 0–3 above. Open questions in Appendix. |
| `TECHNICAL_DEBT.md` | **Merged** | Tier 0 (DSL), Tier 3.2 (SSOT), Tier 4 (DB, CMS, CDN). |
| `todo.md` | **Merged** | Tier 5 (bugs, polish, features) above. |
