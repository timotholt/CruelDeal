# /play Refactor Plan — Pure Engine + CSS/Particle VFX + TanStack Start

> Working document. Mutates as we answer open questions. Keep it short, keep it current.

## 0. Vision

Three orthogonal layers, no cross-talk:

1. **Engine** — pure, framework-free, deterministic. Runs on Node (server) and in the browser (client) from the same file. Zero DOM, zero Solid, zero `Math.random`, zero `Date.now`.
2. **Presentation** — a Solid component tree + a **CSS-driven state machine** for card/location visuals + a **particle canvas overlay** for bursts, trails, weather. Subscribes to engine events; never mutates game state.
3. **Transport** — TanStack Start: `createServerFn` for intent submission, SSE route for event streaming. Same engine module imported by both the route handler and the client store.

When done:

- Gameplay logic lives in one file (`services/playgame/engine/index.ts`) that could be unit tested in Node with zero dependencies.
- Visuals are driven by CSS classes + a tiny particle API (`particles.burst({ at, palette, count })`). No more inline-style choreography scattered across `actions.ts`.
- Deep prediction works: server streams a seed, client runs the same resolution locally, cinematic plays at 60fps with zero round-trips.
- Offline / practice mode falls out for free (swap the server function for a local mock that uses the same engine).

## 1. Current-State Audit

### What's already shaped right

- `MatchState` / `CardInstance` / `LocationInstance` — pure data, serializable, cycle-free. `@/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/types.ts`
- Every state mutation goes through `setState(produce(...))` — the bodies are effectively reducer cases waiting to be extracted. `@/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/script/actions.ts`
- `MatchSnapshot` + `pushHistory` + `restoreState` prove the state is time-travelable.
- The script/runner composition model (`Step` = `(ctx) => Promise<void>`, `serial`/`parallel`) generalizes cleanly to an event-driven renderer.

### What has to be pulled apart

- **Logic and VFX are fused.** Every step in `actions.ts` mutates state AND reaches into the DOM. `enemyPlayRandom` pushes to `enemyLanes` + `pending` + `enemyPlayedThisTurn` and calls `flyFaceDownToSlot`. `commitIncomingToHand` interleaves FLIP capture, `setState`, rAF, slide animation, and pop.
- **`PlayScriptCtx` requires DOM.** `boardEl`, `boardWrap`, `toastArea`, `cardRefs`, `deckEl`. No engine code can run headless.
- **Client-side RNG and AI.** `randomCardDef`, `uid`, `enemyPlayRandom`'s lane choice — all `Math.random`. Non-reproducible, non-authoritative.
- **`drawQueue` lives on `ctx`, not in state.** Not snapshot-able, not restorable, not visible to a server.
- **Two "end turn" code paths.** `PlayGameContext.endTurn()` (legacy stub) and `resolveTurnFlow`. One has to die.
- **Animations hard-coded with inline style writes.** `revealLocation` sets `el.style.transition`, `el.style.opacity`, `el.style.transform` directly. Impossible to swap for a CSS-class-driven system without rewriting each one.

## 2. Target Architecture

### 2.1 Folder layout

```
services/playgame/
├─ engine/
│  ├─ index.ts          # public surface: apply, resolve, createMatch, determinePriority
│  ├─ events.ts         # MatchEvent union + type guards
│  ├─ intents.ts        # MatchIntent union + validator schemas
│  ├─ rng.ts            # seeded PRNG (sfc32 or mulberry32)
│  ├─ rules/
│  │  ├─ staging.ts     # stageCard rule
│  │  ├─ resolve.ts     # turn-resolution event sequence
│  │  ├─ draw.ts        # deck -> incoming -> hand
│  │  └─ priority.ts    # determinePriority + tie-break
│  └─ types.ts          # MatchState (re-exported from types.ts)
│
├─ presentation/
│  ├─ event-renderer.ts # subscribes to engine events, emits CSS class changes + particle bursts
│  ├─ choreography.ts   # event -> (cssClass transitions, particle effects, duration) mapping
│  └─ timeline.ts       # chains class-based transitions with waits
│
├─ vfx/                 # kept — CSS-driven now
│  ├─ particles/
│  │  ├─ overlay.ts     # single <canvas> over boardWrap, 60fps RAF loop
│  │  ├─ emitters.ts    # burst, trail, continuous emitters
│  │  └─ palettes.ts    # color themes per card/type
│  └─ transitions/
│     └─ classes.css    # .card.is-revealing, .location.is-flipping, .hand-slot.is-sliding
│
├─ transport/
│  ├─ server-functions.ts  # createServerFn handlers (submitIntent, startMatch)
│  └─ event-stream.ts      # SSE client: EventSource subscriber that feeds engine + renderer
│
└─ (existing) state.ts, cards.ts, locations.ts, toast.ts
```

### 2.2 Core contracts

```ts
// engine/events.ts
export type MatchEvent =
  | { type: 'MATCH_STARTED'; seed: number; decks: { player: CardDef[]; enemy: CardDef[] } }
  | { type: 'CARD_DRAWN'; side: Side; card: CardInstance }
  | { type: 'CARD_STAGED'; side: Side; cardId: string; lane: number }
  | { type: 'CARDS_FLIPPED_DOWN'; side: Side; ids: string[] }
  | { type: 'CARD_FLOWN_IN'; side: Side; card: CardInstance; lane: number }
  | { type: 'CARD_REVEALED'; id: string; reveal: CardReveal }  // stats arrive here for face-down cards
  | { type: 'TURN_SEED'; turn: number; seed: number; enemyPlays: CardInstance[] }
  | { type: 'TURN_ADVANCED'; turn: number; energyMax: number }
  | { type: 'LOCATION_REVEALED';  lane: number }
  | { type: 'LOCATION_REPLACED';  lane: number; fromDefId: string; toDefId: string; cause: string }
  | { type: 'LOCATION_DESTROYED'; lane: number; defId: string; cause: string }
  | { type: 'LOCATION_SHIFTED';   from: number; to: number; defId: string; cause: string };

// engine/intents.ts
export type MatchIntent =
  | { intentId: string; type: 'STAGE_CARD'; cardId: string; lane: number }
  | { intentId: string; type: 'UNDO' }
  | { intentId: string; type: 'END_TURN' };

// engine/index.ts
export const apply = (state: MatchState, event: MatchEvent, manifest: GameManifest): MatchState => { ... };
export const resolve = (state: MatchState, intent: MatchIntent, rng: Rng, manifest: GameManifest): MatchEvent[] => { ... };
export const resolveTurn = (state: MatchState, seed: number, manifest: GameManifest): MatchEvent[] => { ... };
```

- `apply` is a reducer: one event at a time, no side effects.
- `resolve` validates and produces events for a single intent.
- `resolveTurn` is the deterministic big bang: given `state` + `seed`, returns every event from "flip player cards down" through "draw a card" through "reveal next location". Same function on client and server.

### 2.3 Presentation — event-driven VFX

```ts
// presentation/choreography.ts
export const choreography: Record<MatchEvent['type'], Choreography> = {
  CARD_STAGED: (e) => ({
    addClass: [{ selector: `[data-card-id="${e.cardId}"]`, class: 'is-landing', duration: 300 }],
    particles: [{ kind: 'burst', at: lanePoint(e.lane), palette: 'drop', count: 14 }],
    sfx: 'play',
  }),
  CARDS_FLIPPED_DOWN: (e) => ({
    addClass: e.ids.map(id => ({ selector: `[data-card-id="${id}"]`, class: 'is-flipping-down', duration: 350 })),
    sfx: 'lock',
  }),
  CARD_REVEALED: (e) => ({
    addClass: [{ selector: `[data-card-id="${e.id}"]`, class: 'is-revealing', duration: 520 }],
    particles: [{ kind: 'burst', at: cardPoint(e.id), palette: 'reveal', count: 40 }],
    sfx: 'reveal',
  }),
  // ...
};
```

- Each event has a **declarative** recipe: add CSS classes to elements, spawn particles at viewport coordinates, play SFX.
- No imperative `el.style.transition = 'foo'`. All animation lives in `vfx/transitions/classes.css`:

```css
.card.is-revealing {
  animation: reveal-flip 520ms cubic-bezier(.2,0,.4,1);
}
@keyframes reveal-flip {
  0%   { transform: rotateY(180deg) scale(1); }
  50%  { transform: rotateY(90deg) scale(1.12); }
  100% { transform: rotateY(0deg) scale(1); }
}
```

- The renderer adds `is-revealing`, waits for `animationend` (or the declared duration as a fallback), removes it, and resolves.
- Particle canvas is a separate layer — the renderer fires `particles.burst(...)` at the right moment. The canvas has its own RAF loop; emission is fire-and-forget.

### 2.4 Particle canvas overlay

```
<div class="board-wrap">
  <div class="board">...</div>
  <canvas class="vfx-particles" />    ← fixed at boardWrap, pointer-events: none
</div>
```

- Single `<canvas>` sized to `boardWrap` via `ResizeObserver`. One RAF loop, `clearRect` + redraw each frame. Particle count budget capped (e.g. 500 live particles; beyond that, skip new emits).
- `particles.burst({ at: {x,y}, palette, count, speed, gravity, lifetime })` pushes into an array. Update loop integrates velocity + gravity, draws, prunes dead particles. ~150 lines total.
- Palettes driven by the card's `art` color, location accent, or event type.

Why this works for our game:

- Card bursts on reveal, shimmer trails on slides, impact sparks on flips — all cheap 2D canvas.
- No 3D, no shader tricks — stays fast on integrated GPUs and phones.
- Resolution-independent; resizes cleanly across hand-scale changes.

### 2.5 Card / Location / Deck model

Current model in `services/playgame/types.ts` is prototype-grade (`CardInstance extends CardDef`, `name` is the primary key, `art` is a hex color). The engine refactor is the right moment to fix the identity and durability layer so every downstream system — manifest, deckbuilder, replays, collection, economy — builds on stable ground.

**Design principle.** Engine-relevant fields go in `CardDef` / `LocationDef`. Everything else lives in `CardCosmetic` / `LocationCosmetic`, indexed by the same `defId`. Engine code CANNOT reach cosmetic data (lint-enforced). Event payloads carry the minimum needed; wire shape stays small.

#### Cards — engine-relevant

```ts
interface CardDef {
  defId: string;              // stable primary key; never reused, never renamed
  version: number;            // bumps on balance tweaks (Q35 resolved — version bumps separately from defId)
  cost: number;
  power: number;
  ability?: Ability;          // §9.3 DSL / builtin reference
}
```

- **No tribe tags / no `type` field.** (Q31 resolved — cards stand alone.) Removed from the engine schema.
- `defId` is the primary key. Renames = new cosmetic display name; `defId` unchanged. Deck lists, replays, and match logs survive renames forever.

#### Cards — instance in match state

```ts
interface CardInstance {
  id: string;                 // newShortId(), scoped to one match
  defId: string;              // reference into manifest
  basePower: number;          // resolved at creation, frozen for buff math
  cost: number;               // resolved at creation; pinned against mid-match balance patches
  power: number | null;       // null = face-down, unknown to client (Q36 resolved — server-authoritative anti-cheat: stats withheld until reveal)
  variantId?: string;         // cosmetic — which art skin is on the board; nullable placeholder
}

// Server-only payload that populates power/basePower on CARD_REVEALED:
interface CardReveal {
  id: string; defId: string; basePower: number; cost: number; power: number;
}
```

- Instance holds only what's mutable in-match plus the immutable snapshot of cost/basePower at play time.
- Display name, rules text, art, flavor, rarity, frame, keywords are all looked up by `defId` at render time.
- Client prediction: for the local player's own cards, `power` is known immediately. For enemy face-down cards, `power` stays `null` until the `CARD_REVEALED` event carries a `CardReveal` payload with the real stats. Server is the source of truth; anti-cheat comes for free.

#### Cards — cosmetic (manifest `cosmetics.cards[defId]`)

```ts
interface AssetRef {
  path: string;                  // '/art/cards/scout/portrait.webp'
  hash?: string;                 // CDN cache-busting token
  kind?: 'image' | 'video';      // mp4 / webm for animated art (Q33 resolved — yes, format TBD)
  w?: number; h?: number;
}

interface CardCosmetic {
  defId: string;
  displayName: string;           // single-locale for now
  flavorText: string;
  rulesText: string;             // keyword-labeled (Q34 resolved — snap-style labeled)
  keywords?: string[];           // ['On Reveal', 'Ongoing'] — rendered as badges before rulesText
  accent: string;                // hex color (today's `art` field, renamed)
  frame: 'common' | 'rare' | 'epic' | 'legendary';   // visual border tier; NOT a drop rarity
  art: {
    portrait: AssetRef;
    thumbnail?: AssetRef;
    animated?: AssetRef;         // mp4/webm animated portrait
  };
  variants?: CardVariant[];      // alternate arts; see below
}

interface CardVariant {
  variantId: string;             // 'scout.classic', 'scout.holo', 'scout.captain-america'
  displayName?: string;          // optional rename ('Captain America Scout')
  art: { portrait: AssetRef; animated?: AssetRef };
  frame: 'classic' | 'holo' | 'prismatic' | 'signature';
  source: 'default' | 'earned' | 'purchased' | 'gifted';  // (Q32 resolved — all three unlock paths)
}
```

- Variants are unlocked via earn / purchase / gift-code (Q32). `source` is a manifest-declared category; actual ownership lives in the user profile.
- Gift codes redeem server-side → profile gets a variant entry → client can select that variantId in the deckbuilder.

#### Locations — engine-relevant

Locations need more structure than cards. They roll from a weighted table, can **swap mid-match** (Scarlet Witch, Nocturne, Magik), **mutate by rule** (Quake shift), and **destroy or transform** each other (Worldbreaker).

```ts
interface LocationDef {
  defId: string;
  version: number;
  rarity: number;                // weight for weighted random roll; higher = more common
  effect?: LocationEffect;       // same DSL/builtin system as card abilities
  // presentation (map image, description) lives in manifest.cosmetics.locations[defId]
}

interface LocationInstance {
  defId: string;                 // MAY CHANGE over the course of a match
  revealed: boolean;
  destroyed?: boolean;           // true after Worldbreaker-style effects
  history?: { defId: string; cause: string; turn: number }[];  // audit trail for replay + debug
}
```

Location selection uses a weighted RNG roll at match creation:

```ts
const rollLocation = (rng: Rng, manifest: GameManifest, excludeDefIds: string[] = []) => {
  const pool = manifest.locations.filter(l => !excludeDefIds.includes(l.defId));
  const total = pool.reduce((s, l) => s + l.rarity, 0);
  let r = rng.next() * total;
  for (const l of pool) { if ((r -= l.rarity) <= 0) return l.defId; }
  return pool[pool.length - 1].defId;
};
```

Same function, same RNG seed, same result on client and server — deep prediction stays in sync through location rolls.

#### Location mutability events

```ts
| { type: 'LOCATION_REPLACED';  lane: number; fromDefId: string; toDefId: string; cause: string }
| { type: 'LOCATION_DESTROYED'; lane: number; defId: string; cause: string }
| { type: 'LOCATION_SHIFTED';   from: number; to: number; defId: string; cause: string }
```

- **`LOCATION_REPLACED`** — Scarlet Witch ("reveal to swap this location for a random one"), Nocturne, Magik-style replacements. Server rolls the new `defId` using the turn seed and bakes it into the event; client just applies.
- **`LOCATION_DESTROYED`** — Worldbreaker. Lane still exists; `destroyed: true` flips the UI to a ruined/empty map state. Cards in the lane stay; effect depends on card rules.
- **`LOCATION_SHIFTED`** — Quake-style reorder. Emitted per affected lane so presentation can animate each slide independently.
- **`cause: string`** — a source-event marker (e.g. `'card:scarlet-witch:reveal'` or `'location:worldbreaker:ongoing'`). Essential for replay debugging, animation hints ("who did this to me?"), and audit logs.

Engine `apply()` handles each. Presentation maps each to a choreography: fade-out the map tile, crossfade to the new one, debris particles for destroy, slide-between-lanes for shift.

#### Locations — cosmetic

```ts
interface LocationCosmetic {
  defId: string;
  displayName: string;
  description: string;
  art: { map: AssetRef; thumbnail?: AssetRef };   // the lane-backdrop image
  accent: string;                                 // lane tint color
  destroyedArt?: AssetRef;                        // optional "after Worldbreaker" visual
}
```

#### Decks

```ts
type Deck = { defId: string; variantId?: string }[];
```

- Thinnest possible shape (Q37 resolved — max unification, no duplicated data).
- Same shape in user profile storage and in `MATCH_STARTED` event payload.
- References manifest entries; never copies stats. Engine resolves each `defId` against the pinned manifest version at match start.
- `variantId` optional; absent = default variant.

#### What we're still deferring

- **Lane-level state** (curses, counters, temp buffs on the lane itself, independent of location). Wrap lanes with `interface Lane { cards: CardInstance[]; effects: LaneEffect[] }` when the first lane-scoped mechanic ships.
- **Localization.** `displayName: string` → `Record<Locale, string>` later; swap the type, not the field name.
- **Card drop rarity.** NOT in the engine schema. Lives in the economy/collection layer when that system lands. `frame` (common/rare/epic/legendary) is cosmetic-only, for border styling.
- **Asset pipeline.** `AssetRef.hash?` + CDN prefetch logic come later. Shape is forward-compatible.
- **Animated art format.** `AssetRef.kind: 'video'` is the hook; MP4 vs WebM vs sprite-sheet is an asset-pipeline decision for later.

### 2.6 Content folder layout — subdirectory per card

Each card and location is a folder. All assets, variants, VFX overrides, and the TS manifest entry for that card live together. Replaces the current flat `cards/*.ts` structure in Phase 1.

```
cards/
├─ _shared/                       # fallbacks, card-back, shared types
│  ├─ card-back.webp
│  └─ default-portrait.webp
├─ scout/
│  ├─ card.ts                     # TS manifest entry (CardDef + CardCosmetic)
│  ├─ portrait.webp               # default art
│  ├─ portrait.animated.webm
│  ├─ thumbnail.webp
│  ├─ variants/
│  │  ├─ holo/
│  │  │  ├─ portrait.webp
│  │  │  └─ portrait.animated.webm
│  │  └─ captain-america/
│  │     └─ portrait.webp
│  ├─ audio/
│  │  ├─ play.ogg
│  │  └─ reveal.ogg
│  └─ vfx/
│     ├─ reveal.ts                # optional per-card choreography override
│     └─ palette.ts               # particle color palette
├─ iron-fist/
│  └─ ...
└─ commander/
   └─ ...

locations/
├─ _shared/
├─ cathedral/
│  ├─ location.ts
│  ├─ map.webp
│  ├─ thumbnail.webp
│  ├─ destroyed.webp              # post-Worldbreaker visual
│  └─ accent.webp
├─ jungle/
│  └─ ...
└─ laboratory/
   └─ ...
```

**Per-card `card.ts`** owns both the engine entry and cosmetic entry as a single typed default export, `satisfies CardManifestEntry`. Authoring is pure TS with full autocomplete. Example in §9.3-adjacent notes.

**Manifest assembly** is build-time via Vite `import.meta.glob('/cards/*/card.ts', { eager: true })`. Emits a single static JSON artifact served by the TanStack Start route `/manifest/v/:version.json` (§9.6). Adding a card = drop a folder; zero edits to central files.

**Why this wins:**

- **Locality** — everything about Scout in one place.
- **Atomic delete** — `rm -rf cards/scout/` removes every trace.
- **Git scoping** — `git log cards/scout/` shows every change to that card.
- **Variant ergonomics** — variants are natural subdirectories, not filename prefixes.
- **Artist handoff** — "drop your art in `cards/scout/`" is unambiguous.
- **Scales gracefully** — 500 cards = 500 folders. Flat folder with 5000 files would be unusable.
- **CDN cache granularity** — per-card path prefix means editing Scout's holo doesn't bust Iron Fist's cache.
- **Per-card VFX** — unique cards with custom reveals (Scarlet Witch, Worldbreaker) get local `vfx/reveal.ts` co-located with the card that uses them.

**Asset pipeline notes (defer implementation):**

- **Image format** — WebP default; AVIF opt-in for newest browsers with WebP fallback.
- **Video format** — WebM/VP9 for animated portraits; MP4/H.264 fallback for Safari. ~2s, loopable, silent.
- **Hashing** — build step emits content-hashed filenames for immutable CDN caching. `AssetRef.hash?` field holds the hash; runtime path resolution swaps it in.
- **Preload strategy** — on match start, prefetch `cards/<defId>/portrait.webp` for every card in both decks. Background, non-blocking. Eliminates stutter during reveal cinematic.

**Path convention.** `AssetRef.path` is always relative to the repo/asset root (e.g. `cards/scout/portrait.webp`). Client prepends the CDN base at runtime. Keeps paths portable across dev / staging / prod.

## 3. Migration Phases

Each phase is independently shippable. We never break `/play` for more than a commit.

### Phase 0 — Groundwork (0.5 day)

- Create `services/playgame/engine/` folder with placeholder `index.ts` re-exporting current types.
- Create `services/playgame/manifest/` folder with a starter typed manifest (hard-coded, no loader yet) — stat values + card ids migrated out of `CARD_POOL`. All engine signatures take `manifest` as a parameter from day one so §9 OTA is a feature addition, not a retrofit.
- Add ESLint `no-restricted-imports` rule: nothing in `engine/` may import from `solid-js`, `solid-js/store`, `@/components`, or touch `document`/`window`.
- Add `tsconfig` path restriction: `engine/` is an island — can import from `engine/` and `engine-adjacent` modules (`types/`, `manifest/`) only.
- Add unit-test harness (`vitest`) with a single smoke test: `apply(createMatch({ manifest: BOOTSTRAP_MANIFEST }), { type: 'MATCH_STARTED', ... }, BOOTSTRAP_MANIFEST)`.

### Phase 1 — Extract `apply` + redesign card/location model (1.5 days)

- Define `MatchEvent` union from the existing mutations. Every `produce(s => ...)` body in `actions.ts` and `PlayGameContext.tsx` maps to one event case.
- Rewrite `types.ts` per §2.5: `CardDef` / `CardInstance` / `LocationDef` / `LocationInstance` get `defId`, `version`, lean instance shape, `power: number | null`. Add `CardCosmetic` / `LocationCosmetic` / `AssetRef` types.
- Migrate the 11 files in `cards/` into per-card subdirectories per §2.6 (`cards/<defId>/card.ts` + asset slots). Existing `OnRevealEffect` functions become `engine/builtins.ts` entries with stable `effectId`s referenced by the `card.ts` manifest entries.
- Migrate `LOCATIONS` into per-location subdirectories (`locations/<defId>/location.ts`) with `rarity` weights.
- Wire `BOOTSTRAP_MANIFEST` to assemble from `import.meta.glob('/cards/*/card.ts', { eager: true })` and the location glob.
- `newCardInstance` resolves stats from manifest by `defId` instead of spreading `CardDef`.
- Write `apply(state, event, manifest)` with full exhaustiveness check covering the new location mutability events (`LOCATION_REPLACED`, `LOCATION_DESTROYED`, `LOCATION_SHIFTED`).
- Replace `produce` bodies in `PlayGameContext` and `actions.ts` with `apply`-driven dispatch. **No behavioral change** in what ships to the user.
- Add first real unit tests: round-trip a known event sequence, assert state shape; location-roll determinism given a fixed seed; location replacement updates `history`.

### Phase 2 — Extract `resolve` + seeded RNG (1 day)

- Add `rng.ts` with `sfc32` PRNG + `createRng(seed)` factory.
- Move `drawQueue` into `MatchState` as `deck: CardDef[]`. Seed it at `createMatch` from the RNG.
- Replace `Math.random` and `randomCardDef` with `rng.next()` / `rng.pick(CARD_POOL)` in engine code.
- `uid()` becomes `rng.uid()` — same seed, same ids across client/server.
- Write `resolve(state, intent, rng)` for STAGE_CARD, UNDO, END_TURN. Returns `MatchEvent[]`. Pure function.
- `PlayGameContext.stageCardInLane` becomes: `for (const e of resolve(state, { type: 'STAGE_CARD', ... }, rng)) setState(produce(s => apply(s, e)));`

### Phase 3 — Extract `resolveTurn` (1 day)

- Walk through the current `resolveTurnFlow` steps and convert each to an event emission, not a DOM call.
- `flipPlayerCardsFaceDown` → emits `CARDS_FLIPPED_DOWN`.
- `enemyPlayRandom` → decision split: engine emits `CARD_FLOWN_IN` for each enemy play (AI logic moves into `engine/ai.ts`, seeded from the turn seed).
- `revealByPriority` → emits `CARD_REVEALED` events in priority order.
- `advanceTurn` → emits `TURN_ADVANCED`.
- `drawHandCard` → emits `CARD_DRAWN` + `CARD_STAGED`-style events.
- Result: `resolveTurn(state, seed) -> MatchEvent[]`. Deterministic. Tested.

### Phase 4 — Event-driven renderer (2 days)

- Build `presentation/event-renderer.ts` that subscribes to an `EventBus<MatchEvent>`.
- Port each existing imperative animation to a `Choreography` recipe (`choreography.ts`).
- Move every `el.style.foo = ...` into CSS classes in `vfx/transitions/classes.css`.
- The script engine (`runner.ts`) stays, but its `Step`s become "wait for event X" and "play choreography for event Y", not state mutations.
- VFX parity: reveal cinematic, fly-face-down, slide-from-deck, FLIP layout slide all reproduced as CSS + class toggles + particle bursts.

### Phase 5 — Particle overlay (1 day)

- Build `vfx/particles/overlay.ts`: canvas resize, RAF loop, emitter API.
- Wire choreography recipes to call `particles.burst(...)` alongside class changes.
- Tune palettes per card type and event type.

### Phase 6 — TanStack Start transport (2 days)

- Add `createServerFn` handlers: `submitIntent`, `startMatch`, `rejoinMatch`.
- Add SSE route `/match/$id/events.ts` that subscribes to the match's event channel and streams `MatchEvent`s with `id:` headers.
- Client swaps local `resolve` calls for `submitIntent` calls; local `apply` still runs (optimistic). SSE events arrive as confirmations; divergence triggers rollback.
- Match state storage: TBD (see Open Questions).

### Phase 7 — Deep prediction (1 day)

- Server emits `TURN_SEED` (containing the per-turn RNG seed + enemy's played cards) as the first event of resolution.
- Client receives `TURN_SEED`, runs `resolveTurn(state, seed)` locally, plays the entire cinematic from local prediction.
- Subsequent server events are reconciliation checks only. Divergence → rollback to last confirmed snapshot + replay with server-authoritative events.

### Phase 8 — Polish (ongoing)

- Offline / practice mode: same engine, mock server function.
- Replay mode: record `MatchEvent[]`, feed through renderer at 1× / 2× / 4× speed.
- Spectator mode: subscribe to an existing match's SSE channel, read-only.

**Total: ~8-10 working days.** Each phase leaves the app working. No big-bang.

## 4. Cross-Cutting Concerns

### 4.1 What stays untouched

- Solid components (`PlayScreen`, `HandCard`, `BoardCard`, `LocationTile`, `InspectOverlay`). They keep reading from the Solid store.
- `VfxHost`, `cardRefs`, `bindCardRef`. Still the DOM lookup infrastructure the renderer needs.
- CSS file structure (`playgame.css`). New classes added, old inline styles removed.

### 4.2 Optimistic updates

- Client applies events locally on intent submission.
- Each intent carries `intentId` (UUID v4). **ID generation goes through
  the `utils/id` module wall** — call `newIntentId()`, never touch
  `crypto.randomUUID` directly. One file to swap if we ever want
  session-scoped counters, pooled ids, or deterministic test fixtures.
- Server dedupes: same `intentId` = no-op.
- Server confirms via SSE event stream with the same `intentId`. Client reconciles: if server's events don't match prediction, roll back to the pre-intent snapshot, replay with server events.

### 4.3 Reconnection

- `EventSource` reconnects automatically.
- Server replays from `Last-Event-ID`.
- Client applies missed events, renderer skips cinematics older than ~1 second (catches up state without visual lag).

### 4.4 Determinism contract

The engine module is pure. To enforce:

- ESLint rule forbids direct use of `Math.random`, `Date.now`, `Date()`, `performance.now`, `fetch`, `crypto.*`, and DOM globals inside `engine/`. The `utils/id` wall is also off-limits to engine code; engine ids come from the seeded RNG (`rng.uid()`). Intent ids (generated client-side, outside the engine) continue to flow through `newIntentId()`.
- All randomness flows through `rng: Rng` parameter.
- All time flows through event payloads (if we ever need timestamps).
- Hashes of client-predicted events compared against server events in dev mode; divergence logs a fat red error.

## 5. Open Questions (answer as you can; "don't know" is a fine answer)

### Gameplay rules

1. **Priority tie-break.** Real Snap: whoever lost priority last round gets it this round, initial coin flip on T1. Do you want to implement that, or keep the "player always wins ties" stub for now?
2. **Deck model.** Fixed 12-card deck per player like Snap? Or drafted from a pool per match? Right now we draw from `CARD_POOL` randomly — want to keep that until decks exist, or design around decks from day one?
3. **Turn limit.** Snap is 6 turns. Hard-coded, or configurable per match?
4. **Retreat / concede.** UX and state flow — does retreat immediately end the match, or surrender on next turn?
5. **Per-card timing rules.** On-reveal effects (Snap's "ongoing" vs "on reveal") — do we need those modeled in this refactor or are we punting until post-refactor?

### VFX fidelity

6. **Reveal cinematic.** Keep the big full-board zoom? Or lean on a tighter in-place flip + particle burst that scales better on mobile?
7. **Particle budget.** Target device floor — iPhone X era? Pixel 6 era? That dictates particle counts and whether we need tiers.
8. **3D card flips.** CSS `rotateY` is cheap on desktop but stutters on some mobile Safari builds. Fallback to a 2D cross-fade on low-powered devices, or accept the stutter?
9. **Lane-map art.** Stays as `<div style="background-image: ...">` or moves into the particle canvas (more control, but harder to debug)?

### Transport / infra

10. **Runtime target.** Node on Fly/Railway? Cloudflare Workers + Durable Objects? Vercel with Edge Streaming? Each has different SSE duration and match-state-storage implications.
11. **Match state storage.** In-memory per-process (single instance, easy, doesn't scale)? Redis pub/sub (standard, scales)? Durable Objects (one per match, perfect fit, locks you to Cloudflare)? Postgres `LISTEN/NOTIFY` (fine if you already have Postgres)?
12. **Auth.** Session cookies already handled elsewhere in the app — does `/play` need session validation on intent submission, or is it open-access for the prototype?
13. **Spectator scope.** In the near term: self only, friend/link share, or matchmade spectator pool?
14. **Opponent hover / typing telemetry.** "Opponent is hovering your card" indicators — yes/no? If yes, that's the one feature that nudges us toward WebSocket for a sub-channel.

### Reconnection / persistence

15. **Match resumability.** If the player closes the tab mid-turn, do we resume exactly where they left off, or forfeit after N seconds? Snap gives you a grace window.
16. **Event log retention.** Keep every event forever (replay), keep last N for reconnection, or just the snapshot?
17. **Snapshot cadence.** Snapshot every turn for fast reconnection? Or snapshot on demand and always replay from event log?

### Determinism / testing

18. **Seed provenance.** Server generates seed per match + per turn, client never generates. Do you want seed to be visible in dev mode for repro bugs, or hidden?
19. **Replay files.** Export match as a JSON log of events + initial seed — worth building for debugging? Adds disk-space concerns if matches store forever.
20. **AI quality.** Current `enemyPlayRandom` is pure noise. Is this refactor the moment to upgrade AI (min-max, Monte Carlo, simple heuristics), or keep random and upgrade later?

### VFX migration tactics

21. **CSS-first cutover.** Port all animations to CSS classes in one go, or one-animation-at-a-time alongside the engine extraction?
22. **Inline style audit.** Some animations (reveal cinematic zoom-to-full-board) may not translate cleanly to pure CSS. Do we accept a small JS helper for the outliers, or force everything into CSS even if it's awkward?
23. **Accessibility.** `prefers-reduced-motion` — should we ship reduced-motion alternatives now or post-refactor?

### Card / Location model (§2.5) — resolved

- ~~31. **Tribes / tags.**~~ → **RESOLVED:** no tribe tags. Each card stands alone. `type` removed from engine schema.
- ~~32. **Variant unlocks.**~~ → **RESOLVED:** earned (play X matches, season pass), purchased, and gifted (redemption codes). `source` enum in `CardVariant`.
- ~~33. **Animated card art.**~~ → **RESOLVED:** yes. `AssetRef.kind: 'video'` slot; MP4 / WebM / sprite-sheet format TBD at asset-pipeline time.
- ~~34. **Keywords.**~~ → **RESOLVED:** Snap-style keyword-labeled rules text. `keywords?: string[]` on `CardCosmetic`, rendered as badges.
- ~~35. **Identifier style.**~~ → **RESOLVED:** bump `version` field separately from `defId`. `defId` is stable forever.
- ~~36. **Face-down visibility.**~~ → **RESOLVED:** option (a), server-authoritative anti-cheat. Server withholds enemy stats until reveal; `CardInstance.power` is `number | null` on the client while face-down; stats arrive in the `CARD_REVEALED` event's `CardReveal` payload. Devtools can't read enemy face-down power because it was never sent.
- ~~37. **Deck shape.**~~ → **RESOLVED:** max unification. Deck is `{ defId; variantId? }[]` — a reference list into the manifest, never a copy of card data. Same shape in user profile and match-start event.

## 6. Success Metrics

We know we're done when:

- `services/playgame/engine/` has zero imports from `solid-js` or DOM globals. Builds in Node.
- A CLI test runner can execute a full match end-to-end: `createMatch(seed) -> [intents] -> state` with no browser, just `apply` + `resolveTurn`.
- The reveal cadence plays with zero HTTP round-trips after the turn seed arrives.
- Pulling the SSE plug mid-match, then reconnecting, catches up cleanly with no visible glitch.
- A dev-mode assertion that compares client-predicted events against server events for 100 matches reports zero divergences.
- Offline practice mode ships as a five-line change (swap `submitIntent` for a local stub).

## 7. Risks

- **VFX parity regression.** The current imperative animations have years of tuning. Porting to CSS classes may drift visually. Mitigation: side-by-side screenshot tests for the reveal cinematic on day of cutover.
- **Determinism bugs are subtle.** One stray `Math.random()` in engine code = prediction breaks silently. Mitigation: strict ESLint + dev-mode divergence detection.
- **Particle canvas perf on mobile.** 500 particles at 60fps is the budget, but worst-case boards (many simultaneous reveals) can exceed it. Mitigation: particle count caps per event, tier particle density by device class.
- **TanStack Start SSE on Cloudflare Workers.** Workers have execution time limits that may require session renewal every ~30s. Mitigation: design SSE subscribers around automatic reconnection, or pick a runtime without that limit.
- **Refactor drag.** 8-10 days is an optimistic estimate. Buffer: each phase ships independently, so partial completion still delivers value.

## 8. Kickoff Checklist

- [ ] Confirm TanStack Start as transport (yes — confirmed)
- [ ] Decide runtime target (Q10)
- [ ] Decide match state storage (Q11)
- [ ] Agree on deck model for the refactor (Q2)
- [ ] Agree on particle/device floor (Q7)
- [ ] Land Phase 0 (folder scaffolding + lint rules + smoke test)
- [ ] Open a tracking issue per phase

## 9. OTA & Content Updates

Live card games ship balance patches every 1-2 weeks. That cadence is incompatible with app-store review cycles and "force users to download a new build". The answer is the industry-standard split: **content + tuning travel over the wire as data; engine primitives ship with the client build.**

### 9.1 What's OTA-updatable vs client-build

**OTA (data):**

- Card stats (`cost`, `power`, `text`, `art`).
- Card ability parameters ("buff +2" → "buff +3", "draw 1" → "draw 2").
- Card enable/disable flags — emergency kill-switch.
- Location stats and effects.
- Game constants (energy curve, turn limit, hand cap, lane capacity, deck size).
- Matchmaking config, economy config, rotating card pools.

**Client build (code):**

- New trigger types (e.g. `onDestroy`), new effect primitives.
- New VFX / particle effects / animations.
- Engine bug fixes in `apply()` / `resolve()`.
- `MatchEvent` / `MatchIntent` schema changes (protocol version bump).

Rule: **if the change composes existing primitives, it's OTA. If it adds to the engine vocabulary, it's a build.**

### 9.2 Manifest architecture

One versioned JSON document is the single source of truth for all data:

```ts
interface GameManifest {
  version: number;            // monotonic; bumps every publish
  protocolVersion: number;    // major; must fit client's supported range
  constants: {
    energyCurve: number[];    // [1,2,3,4,5,6]
    turnLimit: number;        // 6
    handCap: number;          // 7
    laneCapacity: number;     // 4
    deckSize: number;         // 12
  };
  cards: CardManifestEntry[];
  locations: LocationManifestEntry[];
  disabled: { cards: string[]; locations: string[] };
}
```

Validated by a `zod` (or `valibot`) schema at load time; malformed manifests fail loud, never silently.

### 9.3 Ability model — hybrid DSL + builtin

```ts
type Ability =
  | { kind: 'dsl'; trigger: 'onReveal' | 'onDestroy' | 'ongoing'; effect: Effect }
  | { kind: 'builtin'; effectId: string; params?: Record<string, unknown> };

type Effect =
  | { op: 'addPower';   target: Target; amount: number }
  | { op: 'drawCards';  count: number }
  | { op: 'destroy';    target: Target }
  | { op: 'summon';     cardId: string; lane: 'self' | 'adjacent' }
  | { op: 'sequence';   effects: Effect[] }
  | { op: 'repeat';     count: number; effect: Effect }
  | { op: 'ifLane';     condition: LaneCondition; then: Effect; else?: Effect };
```

- **DSL handles ~90% of cards** — buffs, draws, destroys, summons. Tuning = edit manifest.
- **Builtins cover the weird ones** — unique cards (Scout's hand-growing deck add, Antimatter Spark's conditional clone) stay in `engine/builtins.ts` with stable ids.
- **Builtins are *parameterized*** — `{ kind: 'builtin', effectId: 'scoutDraw', params: { count: 1 } }` — so tuning a builtin is still OTA. Only *adding new builtins* requires a client build.

This is what Snap and Hearthstone actually do. Pure DSL is too rigid. Pure code-per-card is too slow to patch.

### 9.4 Engine contract

```ts
export const apply = (state, event, manifest): MatchState => ...;
export const resolve = (state, intent, rng, manifest): MatchEvent[] => ...;
export const createMatch = ({ seed, manifest, decks }) => ...;
```

Manifest flows through as a ctx field, same shape client and server. Engine stays pure. Manifest is data.

### 9.5 Versioning and pinning

**Hard rule: matches are pinned to the manifest version they started with.** Balance patches never affect in-flight matches.

- `MATCH_STARTED` event carries `manifestVersion`.
- Client checks its cache; fetches if absent.
- New matches use the latest version; existing matches continue on their pinned version.
- `protocolVersion` mismatch → client is told to upgrade the app before matchmaking.

### 9.6 Distribution

Three pieces:

1. **Static versioned manifest** — TanStack route `/manifest/v/:version.json`. CDN-cacheable, immutable per version.
2. **Version pointer** — lightweight endpoint `/manifest/current` returning `{ version }`. Polled on app startup and on `visibilitychange`. ~200 bytes.
3. **IndexedDB cache** — client stores the last N versions. Enables offline practice.

Client bootstrap:

```
1. Read cached version from localStorage (default 0)
2. Fetch /manifest/current
3. If newer, background-fetch /manifest/v/:n.json
4. Apply new version on next screen entry — never mid-screen
5. Match start with pinned version → fetch on demand if missing
```

### 9.7 Authoring + publishing

**Start small:** typed TS file checked into the repo. `pnpm build:manifest` emits the JSON. Version auto-bumps. Deploy = publish. No admin UI required.

**Upgrade when the card count demands it:** a tiny admin UI with form validation. Same zod schema on client, server, and admin. Admin previews against staging before promoting to prod.

### 9.8 Emergency hotfix path

- **Broken card:** add id to `disabled.cards`, bump version, publish. Clients filter from deckbuilder; server rejects matches containing it.
- **Runaway exploit:** same mechanism, plus a server-side override that rejects the card-in-use even for clients on older cached manifests (defense in depth).
- **Worst-case protocol break:** `protocolVersion` bump + forced app upgrade. Last resort.

### 9.9 What this costs in the refactor

The engine refactor already does ~90% of the work:

- Pure engine + deterministic events → manifest parameter slots in trivially.
- Shared module client/server → same schema both sides by construction.
- Seeded RNG + event log → replays carry their manifest version; replay works forever against pinned manifest.

Incremental adds:

- `services/playgame/manifest/` — loader, schema, version pointer fetcher.
- Two TanStack routes — `/manifest/v/:v.json`, `/manifest/current`.
- Starter manifest file + build step (TS → JSON).
- `manifest` param threaded through `createMatch` / `apply` / `resolve`.

**Do this during the engine refactor, not after.** Threading the manifest param through `apply`/`resolve` is trivial at extraction time and painful to retrofit later.

### 9.10 Open questions (OTA-specific)

24. **Authoring surface.** TS-file-checked-in (start here) vs admin UI (upgrade later) — confirm the phasing.
25. **DSL scope for v1.** Ship the full Effect union from day one, or start with stats-only + builtin-per-card and grow the DSL as patterns emerge?
26. **Hotfix SLA.** How fast from "card is broken" to "every client filters it"? Tight SLA means short CDN cache TTL on the version pointer (30-60s). Loose SLA means cheaper caching.
27. **Seasonal content.** Date-ranged entries inside the manifest, or one manifest per season with a pointer swap at season boundary?
28. **Manifest granularity.** One atomic manifest (simpler versioning, bigger file) vs split per-domain (`cards.json`, `locations.json`, `balance.json`) with per-file versions?
29. **Deck-legality validation.** Where does "this deck is legal against the current manifest" live — client-side filter, server-side reject, or both?
30. **Playtest / staging.** Do we need a `manifest.staging` channel that dev builds consume, separate from prod? Prevents prod leaks of unfinished cards.

---

*Last updated: §2.6 content folder layout (subdirectory per card/location) added; Phase 1 references the new folder structure; Q36 locked to server-authoritative anti-cheat.*
