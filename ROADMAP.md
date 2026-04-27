# Cruel Deal — Roadmap

> One living document. Groundwork-first order: items at the top create foundations; deferring them increases rework on everything below.

---

## Status Snapshot

**Engine core (Tiers 0–1):** ✅ COMPLETE
- ✅ Pure reducer + event stream + seeded RNG + headless CLI (0.2 spec complete through Step 9)
- ✅ Ability DSL + interpreter, covers full 106-card roster
- ✅ 106 cards: 105 cyberpunk cards + junk-card token, authored in `manifest/content/cyberpunk-cards.ts`
- ✅ 37 Vantaris locations with weighted rarity picks, playable location trigger hooks, counters, prevention auras, delayed reveal, return/banish/transform primitives, and map art paths stored on each playable location definition
- ✅ Card/Lane query system with combinators
- ✅ Deterministic enemy AI module (`engine/ai.ts`); CLI + UI both use it; old `cli/ai.ts` deleted
- ✅ `Math.random` eliminated — including the final holdouts in `PlayGameContext.createInitialEngineState` (priority coin-flip, location shuffle); UI now delegates to engine `createInitialMatchState`
- ✅ UI draw consumes `state.deck[PLAYER]` via `CARD_DRAWN` — same pipeline as CLI; seeded, snapshot-able, deterministic
- ✅ Location rarity weights respected — `pickLaneLocations` uses weighted random without replacement
- ✅ `LOCATION_DESTROYED` + `LOCATION_SHIFTED` events defined in `types/events.ts`, reducer handlers in `apply.ts`, covered by `apply.test.ts`
- ✅ `trackedVariables` on `MatchState` — per-owner + global game-history stats maintained incrementally by `applyTrackedVars()` in `apply.ts`; queried via `TRACKED_STAT` / `TRACKED_FLAG` DSL atoms
- ✅ Extended DSL atom set: `COST_OF`, `HAND_SIZE`, `IF_ELSE`, `MIN_POWER_OF`, `MAX_POWER_OF`, `MIN_COST_OF`, `MAX_COST_OF`, `NUM_CMP`, `WAS_CREATED`, `HAS_COPIED_TEXT`, `POWER_INCREASED`, `POWER_REDUCED`, `COST_REDUCED`, `TEXT_DISABLED`, `HAS_ONGOING`, `IN_FULL_LANE`, `LANE_FULL`, `TRACKED_FLAG`, `HAND_EMPTY`, `HAS_UNSPENT_ENERGY`, `EVER_MOVED`
- ✅ `ZoneFilter` extended with `'DESTROYED'` and `'BANISHED'` zones
- ✅ `builtins.ts` registry — 15 implemented + 4 reactive stubs for complex multi-step card effects (`CALL_BUILTIN` DSL node delegates here)
- ✅ Vitest config (`vitest.config.ts`) + legacy test shim (`__tests__/setup.ts`); all test files run under `npx vitest run`
- ⬜ Per-card folders with art assets — defer until needed for art pipeline
- ✅ Shared deck-list shape exists as `Deck = readonly { defId; variantId? }[]`; debug/prebuilt decks now use it, and `createInitialMatchState(seed, manifest, decks?)` accepts optional P0/P1 deck lists
- ⬜ Deck-builder UX and profile persistence still store raw `string[]` card ids; migrate those screens/services to the manifest `Deck` entry shape in Tier 5.2
- ⬜ Decks still fall back to deterministic random generation when no prebuilt/user deck is supplied

**Known bugs:**
- ✅ Dune Sapper double-move (per-reveal event slicing)
- ✅ Dune Sapper moving into full lane (query-driven capacity filter)
- ⬜ Font snap on load
- ⬜ Sticky hover on mobile
- ✅ Reactive/Ongoing builtins are wired in their owning engine layers: `DRAW_ON_POWER_GAIN` in `resolveTurn`, `DEBUFF_ENEMY_ON_HAND_ENTRY` in hand-entry hooks, `COPY_ONGOING_OF_CHEAPEST_ONGOING` and `FULL_LANES_POWER` in Ongoing projections

**Test coverage:** `apply`, `resolve`, `evaluator`, `manifest`, `projections`, `query`, `rng`, `ai`, `tracked-vars`, `dsl-atoms`, `builtins` — all green (65 tests in `__tests__/`). CLI deterministic across runs.

**Next groundwork candidates:** Tier 2.2 (CSS card VFX wrapper stack), Tier 2.3 (particle overlay), Tier 3 prep (SSOT & transport).

---

## Tier 0 — Critical Debt (do now or pay interest on every card added)

### 0.1 Ability DSL ✅
- ✅ **DSL shape:** `services/playgame/engine/types/ability.ts` — complete DSL (EffectExpr, OngoingExpr, Predicate, Selector, NumExpr, PoolRef, PendingEffectSpec, TextOverride). ~30 effect atoms + 10 ongoing kinds + full control-flow combinators (SEQUENCE, CONDITIONAL, FOREACH, etc.).
- ✅ **Interpreter:** `services/playgame/engine/effects/evaluator.ts` — recursive OR cascade with depth cap 16, trigger slots (onMove/onDestroyed/onDiscarded/onAnyCardPlayedHere/onEndOfTurn), provenance tracking on every event.
- ✅ **Projections:** `services/playgame/engine/projections/` — `power`, `reveal` multiplier, `ongoing` collection + Onslaught/Citadel boost, `select`/`selectLanes` for all selectors. Extended with `COST_OF`, `HAND_SIZE`, `IF_ELSE`, `TRACKED_STAT`, `MIN/MAX_POWER/COST_OF`, and 10+ new predicates.
- ✅ **Card authoring:** 105 cyberpunk cards + junk-card token in `manifest/content/cyberpunk-cards.ts`, loaded via `card-loader.ts`. Full 106-card manifest.
- ✅ **Query system:** `services/playgame/engine/projections/query.ts` — composable filter object pattern for `CardInstance`, `CardDef`, `Lane` queries. 12 entry points, `NumComparison`/`StringComparison` primitives, `and`/`or`/`not`/`custom` combinators, 60+ tests. See `QUERY_SYSTEM_DESIGN.md`.
- ✅ **Builtins registry:** `services/playgame/engine/effects/builtins.ts` — `CALL_BUILTIN` DSL node delegates to named handler functions. 15 implemented: `POWER_TO_DESTROYER`, `DRAW_LOWEST_COST_CARD`, `MOVE_SELF_TO_RANDOM_OTHER_LANE`, `MOVE_ENEMY_CARD_TO_OTHER_LANE`, `COPY_TOP_ENEMY_DECK_CARD_TO_HAND`, `ADD_DISCARDED_CARD_TO_HAND`, `DISABLE_ONGOINGS_THIS_LANE_THIS_TURN`, `OVERCLOCK_CHIP`, `REPLACE_HAND_CARD_HIGHER_COST`, `ADD_DISCOUNTED_CARD_TO_HAND`, and others.
- ✅ **`trackedVariables`:** `MatchState.trackedVariables` — per-owner (`P0`/`P1`) counters + flags (`cardsPlayedThisTurn`, `yourCardsDestroyed`, `enemyCardsDestroyed`, `cardsYouDestroyed`, `cardsYouDiscarded`, `cardsMoved`, `cardsYouCreated`, `energyUnspentNow`, `totalCostReduced`, `reducedAnyCostThisGame`, `playedNoCardsLastTurn`, `hadUnspentEnergyLastTurn`, `spentAllEnergyLastTurn`) + global (`totalCardsDestroyed`). Maintained incrementally by `applyTrackedVars()`.

**Outstanding:**
- ⬜ Per-card folders (`cards/<defId>/card.ts` + art assets) with build-time `import.meta.glob` — deferred until art pipeline needs it (current: 106 cards in flat `.ts` file).
- ⬜ Ability validator (runtime schema check on card/location load) — current loader only checks required fields; ability trees are cast `as any`. Risk grows with card/location count.
- ⬜ Profile/deck-builder deck persistence still uses `string[]`; migrate to `Deck` entries so selected variants can flow into match creation.

### 0.2 Engine Isolation & Pure Reducer
- **Why first:** Right now `services/playgame/script/actions.ts` mutates state **and** reaches into the DOM in the same step. The engine cannot run headless, cannot be unit-tested in Node, and cannot move to the server.
- **Target:** `services/playgame/engine/` folder with zero imports from `solid-js`, DOM globals, or `Math.random`. ESLint-enforced.
- **Concrete deliverable:**
  - `apply(state, event, manifest) -> state` — pure reducer, one event at a time.
  - Every current `produce()` body in `actions.ts` and `PlayGameContext.tsx` maps to one `MatchEvent` case.
  - `resolve(state, intent, rng) -> MatchEvent[]` — pure intent validator + event generator.
  - `resolveTurn(state, seed, manifest) -> MatchEvent[]` — deterministic full-turn resolution.
- **Success criteria:** A Node CLI can run a full match end-to-end with zero browser.

#### Progress (spec 0.2 step-by-step)

| Step | Scope | Status |
|---|---|---|
| 1 | Skeleton + ESLint purity rules | ✅ done |
| 2 | Seeded RNG (sfc32 + cyrb128 + `fork(tag)`) | ✅ done |
| 3 | `BOOTSTRAP_MANIFEST` with 106 cards (105 cyberpunk + junk-card token) + 37 Vantaris locations | ✅ done |
| 4 | Projection library (power / lane / reveal / priority / Ongoing collect + Onslaught/Citadel boost) | ✅ done |
| 5 | `apply()` reducer for all `MatchEvent` variants; zones split into DECK/HAND/LANE/DISCARD/DESTROYED/BANISHED; `spawnSource` provenance | ✅ done |
| 6 | Effect evaluator (`evalEffect` + `revealPlayedCard` / `triggerOnReveal` with recursive OR cascade, depth cap 16) | ✅ done |
| 7 | `resolve()` intent dispatcher + `resolveTurn()` turn cascade (priority-ordered reveals, location reveal, draw, energy refill, match-end) | ✅ done |
| 8a | Bridge engine into `/play` UI as SHADOW (non-breaking). Parity assertions catch engine bugs in live play. | ✅ done |
| 8b | Cut the VFX `script` actions over to engine events (remove duplicate game logic in `actions.ts`) | ✅ done |
| 8c | Collapse dual state — deleted old `services/playgame/{state,types,cards,locations}.ts` and `engine/adapter/`. `PlayGameContext` now wraps engine `MatchState` directly; UI reads via `services/playgame/view.ts` selectors. | ✅ done |
| **9** | **Node CLI harness (`npm run engine:cli`) for headless match replay. Lives in `services/playgame/engine/cli/`: `initState` (seeded factory) · `ai` (deterministic plan) · `runMatch` (driver) · `main` (entry). Same seed → identical event log across runs.** | **✅ done** |

#### Step 8b / 8c migration checklist

Every integration point still owing a cutover is tagged in the code with `@migrate:step-8b` (or `-8c`). Run this to find all pending work:

```bash
rg '@migrate:step-8' services/playgame contexts/ components/
```

Step 8b completed items:

- **`captureEngineEndTurn()`** ✅ — captures engine turn-resolution events after all cards are staged; stores `MatchEvent[]` on script ctx.
- **`revealByPriorityFromEngine()`** ✅ — reads `CARD_FLIPPED` events in priority order; falls back to old `revealByPriority()` if bridge inactive.
- **`advanceTurnFromEngine()`** ✅ — reads `TURN_STARTED` event for turn/energy/priority; falls back to old `advanceTurn()` if bridge inactive.
- **`enemyPlayRandom`** ✅ — enemy card staged through the engine before turn resolution, so engine sees both sides.
- **`PlayGameContext.bridge`** ✅ — deleted with the old shadow adapter; engine `MatchState` is now the only gameplay state.

Step 8c completed items:

- **`PlayGameContext`** ✅ — store now holds engine `MatchState`; `dispatch(event)` → `apply()` + `reconcile()` is the single mutation gateway. Old `MatchState` shape, `createMatchState`, `recalcPriority`, `snapshotState`, `pushHistory` all deleted.
- **`services/playgame/{state,types,cards,locations}.ts`** ✅ — deleted. Card + location data now lives exclusively in `engine/manifest/content/`.
- **`services/playgame/engine/adapter/`** ✅ — bridge/translate/parity all deleted; no more shadow simulation.
- **`services/playgame/view.ts`** ✅ — new selector layer: `ResolvedCard` / `ResolvedLocation` + `getPlayerHand` / `getPlayerLaneCards` / `getLocation` / `getLanePower` project engine state into flat render shapes.
- **`PlayScreen.tsx` + `ZoomInspector.tsx`** ✅ — rewritten to consume `ResolvedCard` / `ResolvedLocation` via view selectors. No more old `CardInstance` / `LocationInstance`.
- **`script/actions.ts`** ✅ — all ctx fields retyped against engine `MatchState`; mutations go through `dispatch` or `setUi`.

Remaining debt carried forward (not required for 8c, gated on later tiers):

- ✅ **`PlayGameContext.drawCard` / `drawFromDeck`** — now pop the top of `state.deck[PLAYER]` via `CARD_DRAWN`. Deterministic; same pipeline as CLI.
- ✅ **`script/actions.ts::enemyPlayRandom`** — delegates to `planEnemyTurnFromPool` from `engine/ai.ts`. Deterministic, seeded, testable.
- ✅ **`PlayGameContext.createInitialEngineState`** — delegates to engine `createInitialMatchState`. Last two `Math.random()` calls removed.
- ✅ **`PlayGameContext.endTurn` stub** — deleted. Turn resolution is owned by the VFX/script flow over engine events.

---

## Tier 1 — Engine Core (blocks multiplayer, replays, anti-cheat)

### 1.1 Seeded PRNG + Deterministic Simulation ✅
- ✅ `Math.random` eliminated everywhere. All randomness goes through `createRng(seed)` (sfc32 + cyrb128, `fork(tag)`-able) in `services/playgame/engine/rng/`.
- ✅ `engineRng` maintained across turns in `PlayGameContext`; passed to script ctx; forked per-purpose (`'draw'`, `'enemy-plays'`, `'stage:<id>'`, `'move:<id>'`, `'lane:<id>'`, etc.).
- ✅ `state.deck[owner]` pre-populated by `createInitialMatchState(seed, manifest, decks?)` (`engine/cli/initState.ts`) — optional prebuilt/user deck lists use `Deck = readonly { defId; variantId? }[]`; shuffle and ids are seed-driven, snapshot-able, restorable.
- ✅ UI `PlayGameContext.drawCard` and script `drawFromDeck` both pop from `state.deck[PLAYER]` via `CARD_DRAWN` events. No more minting from manifest pool.
- ✅ UI `PlayGameContext.createInitialEngineState` delegates to engine `createInitialMatchState` — removed the last two `Math.random()` calls (priority coin-flip, location shuffle).
- ✅ Same seed → identical match across UI, CLI, and (future) server. Verified by running the CLI with the same seed twice + engine purity tests.

### 1.2 Card / Location Model Redesign — mostly shipped
- ✅ **Cards:** `defId` + `version` implemented; `name` is display-only in `cosmetic.displayName`.
- ✅ **Card authoring:** 106 cards (105 cyberpunk + junk-card token) in `manifest/content/cyberpunk-cards.ts`, loaded via `card-loader.ts`. Manifest `cards` field built from this.
- ✅ **Location rarity weights:** `LocationDef.rarity` is now honored by `pickLaneLocations` via a seeded weighted-pick-without-replacement helper. `rarity: 2` gets picked twice as often as `rarity: 1`.
- ✅ **Location events:** `LOCATION_REPLACED` (existed) + `LOCATION_DESTROYED` + `LOCATION_SHIFTED` all defined in `types/events.ts` with `cause: EffectRef` for provenance. Reducer handlers in `apply.ts` (clear on destroy; preserve `locationRevealed` + tags on shift). Covered by `apply.test.ts`.
- ✅ **Deck shape `{ defId; variantId? }[]`:** exposed as manifest `Deck`; debug/prebuilt decks and match init accept it.
- ⬜ **Deck-builder/profile migration:** current profile services and editor screens still persist `string[]`; migrate to `Deck` entries in Tier 5.2.
- ⬜ **Random fallback:** when no deck list is supplied, `createInitialMatchState` still builds deterministic random decks for CLI/tests.
- ⬜ **Per-card folders with art assets:** not started. Current cards are in a flat `.ts` file. Defer until art pipeline requires it.

### 1.3 Enemy AI (Deterministic) ✅
- ✅ `services/playgame/engine/ai.ts` owns planning. `script/actions.ts::enemyPlayRandom` is a thin dispatch + animation adapter that delegates to `planEnemyTurnFromPool`.
- ✅ Seeded RNG everywhere (fork tags per-owner); same seed → identical plan.
- ✅ Two planners: `planEnemyTurnFromPool` (picks from manifest — used by UI while OPP deck isn't surfaced) and `planEnemyTurnFromHand` (picks from `state.hand[owner]` — used by CLI today, UI when opp hand seeds).
- ✅ CLI swapped over to `planEnemyTurnFromHand`. Old `cli/ai.ts::planTurn` deleted — no longer needed.
- ✅ Covered by `ai.test.ts`: energy budget, capacity, disabled cards, determinism, `maxPlays` cap, empty-hand, all-lanes-full.

---

## Tier 1 Exit Criteria — All Met

- ✅ Engine runs pure (no `Math.random`, no DOM, no Solid) — ESLint-enforced.
- ✅ Same seed → same match on any JS runtime (client, CLI, future server).
- ✅ State is snapshot-able: everything gameplay-relevant (deck, hand, lanes, cards, pendingEffects, log) lives on `MatchState`.
- ✅ Event log is complete (every mutation has a typed `MatchEvent`) and replayable through `apply()`.
- ✅ UI is a thin projection layer — all mutations go through `dispatch(event)` → `apply()` → `reconcile()`.

**Tier 1 is done.** Tier 2 (presentation polish) and Tier 3 (multiplayer transport) can now proceed without groundwork debt.

---

## Tier 2 — Presentation (can iterate in parallel with Tier 1, but benefits from event contract)

### 2.1 Event-Driven Renderer
- ✅ Migration spec exists: `docs/event-driven-renderer-spec.md`.
- ✅ Adapter shell started: `services/playgame/presentation/choreography.ts` maps `MatchEvent` to structural animation, VFX cues, and SFX cues; `eventAnimator.ts` executes it.
- ✅ `CARD_MOVED` is centralized through the adapter for reveal slices and post-reveal turn advancement while preserving the existing FLIP slide.
- ✅ Additive VFX/SFX are mapped for power changes, destruction, and transformation without blocking dispatch.
- ✅ `CARD_DRAWN` / local hand-entry choreography is routed through the adapter; the engine turn stream now owns turn-start draws, and opening deals use the seeded engine deck.
- Next: Tier 2.2 CSS card VFX wrapper stack.

### 2.2 CSS Card VFX Wrapper Stack
- ✅ Spec exists: `docs/css-card-vfx-wrapper-stack-spec.md`.
- ✅ Persistent effect catalog exists: `docs/css-card-vfx-effect-catalog.md` (fire, ice, acid, electric, poison, barrier, glitch, void, overclock, stealth, holy, bleed; one effect module/file per visual kind).
- ✅ Lifecycle spec exists: `docs/css-card-vfx-lifecycle-spec.md` (creation, registry ownership, persistent reconciliation, exits, timeout cleanup, replay/match reset cleanup).
- ✅ **Slice 1 done:** `services/vfx/card-effects/` — types, 12 one-effect-per-file modules, imperative registry with transient + persistent lifecycle, timeout safety cleanup.
- ✅ **Slice 1 done:** `components/card/CardVfxStack.tsx` — subscribes to registry, renders absolute overlay layers per card, calls `complete()` on animationend, clears card on unmount.
- ✅ **Slice 1 done:** `HandCard` wired to `CardVfxStack`; `CARD_POWER_CHANGED` / `power-flash` cue routed through registry (`power-pulse` channel) instead of direct Timeline; CSS keyframes added.
- Purpose: use absolute-positioned overlay layers (first slice) so simultaneous card-local CSS keyframe effects compose without clobbering one element's `animation` / `transform`. Full nested-wrapper mode targets `UnifiedCardView` in a later slice.
- Initial channel order (in overlay z-index): `world-motion(0) → impact-shake(1) → interaction-pose(2) → power-pulse(3) → face-transform(4) → surface-fx(5) → persistent-fx(6)`.
- Persistent groups (for N ongoing/status effects) own their own stacking strategy: single, stacked, aggregated, or prioritized.
- **Next slices:** wire `destroy-burst` and `glitch-flash` through registry; add `CardVfxStack` to `BoardCard`; add persistent projection for one visual kind; move existing Timeline card effects behind registry.

### 2.3 Particle Overlay
- Single `<canvas>` over `boardWrap`, RAF loop, pointer-events: none.
- `particles.burst({ at, palette, count })` API. ~150 lines.
- Budget: 500 live particles max. Palette driven by card `art` color or event type.

### 2.4 Inspector Overlay (Zoom)
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
- ✅ **Dune Sapper double-move on reveal** — fixed. Reveal events are now sliced per-card and dispatched inline with each card's flip cinematic; the end-turn dispatcher skips events already played. See `revealByPriorityFromEngine` + `_revealsConsumedUpTo` in `script/actions.ts`.
- ✅ **Dune Sapper move-into-full-lane silently failed** — fixed. MOVE effect now uses `findLanes({ hasCapacity: owner, not: { idx: currentLane } })` from the query system, so it only picks lanes that can actually receive the card. Covered by 3 scenarios in `evaluator.test.ts` (empty lanes, one full, all full).
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

1. FIXED - **Priority tie-break:** Real Snap uses "whoever lost priority last round gets it this round." Keep "player always wins ties" stub or implement full rule?
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
