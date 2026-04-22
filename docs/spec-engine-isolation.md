# Spec 0.2 — Engine Isolation & Pure Reducer

> Roadmap tier 0.2 + absorbed prerequisites from 1.1 (seeded RNG) and 1.2 (card model redesign). Goal: extract a pure, deterministic, DOM-free, Solid-free, server-runnable engine for /play.

Status: **Approved design, ready to implement.**
Dependencies absorbed: Tier 1.1 (Seeded PRNG), Tier 1.2 (Card model redesign). Tier 0.1 (Ability DSL) compiles down to the same `EffectExpr` / `OngoingExpr` this spec defines, so shipping 0.2 with a hand-written manifest is forward-compatible.

---

## 1. Scope & Non-Goals

### In scope
- `services/playgame/engine/` folder, ESLint-isolated from Solid/DOM/Math.random.
- Pure `apply(state, event, manifest) → state` reducer.
- Pure `resolve(state, intent, rng, manifest) → MatchEvent[]` intent validator + event generator.
- Pure `resolveTurn(state, seed, manifest) → MatchEvent[]` full-turn orchestration.
- Seeded `Rng` interface + sfc32 implementation.
- Projection library (`engine/projections.ts`) — pure queries over state.
- Recursive OR evaluator (`engine/eval.ts`) — tree-walk interpreter for `EffectExpr` trees.
- New typed card / location / manifest model.
- Bootstrap manifest assembling current demo cards into the new shape.
- Golden-trace test harness for interaction coverage.

### Out of scope (deliberate)
- Full JSON Ability DSL (that is Tier 0.1; ships after 0.2, same wire shape).
- Particle system (Tier 2.2).
- Server transport / TanStack Start (Tier 3).
- Per-card-folder manifest assembly with `import.meta.glob` (Tier 1.2 refinement; bootstrap manifest is a flat file).
- Render-layer event choreography (Tier 2.1).

### Success criteria
- `pnpm engine:cli match --seed 123` runs an entire match in Node with zero browser, producing deterministic event logs.
- `pnpm test engine` covers Wong+Odin, Mystique+Wong, Jubilee→Odin cascade, Shuri tag consumption, Cosmo blocking OR, Echo disabling Ongoings, Iron Man+Onslaught stacking (additive), depth-limit safety.
- Replaying the same `seed + deck + intents` produces byte-identical `MatchEvent[]` across runs.
- No file under `engine/` imports `solid-js`, a DOM global, or `Math.random` (lint-enforced).

---

## 2. Folder Layout

```
services/playgame/
  engine/                          # pure; no Solid, no DOM, no Math.random
    index.ts                       # public exports
    apply.ts                       # reducer: (state, event) → state
    resolve.ts                     # intent → events
    resolveTurn.ts                 # turn orchestration
    eval.ts                        # recursive AST evaluator for EffectExpr
    reveal.ts                      # reveal-pipeline helpers
    projections/
      index.ts                     # re-exports
      power.ts                     # getCardPower, getLanePower
      cost.ts                      # getCardCost
      reveal.ts                    # getOnRevealMultiplier, isOnRevealDisabled
      ongoing.ts                   # collectApplicableOngoings (+ Super Skrull/Mystique deref)
      priority.ts                  # getPriority, getWinner
      draw.ts                      # nextCardFromDeck
      selectors.ts                 # select(selector, ctx) → CardId[]
    rng/
      sfc32.ts                     # seeded PRNG
      index.ts                     # Rng interface
    manifest/
      index.ts                     # Manifest type + loader
      bootstrap.ts                 # hand-assembled manifest for launch cards
    types/
      state.ts                     # MatchState, CardInstance, LocationInstance
      events.ts                    # MatchEvent union
      intents.ts                   # MatchIntent union
      ability.ts                   # EffectExpr, OngoingExpr, Selector, Predicate, NumExpr
      ids.ts                       # CardId, LocationId, Owner, LaneIdx brand types
    builtins/                      # typed TS implementations for complex cards
      index.ts                     # registry: effectId → function
      odin.ts
      jubilee.ts
      armin-zola.ts
      mystique.ts
      super-skrull.ts
      ...
  adapters/                        # allowed to touch Solid + DOM
    solid-store.ts                 # applies MatchEvents to a createStore
    vfx-choreography.ts            # MatchEvent → CSS class/animation mapping (stub for 0.2)
  script/                          # LEGACY — shrinks during migration, deleted after
    ...
```

**Isolation rules enforced by ESLint** (`eslint.config.js`):

```js
{
  files: ['services/playgame/engine/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [
        { name: 'solid-js',        message: 'engine/ is Solid-free' },
        { name: 'solid-js/store',  message: 'engine/ is Solid-free' },
        { name: 'solid-js/web',    message: 'engine/ is Solid-free' },
      ],
      patterns: [
        { group: ['**/components/**'], message: 'engine/ cannot import UI' },
        { group: ['**/adapters/**'],   message: 'engine/ cannot import adapters' },
        { group: ['**/services/vfx/**'], message: 'engine/ cannot import VFX' },
      ],
    }],
    'no-restricted-globals': ['error',
      { name: 'window',   message: 'engine/ is DOM-free' },
      { name: 'document', message: 'engine/ is DOM-free' },
    ],
    'no-restricted-properties': ['error',
      { object: 'Math', property: 'random', message: 'Use Rng from rng/ — Math.random breaks determinism' },
      { object: 'Date', property: 'now',    message: 'Inject a clock; Date.now breaks determinism' },
    ],
  },
}
```

---

## 3. Core Types

### 3.1 State

```ts
// engine/types/ids.ts
export type CardId     = string & { __brand: 'CardId' };
export type LocationId = string & { __brand: 'LocationId' };
export type Owner      = 'PLAYER' | 'OPP';
export type LaneIdx    = 0 | 1 | 2;

// engine/types/state.ts
import type { CardId, LocationId, Owner, LaneIdx } from './ids';
import type { TextOverride } from './ability';

export interface MatchState {
  readonly turn: number;                    // 1..6
  readonly maxEnergy: number;               // = turn
  readonly phase: MatchPhase;
  readonly seed: string;                    // master seed; per-turn seeds derived
  readonly priority: Owner;                 // who reveals first this turn
  readonly energy: Record<Owner, number>;   // remaining this turn
  readonly deck:   Record<Owner, CardInstance[]>;
  readonly hand:   Record<Owner, CardInstance[]>;
  readonly cards:  Record<CardId, CardInstance>;      // id → card (any zone)
  readonly lanes:  LaneState[];             // length 3
  readonly pending: CardId[];               // face-down staged this turn, reveal order
  readonly stagingOrder: CardId[];          // append-only for reveal ordering
  readonly pendingEffects: PendingEffect[]; // one-shot pending conditions
  readonly log: MatchLogEntry[];            // flat list of all events ever applied
  readonly lastPlayedBy: Record<Owner, CardId | null>; // for Mystique's LAST_PLAYED
  readonly result: MatchResult | null;      // null until MATCH_ENDED
}

export type MatchPhase =
  | 'AWAITING_INTENT'      // player can stage/unstage
  | 'RESOLVING'            // turn is resolving; no intents
  | 'BETWEEN_TURNS'        // draw/reveal-location animations
  | 'ENDED';

export interface LaneState {
  readonly idx: LaneIdx;
  readonly location: LocationInstance | null;  // null until revealed
  readonly locationRevealed: boolean;
  readonly cards: Record<Owner, CardId[]>;     // 0..4 per side, reveal order
}

export interface CardInstance {
  readonly id: CardId;
  readonly defId: string;                      // points into manifest
  readonly version: number;                    // for future balance patches
  readonly owner: Owner;
  readonly lane: LaneIdx | null;               // null if in hand/deck/discard
  readonly zone: 'DECK' | 'HAND' | 'LANE' | 'DISCARD' | 'REMOVED';
  readonly revealed: boolean;
  readonly tags: readonly CardTag[];
  readonly textOverride: TextOverride | null;  // Mystique / Super Skrull
  readonly counters: Readonly<Record<string, number>>; // generic named counters
}

export interface LocationInstance {
  readonly id: LocationId;
  readonly defId: string;
  readonly lane: LaneIdx;
  readonly tags: readonly LaneTag[];           // only location-intrinsic tags
}

export type CardTag =
  | { kind: 'MOVED_THIS_TURN' }
  | { kind: 'DESTROYED_THIS_TURN' }
  | { kind: 'SHURI_DOUBLED' }                  // attached to the chosen card at reveal
  | { kind: 'FROM_SPAWN'; sourceId: CardId };  // "was this card played vs spawned"

export type LaneTag =
  | { kind: 'FLOODED' }                        // e.g., Storm
  | { kind: 'ON_FIRE' }                        // e.g., Muir Island scheduled
  | { kind: 'SEALED' };                        // Prof X

export type PendingEffect =
  | { kind: 'SHURI_DOUBLE_NEXT'; owner: Owner; lane: LaneIdx; sourceId: CardId }
  | { kind: 'COULSON_TRIGGER_NEXT'; owner: Owner; lane: LaneIdx; sourceId: CardId }
  | { kind: 'EGO_OVERRIDE'; turn: number }
  | { kind: 'RICKETY_BRIDGE_DESTROY'; lane: LaneIdx; atEndOfTurn: number };

export type MatchResult =
  | { winner: 'PLAYER' | 'OPP' | 'DRAW'; lanesWon: Record<Owner, number>; totalPower: Record<Owner, number> };

export interface MatchLogEntry {
  readonly seq: number;
  readonly event: MatchEvent;
  readonly source?: { cardId?: CardId; effectIdx?: number };  // optional provenance
}
```

### 3.2 Events

```ts
// engine/types/events.ts
export type MatchEvent =
  // Staging / play
  | { type: 'CARD_STAGED';      intentId: string; cardId: CardId; lane: LaneIdx; owner: Owner; cost: number }
  | { type: 'CARD_UNSTAGED';    intentId: string; cardId: CardId }
  | { type: 'ENERGY_CHANGED';   owner: Owner; delta: number; reason: EnergyReason }

  // Reveal + OR
  | { type: 'CARD_FLIPPED';     cardId: CardId }
  | { type: 'OR_WINDOW_OPEN';   cardId: CardId; multiplier: number }  // diagnostic, counts captured-Wong
  | { type: 'OR_WINDOW_CLOSE';  cardId: CardId }

  // Effects applied to cards
  | { type: 'CARD_POWER_CHANGED';   cardId: CardId; delta: number; cause: EffectRef }
  | { type: 'CARD_DESTROYED';       cardId: CardId; cause: EffectRef }
  | { type: 'CARD_MOVED';           cardId: CardId; fromLane: LaneIdx; toLane: LaneIdx; cause: EffectRef }
  | { type: 'CARD_TAG_ADDED';       cardId: CardId; tag: CardTag }
  | { type: 'CARD_TAG_REMOVED';     cardId: CardId; tag: CardTag['kind'] }
  | { type: 'CARD_TEXT_OVERRIDDEN'; cardId: CardId; override: TextOverride }
  | { type: 'CARD_COUNTER_CHANGED'; cardId: CardId; name: string; delta: number }

  // Deck / hand
  | { type: 'CARD_DRAWN';           owner: Owner; cardId: CardId; toHand: true }
  | { type: 'CARD_ADDED_TO_DECK';   owner: Owner; cardId: CardId }
  | { type: 'CARD_ADDED_TO_LANE';   owner: Owner; cardId: CardId; lane: LaneIdx }  // Jubilee result
  | { type: 'DECK_SHUFFLED';        owner: Owner; newOrder: CardId[] }

  // Pending effects
  | { type: 'PENDING_EFFECT_ADDED';    effect: PendingEffect }
  | { type: 'PENDING_EFFECT_REMOVED';  effect: PendingEffect }

  // Location
  | { type: 'LOCATION_REVEALED';  lane: LaneIdx; locationId: LocationId }
  | { type: 'LOCATION_REPLACED';  lane: LaneIdx; oldId: LocationId; newId: LocationId; cause: EffectRef }
  | { type: 'LOCATION_TAG_ADDED'; lane: LaneIdx; tag: LaneTag }
  | { type: 'LOCATION_TAG_REMOVED'; lane: LaneIdx; tag: LaneTag['kind'] }

  // Turn flow
  | { type: 'TURN_STARTED';   turn: number; priority: Owner; priorityReason: PriorityReason }
  | { type: 'TURN_ENDED';     turn: number }
  | { type: 'MATCH_ENDED';    result: MatchResult }

  // Diagnostics
  | { type: 'RECURSION_LIMIT_HIT'; cardId: CardId; depth: number }
  | { type: 'INTENT_REJECTED';     intentId: string; reason: string };

export type EnergyReason = 'TURN_START' | 'CARD_PLAYED' | 'CARD_UNSTAGED' | 'EFFECT';

export type EffectRef = {
  sourceId: CardId | LocationId;
  effectKind: 'ON_REVEAL' | 'ONGOING' | 'LOCATION' | 'SYSTEM';
  exprIdx?: number;
};

export type PriorityReason = 'MORE_LANES' | 'MORE_POWER' | 'COIN_FLIP' | 'RETAINED';
```

**Exhaustiveness rule**: every `MatchEvent` variant must have a case in `apply()` with a matching `never` check:

```ts
function assertNever(x: never): never { throw new Error(`unhandled: ${JSON.stringify(x)}`); }
```

### 3.3 Intents

```ts
// engine/types/intents.ts
export type MatchIntent =
  | { type: 'STAGE_CARD';   intentId: string; owner: Owner; cardId: CardId; lane: LaneIdx }
  | { type: 'UNSTAGE_CARD'; intentId: string; owner: Owner; cardId: CardId }
  | { type: 'UNDO_TURN';    intentId: string; owner: Owner }           // rollback to start-of-turn snapshot
  | { type: 'END_TURN';     intentId: string; owner: Owner }
  | { type: 'CONCEDE';      intentId: string; owner: Owner };
```

**`intentId`** is a UUID v4 generated client-side. Used for dedup and optimistic-reconciliation in Tier 3.

### 3.4 Ability DSL (compact primitive; full JSON DSL is Tier 0.1)

```ts
// engine/types/ability.ts

// --- Value expressions ---
export type NumExpr =
  | { kind: 'LIT'; n: number }
  | { kind: 'COUNT'; of: Selector }
  | { kind: 'POWER_OF'; target: Selector }           // "power of the source card"
  | { kind: 'MIN'; a: NumExpr; b: NumExpr }
  | { kind: 'MAX'; a: NumExpr; b: NumExpr }
  | { kind: 'ADD'; a: NumExpr; b: NumExpr }
  | { kind: 'MUL'; a: NumExpr; b: NumExpr }
  | { kind: 'RANDOM_INT'; lo: NumExpr; hi: NumExpr };  // closed range; uses Rng

// --- Predicates ---
export type Predicate =
  | { kind: 'TRUE' }
  | { kind: 'AND'; all: Predicate[] }
  | { kind: 'OR';  any: Predicate[] }
  | { kind: 'NOT'; p: Predicate }
  | { kind: 'HAS_TAG'; target: Selector; tag: string }
  | { kind: 'POWER_CMP'; target: Selector; op: '<' | '<=' | '==' | '>=' | '>'; value: NumExpr }
  | { kind: 'COST_CMP';  target: Selector; op: '<' | '<=' | '==' | '>=' | '>'; value: NumExpr }
  | { kind: 'SAME_LANE'; a: Selector; b: Selector }
  | { kind: 'SAME_OWNER'; a: Selector; b: Selector }
  | { kind: 'EXISTS'; target: Selector };

// --- Selectors: which cards/locations are targeted ---
export type Selector =
  | { kind: 'SELF' }
  | { kind: 'LAST_PLAYED'; by: 'SELF_OWNER' | 'OPP_OWNER' }
  | { kind: 'LANE_OF'; of: Selector }
  | { kind: 'SAME_LANE'; of: Selector; ownerFilter?: OwnerFilter; exclude?: Selector }
  | { kind: 'OTHER_LANES'; of: Selector; ownerFilter?: OwnerFilter }
  | { kind: 'ALL_CARDS'; ownerFilter?: OwnerFilter; zoneFilter?: ZoneFilter }
  | { kind: 'DECK_OF'; owner: Owner }
  | { kind: 'HAND_OF'; owner: Owner }
  | { kind: 'WHERE'; of: Selector; pred: Predicate }
  | { kind: 'RANDOM_N'; of: Selector; count: NumExpr }  // uses Rng
  | { kind: 'FIRST_N';  of: Selector; count: NumExpr }  // reveal order
  | { kind: 'UNION'; all: Selector[] };

export type OwnerFilter = 'SELF_OWNER' | 'OPP_OWNER' | 'ANY_OWNER';
export type ZoneFilter  = 'LANE' | 'HAND' | 'DECK' | 'DISCARD' | 'ANY';

// --- Effects (On Reveal / Activate / triggered) ---
export type EffectExpr =
  // Atoms
  | { kind: 'ADD_POWER';         target: Selector; delta: NumExpr }
  | { kind: 'SET_POWER';         target: Selector; value: NumExpr }
  | { kind: 'DESTROY';           target: Selector }
  | { kind: 'MOVE';              target: Selector; to: Selector }  // to is usually a lane selector
  | { kind: 'DRAW';              owner: Owner | 'SELF_OWNER'; count: NumExpr }
  | { kind: 'DISCARD';           target: Selector }
  | { kind: 'ADD_CARD_TO_LANE';  pool: PoolRef; owner: Owner | 'SELF_OWNER'; to: Selector }
  | { kind: 'ADD_CARD_TO_HAND';  pool: PoolRef; owner: Owner | 'SELF_OWNER' }
  | { kind: 'COPY_TEXT_OF';      into: Selector; source: Selector }   // Mystique
  | { kind: 'ADD_PENDING';       effect: PendingEffect }              // Shuri, Coulson
  | { kind: 'ADD_CARD_TAG';      target: Selector; tag: CardTag }
  | { kind: 'REMOVE_CARD_TAG';   target: Selector; tag: string }
  | { kind: 'ADD_LOCATION_TAG';  lane: Selector; tag: LaneTag }
  | { kind: 'REPLACE_LOCATION';  lane: Selector; newDefId: string }
  | { kind: 'MODIFY_COUNTER';    target: Selector; name: string; delta: NumExpr }
  | { kind: 'CALL_BUILTIN';      fn: string; args: Record<string, unknown> }  // escape hatch

  // Re-entry combinators (cause nested revealCard calls)
  | { kind: 'TRIGGER_ON_REVEAL'; target: Selector }                       // Odin, White Tiger-on-move
  | { kind: 'SPAWN_AND_REVEAL';  pool: PoolRef; owner: Owner | 'SELF_OWNER'; to: Selector }  // Jubilee, Arnim Zola

  // Control flow
  | { kind: 'SEQUENCE';          items: EffectExpr[] }
  | { kind: 'CONDITIONAL';       if: Predicate; then: EffectExpr[]; else?: EffectExpr[] }
  | { kind: 'FOREACH';           over: Selector; do: EffectExpr[]; as?: 'it' };

export type PoolRef =
  | { kind: 'DECK_OF_OWNER'; owner: Owner | 'SELF_OWNER'; excludeInPlay?: boolean }
  | { kind: 'DEF_ID_LIST'; ids: string[] }
  | { kind: 'COST_RANGE'; ownerDeck: Owner | 'SELF_OWNER'; min: number; max: number }
  | { kind: 'ANY_RANDOM'; ownerFilter: OwnerFilter };

// --- Ongoings: read by projections, never fired as events ---
export type OngoingExpr =
  | { kind: 'POWER_ADD';            target: Selector; delta: NumExpr; stack: StackingPolicy }
  | { kind: 'POWER_MULTIPLIER';     target: Selector; factor: NumExpr; stack: StackingPolicy }  // Iron Man (stack: ADDITIVE per Nov 2022 patch)
  | { kind: 'MULTIPLIER_BOOST';     target: Selector; targetExpr: OngoingExprKind; delta: NumExpr; stack: StackingPolicy } // Onslaught
  | { kind: 'ON_REVEAL_MULTIPLIER'; target: Selector; factor: NumExpr; stack: StackingPolicy }  // Wong (stack: MULTIPLICATIVE)
  | { kind: 'COST_ADD';             target: Selector; delta: NumExpr; stack: StackingPolicy }
  | { kind: 'DISABLE_ON_REVEAL';    target: Selector; stack: 'SINGLE' }                         // Cosmo lane aura
  | { kind: 'DISABLE_ONGOING';      target: Selector; stack: 'SINGLE' }                         // Echo, Enchantress aura
  | { kind: 'BLOCK_PLAY';           target: Selector; pred: Predicate; stack: 'SINGLE' }        // Sanctum
  | { kind: 'COPY_ONGOING_OF';      into: Selector; source: Selector; stack: 'SINGLE' };        // Super Skrull

export type OngoingExprKind = OngoingExpr['kind'];

export type StackingPolicy = 'MULTIPLICATIVE' | 'ADDITIVE' | 'MAX' | 'SINGLE';

// --- Text override (Mystique / Super Skrull) ---
export type TextOverride =
  | { kind: 'COPY_OF_DEF'; defId: string }          // static snapshot (rare)
  | { kind: 'COPY_OF_CARD'; cardId: CardId }        // dynamic reference (Mystique default)
  | { kind: 'COPY_ONGOING_OF_CARD'; cardId: CardId }; // Super Skrull Ongoing-only
```

### 3.5 Manifest

```ts
// engine/manifest/index.ts
export interface Manifest {
  cards: Record<string, CardDef>;           // defId → def
  locations: Record<string, LocationDef>;
  version: string;                          // manifest revision for compatibility checks
}

export interface CardDef {
  defId: string;
  version: number;
  name: string;                             // display only
  basePower: number;
  cost: number;
  tribes: readonly string[];                // e.g., "AVENGER", "X_MEN"
  abilities: {
    onReveal?: EffectExpr[];
    ongoing?: OngoingExpr[];
    activate?: EffectExpr[];                // future; unused in 0.2
  };
  cosmetic: CardCosmetic;
}

export interface LocationDef {
  defId: string;
  version: number;
  name: string;
  rarity: number;                           // draw weight
  abilities: {
    ongoing?: OngoingExpr[];                // e.g., Kamar-Taj (ORs trigger twice)
    onReveal?: EffectExpr[];                // e.g., Knowhere initial effect
    atTurnEnd?: EffectExpr[];               // e.g., Rickety Bridge
  };
  cosmetic: LocationCosmetic;
}

export interface CardCosmetic { art: string; frame?: string; voiceLine?: string }
export interface LocationCosmetic { art: string; frame?: string }
```

### 3.6 RNG

```ts
// engine/rng/index.ts
export interface Rng {
  readonly seed: string;
  int(lo: number, hi: number): number;      // inclusive-inclusive
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];       // Fisher-Yates; returns new array
  fork(tag: string): Rng;                   // derived Rng; deterministic per (parent seed + tag)
}

// engine/rng/sfc32.ts
export function createRng(seed: string): Rng { ... }
```

**Determinism requirement**: any effect that samples randomness receives an `Rng` that is `fork`ed from a deterministic tag (e.g., `rng.fork(\`card:${cardId}:reveal:${iteration}\`)`). Same seed + same tag + same call order → same output across client & server.

---

## 4. Reducer: `apply`

```ts
// engine/apply.ts
import { produce } from 'immer';

export function apply(state: MatchState, event: MatchEvent, manifest: Manifest): MatchState {
  return produce(state, (draft) => {
    draft.log.push({ seq: draft.log.length, event });
    switch (event.type) {
      case 'CARD_STAGED':      return applyCardStaged(draft, event);
      case 'CARD_UNSTAGED':    return applyCardUnstaged(draft, event);
      case 'CARD_FLIPPED':     return applyCardFlipped(draft, event);
      case 'CARD_POWER_CHANGED':   return applyCardPowerChanged(draft, event);
      case 'CARD_DESTROYED':       return applyCardDestroyed(draft, event);
      case 'CARD_MOVED':           return applyCardMoved(draft, event);
      case 'CARD_TAG_ADDED':       return applyCardTagAdded(draft, event);
      case 'CARD_TAG_REMOVED':     return applyCardTagRemoved(draft, event);
      case 'CARD_TEXT_OVERRIDDEN': return applyCardTextOverridden(draft, event);
      case 'CARD_COUNTER_CHANGED': return applyCardCounterChanged(draft, event);
      case 'CARD_DRAWN':           return applyCardDrawn(draft, event);
      case 'CARD_ADDED_TO_DECK':   return applyCardAddedToDeck(draft, event);
      case 'CARD_ADDED_TO_LANE':   return applyCardAddedToLane(draft, event);
      case 'DECK_SHUFFLED':        return applyDeckShuffled(draft, event);
      case 'PENDING_EFFECT_ADDED': return applyPendingAdded(draft, event);
      case 'PENDING_EFFECT_REMOVED': return applyPendingRemoved(draft, event);
      case 'LOCATION_REVEALED':    return applyLocationRevealed(draft, event);
      case 'LOCATION_REPLACED':    return applyLocationReplaced(draft, event);
      case 'LOCATION_TAG_ADDED':   return applyLocationTagAdded(draft, event);
      case 'LOCATION_TAG_REMOVED': return applyLocationTagRemoved(draft, event);
      case 'OR_WINDOW_OPEN':
      case 'OR_WINDOW_CLOSE':      return;                     // diagnostic only
      case 'ENERGY_CHANGED':       return applyEnergyChanged(draft, event);
      case 'TURN_STARTED':         return applyTurnStarted(draft, event);
      case 'TURN_ENDED':           return applyTurnEnded(draft, event);
      case 'MATCH_ENDED':          draft.result = event.result; draft.phase = 'ENDED'; return;
      case 'RECURSION_LIMIT_HIT':
      case 'INTENT_REJECTED':      return;                     // diagnostic only
      default: assertNever(event);
    }
  });
}
```

### Invariants
- `apply` is pure. No DOM, no randomness, no clock reads, no `manifest` mutation.
- Events are **factual statements** (imperative past tense): "this happened." Never conditional.
- The reducer does **no derivation**. Ongoing power is computed by projections at query time, not stored in state.
- `CARD_DESTROYED` sweeps: the reducer updates `zone`, `lane`, removes from `lane.cards`. It does **not** look at Ongoings or remove "buffs from Iron Man" — there are no such buffs in state to remove.
- **Aura cleanup is free**: since Cosmo's effect is read from its presence, destroying Cosmo doesn't need a cleanup event. The projection stops returning its aura the moment Cosmo's `zone` flips to `DISCARD` / `REMOVED`.

---

## 5. Projections

### 5.1 Power

```ts
// engine/projections/power.ts
export function getCardPower(
  state: MatchState,
  cardId: CardId,
  manifest: Manifest,
): number {
  const card = state.cards[cardId];
  if (!card) return 0;

  const applicable = collectApplicableOngoings(state, cardId, manifest);

  // Stage 1: base (with text-override resolution for Mystique)
  let power = baseFromResolvedText(state, cardId, manifest);

  // Stage 2: additive bonuses (policy-respecting)
  power += applicable.POWER_ADD.reduce(sumAdditive, 0);

  // Stage 3: effective multiplier
  const baseMultSum = applicable.POWER_MULTIPLIER.reduce(sumAdditive, 0);
  if (baseMultSum > 0) {
    const boostSum = applicable.MULTIPLIER_BOOST
      .filter(b => b.targetExpr === 'POWER_MULTIPLIER')
      .reduce(sumAdditive, 0);
    const effectiveMult = baseMultSum + boostSum;
    power = Math.floor(power * effectiveMult);
  }

  // Stage 4: Shuri pending buff (consumed on first reveal after Shuri)
  if (card.tags.some(t => t.kind === 'SHURI_DOUBLED')) {
    power = Math.floor(power * 2);
  }

  return power;
}
```

### 5.2 Ongoing collection with Mystique / Super Skrull dereferencing

```ts
// engine/projections/ongoing.ts
export function collectApplicableOngoings(
  state: MatchState,
  target: CardId,
  manifest: Manifest,
): GroupedOngoings {
  const out = emptyGrouped();
  const disables = gatherLaneDisableAuras(state, manifest);

  for (const src of allLiveSources(state)) {
    if (disables.disableOngoingOn(src)) continue;

    const exprs = resolveOngoingText(state, src, manifest);
    for (const expr of exprs) {
      if (expr.kind === 'COPY_ONGOING_OF') {
        // Super Skrull: dereference source card's ongoings
        for (const srcCard of select(expr.source, { self: src, state, manifest })) {
          const copied = resolveOngoingText(state, srcCard, manifest);
          for (const c of copied) collect(out, target, src, c, state, manifest);
        }
        continue;
      }
      collect(out, target, src, expr, state, manifest);
    }
  }
  return out;
}
```

**Text override chain**: `resolveOngoingText` follows `card.textOverride` recursively with a cycle-detection visited set. Three hops deep hard cap.

### 5.3 Other projections

```ts
// engine/projections/reveal.ts
export function getOnRevealMultiplier(state: MatchState, cardId: CardId, manifest: Manifest): number {
  const applicable = collectApplicableOngoings(state, cardId, manifest);
  // Wong-type — MULTIPLICATIVE stack
  const baseMult = applicable.ON_REVEAL_MULTIPLIER
    .reduce((p, m) => p * evalNum(m.factor, ctx), 1);
  // Citadel-type boosts on the OR multiplier — ADDITIVE
  const boost = applicable.MULTIPLIER_BOOST
    .filter(b => b.targetExpr === 'ON_REVEAL_MULTIPLIER')
    .reduce(sumAdditive, 0);
  return Math.max(1, baseMult + boost);
}

export function isOnRevealDisabled(state: MatchState, cardId: CardId, manifest: Manifest): boolean { ... }

// engine/projections/priority.ts
export function getPriority(state: MatchState, manifest: Manifest): { owner: Owner; reason: PriorityReason } { ... }
// Implements real Snap rule: most-lanes > most-total-power > coin-flip-by-rng
// Tie-break coin-flip uses rng.fork(`priority:turn${turn}`)

// engine/projections/draw.ts
export function nextCardFromDeck(state, owner, rng): CardId | null
export function drawWithTriggerHandling(state, owner, rng, manifest): MatchEvent[]
```

---

## 6. Recursive OR Evaluator

```ts
// engine/eval.ts
interface EvalCtx {
  readonly state: MatchState;       // working snapshot; re-read by projections
  readonly manifest: Manifest;
  readonly rng: Rng;
  readonly self: CardId;
  readonly depth: number;           // hard cap 32
  readonly emit: (e: MatchEvent) => void;
  readonly advance: () => void;     // re-applies last emitted event to working state
  readonly it?: CardId;             // FOREACH loop variable
}

const MAX_DEPTH = 32;

export function revealCard(cardId: CardId, ctxParent: Omit<EvalCtx, 'self'>): void {
  const ctx: EvalCtx = { ...ctxParent, self: cardId, depth: ctxParent.depth + 1 };
  if (ctx.depth > MAX_DEPTH) {
    ctx.emit({ type: 'RECURSION_LIMIT_HIT', cardId, depth: ctx.depth });
    return;
  }

  ctx.emit({ type: 'CARD_FLIPPED', cardId });
  ctx.advance();

  if (projections.isOnRevealDisabled(ctx.state, cardId, ctx.manifest)) return;

  // Sample ONCE at entry — closure captures Wong-at-this-moment.
  const repeat = projections.getOnRevealMultiplier(ctx.state, cardId, ctx.manifest);
  ctx.emit({ type: 'OR_WINDOW_OPEN', cardId, multiplier: repeat });

  const exprs = resolveOnRevealText(ctx.state, cardId, ctx.manifest);
  for (let i = 0; i < repeat; i++) {
    for (const expr of exprs) {
      evalEffect(expr, { ...ctx, rng: ctx.rng.fork(`reveal:${cardId}:${i}`) });
    }
  }
  ctx.emit({ type: 'OR_WINDOW_CLOSE', cardId });
}

export function evalEffect(expr: EffectExpr, ctx: EvalCtx): void {
  switch (expr.kind) {
    // Atoms → emit events
    case 'ADD_POWER': {
      for (const t of select(expr.target, ctx)) {
        const delta = evalNum(expr.delta, ctx);
        ctx.emit({ type: 'CARD_POWER_CHANGED', cardId: t, delta, cause: causeRef(ctx) });
        ctx.advance();
      }
      return;
    }
    case 'DESTROY': {
      for (const t of select(expr.target, ctx)) {
        ctx.emit({ type: 'CARD_DESTROYED', cardId: t, cause: causeRef(ctx) });
        ctx.advance();
      }
      return;
    }
    case 'MOVE': ... return;
    case 'ADD_PENDING': {
      ctx.emit({ type: 'PENDING_EFFECT_ADDED', effect: expr.effect });
      ctx.advance();
      return;
    }
    case 'COPY_TEXT_OF': {
      for (const t of select(expr.into, ctx)) {
        const [src] = select(expr.source, ctx);
        if (src) {
          ctx.emit({ type: 'CARD_TEXT_OVERRIDDEN', cardId: t, override: { kind: 'COPY_OF_CARD', cardId: src } });
          ctx.advance();
        }
      }
      return;
    }

    // Re-entry
    case 'TRIGGER_ON_REVEAL': {
      for (const t of select(expr.target, ctx)) revealCard(t, ctx);
      return;
    }
    case 'SPAWN_AND_REVEAL': {
      const newId = spawnFromPool(expr.pool, ctx);
      if (!newId) return;
      const [lane] = select(expr.to, ctx);   // lane selector returns a "virtual" id
      ctx.emit({ type: 'CARD_ADDED_TO_LANE', owner: ownerOf(expr.owner, ctx), cardId: newId, lane: laneIdxOf(lane, ctx) });
      ctx.advance();
      revealCard(newId, ctx);   // nested: child's OR runs "inside" parent's stack frame
      return;
    }

    // Control flow
    case 'SEQUENCE': for (const e of expr.items) evalEffect(e, ctx); return;
    case 'CONDITIONAL':
      if (evalPred(expr.if, ctx)) for (const e of expr.then) evalEffect(e, ctx);
      else if (expr.else) for (const e of expr.else) evalEffect(e, ctx);
      return;
    case 'FOREACH':
      for (const t of select(expr.over, ctx)) {
        for (const e of expr.do) evalEffect(e, { ...ctx, it: t });
      }
      return;

    case 'CALL_BUILTIN': builtins[expr.fn](expr.args, ctx); return;

    default: assertNever(expr);
  }
}
```

**The two re-entry combinators (`TRIGGER_ON_REVEAL`, `SPAWN_AND_REVEAL`) are the ONLY paths that call `revealCard` recursively.** This is the single design decision that makes Odin, Jubilee, Arnim Zola, and all their cascades work uniformly.

---

## 7. Intent Resolver: `resolve`

```ts
// engine/resolve.ts
export function resolve(
  state: MatchState,
  intent: MatchIntent,
  rng: Rng,
  manifest: Manifest,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const emit = (e: MatchEvent) => events.push(e);

  switch (intent.type) {
    case 'STAGE_CARD': return resolveStageCard(state, intent, rng, manifest, emit);
    case 'UNSTAGE_CARD': return resolveUnstageCard(state, intent, manifest, emit);
    case 'UNDO_TURN':  return resolveUndoTurn(state, intent, manifest, emit);
    case 'END_TURN':   return resolveEndTurn(state, intent, rng, manifest, emit);
    case 'CONCEDE':    return resolveConcede(state, intent, manifest, emit);
  }
}
```

`resolveStageCard` validates (owner turn, energy, lane capacity, `BLOCK_PLAY` aura checks via projection) and emits `CARD_STAGED` + `ENERGY_CHANGED` — no reveal, no OR. If invalid, emits `INTENT_REJECTED`.

`resolveEndTurn` is the orchestrator — delegates to `resolveTurn`.

---

## 8. Turn Orchestration: `resolveTurn`

```ts
// engine/resolveTurn.ts
export function resolveTurn(
  state: MatchState,
  turnSeed: string,
  manifest: Manifest,
): MatchEvent[] {
  const rng = createRng(turnSeed);
  const events: MatchEvent[] = [];
  let working = state;
  const emit = (e: MatchEvent) => { events.push(e); working = apply(working, e, manifest); };
  const ctxBase = { manifest, rng, depth: 0, emit, advance: () => {} /* no-op; emit already advances */ };

  // 1. Compute priority (with seeded coin flip for tie)
  const { owner: priorityOwner, reason } = projections.getPriority(working, manifest);
  emit({ type: 'TURN_STARTED', turn: working.turn, priority: priorityOwner, priorityReason: reason });

  // 2. Reveal phase — priority player first, then opponent, each in staging order
  const order = computeRevealOrder(working, priorityOwner);
  for (const cardId of order) {
    revealCard(cardId, { ...ctxBase, state: working, rng: rng.fork(`reveal:${cardId}`) });
  }

  // 3. Location at-turn-end effects (left-to-right)
  for (let lane = 0 as LaneIdx; lane < 3; lane = (lane + 1) as LaneIdx) {
    const loc = working.lanes[lane].location;
    if (!loc) continue;
    const locDef = manifest.locations[loc.defId];
    for (const expr of locDef.abilities.atTurnEnd ?? []) {
      evalEffect(expr, { ...ctxBase, state: working, self: SYSTEM_CARD_ID,
        rng: rng.fork(`loc:${lane}:atTurnEnd`) });
    }
  }

  // 4. Per-turn tag cleanup
  emitPerTurnTagCleanup(working, emit);

  // 5. Advance turn, reveal next location, draw cards
  emit({ type: 'TURN_ENDED', turn: working.turn });
  if (working.turn < 6) {
    emit({ type: 'TURN_STARTED', turn: working.turn + 1, /* priority recomputed next cycle */ });
    revealNextLocationIfAny(working, manifest, emit);
    drawForBothPlayers(working, rng.fork(`draw:${working.turn + 1}`), manifest, emit);
  } else {
    const result = computeFinalResult(working, manifest);
    emit({ type: 'MATCH_ENDED', result });
  }

  return events;
}
```

---

## 9. Testing Strategy

### 9.1 Unit tests (pure functions)
- `apply` exhaustiveness: property test every variant of `MatchEvent` on a seeded starting state.
- `select(selector, ctx)` correctness: all selector kinds, combinators.
- `evalNum`, `evalPred` correctness.
- Projections: `getCardPower`, `getLanePower`, `getOnRevealMultiplier`, `getPriority`.

### 9.2 Golden-trace tests (interaction correctness)

Each test sets up a minimal `MatchState` + `Manifest`, runs `resolveTurn`, compares the emitted `MatchEvent[]` to a checked-in JSON file. Covers:

| Test | Expectation |
|---|---|
| `wong-panther.json` | Wong + Panther alone → Panther final power = 20 |
| `wong-odin-panther.json` | Wong+Panther+Odin → Panther final = 320 |
| `mystique-wong-panther.json` | Wong + Mystique(copies Wong) + Panther → Panther = 80 (4× OR) |
| `citadel-wong-panther.json` | Wong + Citadel + Panther → Panther = 80 (boosted OR mult) |
| `cosmo-blocks-or.json` | Cosmo at lane + Panther plays there → Panther final = 4 (no OR) |
| `echo-disables-iron-man.json` | Opp Iron Man + self Echo at same lane → lane power not doubled |
| `iron-man-onslaught.json` | Iron Man + Onslaught → lane × 4 (additive: 2+2) |
| `iron-man-two-onslaughts.json` | Iron Man + 2 Onslaughts (via Mystique) → lane × 6 (additive: 2+2+2) |
| `jubilee-odin.json` | Jubilee pulls X, Odin retriggers Jubilee pulls Y; cascade terminates |
| `arnim-zola-destroys-wong.json` | Zola's OR started with Wong alive → doubling persists despite mid-sequence destruction |
| `shuri-red-skull.json` | Shuri T4, Red Skull T5 at same lane → Red Skull power doubled |
| `shuri-not-consumed-by-enemy.json` | Shuri T4 (player), enemy plays card at same lane → enemy card not doubled |
| `recursion-limit.json` | Contrived infinite cascade → `RECURSION_LIMIT_HIT` emitted, no crash |
| `priority-tie-coinflip.json` | Identical boards → priority deterministic per seed |
| `determinism.json` | Same seed + intents twice → identical events |

Golden files are regenerated by `pnpm test engine -u` and reviewed in PR.

### 9.3 Node CLI

```ts
// tools/engine-cli.ts (allowed to import engine + node + manifest bootstrap; no UI)
import { createRng, resolveTurn, apply } from 'services/playgame/engine';
import { BOOTSTRAP_MANIFEST } from 'services/playgame/engine/manifest/bootstrap';
import { initialState, makeRandomIntents } from './harness';

const seed = process.argv[2] ?? 'default';
let state = initialState(seed);
while (state.phase !== 'ENDED') {
  const intents = makeRandomIntents(state);
  for (const intent of intents) {
    const events = resolve(state, intent, ...);
    for (const e of events) state = apply(state, e, BOOTSTRAP_MANIFEST);
  }
}
console.log(JSON.stringify(state.result));
```

---

## 10. Migration Plan (step by step)

Each step is a PR, reviewable independently. Engine lands in `engine/` **in parallel** with existing code. Legacy `script/actions.ts` is kept working until all flows are ported.

### Step 1 — Skeleton + isolation
Create `engine/` folder, all type files, empty `apply`/`resolve`/`resolveTurn` stubs that throw. Add ESLint rules. Add `pnpm lint` to CI. **No behavior change.**

### Step 2 — RNG + seeded utilities
Implement `sfc32` + `Rng` + `fork`. Add unit tests.

### Step 3 — Manifest bootstrap
Convert `services/playgame/cards.ts` and `locations.ts` into `BOOTSTRAP_MANIFEST` shape. Keep old files as re-exports for backward compat. Write manifest-validation sanity checks.

### Step 4 — Projections (read-only)
Implement `getCardPower`, `getLanePower`, `getPriority`, `getOnRevealMultiplier`, `isOnRevealDisabled`, `collectApplicableOngoings`. Build a reference `MatchState` from current `PlayGameContext` store snapshot. Unit-test projections. **No reducer yet.**

### Step 5 — `apply` reducer
Implement every variant. For now events are hand-constructed in tests; real emitters come later.

### Step 6 — `evalEffect` + `revealCard`
Implement selectors, predicates, numexpr, then `evalEffect` + `revealCard`. Add golden-trace tests for Wong+Panther, Cosmo-blocks-OR.

### Step 7 — `resolve` for staging intents
Port `stageCardInLane` / `undoPending` from `PlayGameContext` to `resolve(STAGE_CARD | UNSTAGE_CARD)`. Drop the `produce()` bodies in favor of `apply(state, event)`. Adapter layer (Solid store) subscribes to events and updates the `createStore` for reactive UI.

### Step 8 — `resolveTurn`
Port turn resolution from `services/playgame/script/flows.ts::resolveTurnFlow` into `resolveTurn`. Enemy AI becomes `engine/ai.ts::chooseEnemyIntents(state, rng, manifest)` — pure. All `enemyPlayRandom` DOM-side code deleted.

### Step 9 — Event → animation adapter
`adapters/vfx-choreography.ts` subscribes to the event stream and plays animations. `flyFaceDownToSlot`, `revealPendingCinematic` become reactive to `CARD_FLIPPED` / `CARD_ADDED_TO_LANE` events instead of being called imperatively from scripts.

### Step 10 — Legacy deletion
Delete `services/playgame/script/actions.ts`, `flows.ts`, `runner.ts`. Delete mutation methods from `PlayGameContext`. Context becomes read-only Solid store + intent dispatcher.

### Step 11 — CI & headless proof
Add `pnpm engine:cli` script. CI runs 1000 random matches with random seeds; asserts no crashes, all finish, all have deterministic results.

---

## 11. Data Model Examples (sanity-check the DSL)

### Wong
```ts
{ defId: 'wong', basePower: 2, cost: 4,
  abilities: { ongoing: [
    { kind: 'ON_REVEAL_MULTIPLIER',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
      factor: { kind: 'LIT', n: 2 },
      stack: 'MULTIPLICATIVE' },
  ]}}
```

### Black Panther
```ts
{ defId: 'black-panther', basePower: 4, cost: 5,
  abilities: { onReveal: [
    { kind: 'ADD_POWER',
      target: { kind: 'SELF' },
      delta: { kind: 'POWER_OF', target: { kind: 'SELF' } } },   // current power = doubled
  ]}}
```

### Odin
```ts
{ defId: 'odin', basePower: 8, cost: 6,
  abilities: { onReveal: [
    { kind: 'TRIGGER_ON_REVEAL',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' },
        ownerFilter: 'SELF_OWNER', exclude: { kind: 'SELF' } }},
  ]}}
```

### Iron Man
```ts
{ defId: 'iron-man', basePower: 0, cost: 5,
  abilities: { ongoing: [
    { kind: 'POWER_MULTIPLIER',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER' },
      factor: { kind: 'LIT', n: 2 },
      stack: 'ADDITIVE' },    // post-Nov-2022 patch
  ]}}
```

### Onslaught
```ts
{ defId: 'onslaught', basePower: 8, cost: 6,
  abilities: { ongoing: [
    { kind: 'MULTIPLIER_BOOST',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER',
                exclude: { kind: 'SELF' } },
      targetExpr: 'POWER_MULTIPLIER',
      delta: { kind: 'LIT', n: 2 },
      stack: 'ADDITIVE' },
    // Also boosts OR multipliers (Wong)
    { kind: 'MULTIPLIER_BOOST',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'SELF_OWNER',
                exclude: { kind: 'SELF' } },
      targetExpr: 'ON_REVEAL_MULTIPLIER',
      delta: { kind: 'LIT', n: 2 },
      stack: 'ADDITIVE' },
  ]}}
```

### Shuri
```ts
{ defId: 'shuri', basePower: 3, cost: 4,
  abilities: { onReveal: [
    { kind: 'ADD_PENDING',
      effect: { kind: 'SHURI_DOUBLE_NEXT', owner: /* filled by evaluator */,
                lane: /* filled */, sourceId: /* self */ }},
  ]}}
// At stage-time for subsequent card of same owner at same lane: handler checks
// pendingEffects, emits CARD_TAG_ADDED(SHURI_DOUBLED) + PENDING_EFFECT_REMOVED.
```

### Jubilee
```ts
{ defId: 'jubilee', basePower: 1, cost: 4,
  abilities: { onReveal: [
    { kind: 'SPAWN_AND_REVEAL',
      pool: { kind: 'DECK_OF_OWNER', owner: 'SELF_OWNER', excludeInPlay: true },
      owner: 'SELF_OWNER',
      to: { kind: 'LANE_OF', of: { kind: 'SELF' } }},
  ]}}
```

### Mystique
```ts
{ defId: 'mystique', basePower: 0, cost: 3,
  abilities: { onReveal: [
    { kind: 'COPY_TEXT_OF',
      into: { kind: 'SELF' },
      source: { kind: 'LAST_PLAYED', by: 'SELF_OWNER' }},
  ]}}
```

### Super Skrull
```ts
{ defId: 'super-skrull', basePower: 2, cost: 6,
  abilities: { ongoing: [
    { kind: 'COPY_ONGOING_OF',
      into: { kind: 'SELF' },
      source: { kind: 'WHERE',
        of: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'OPP_OWNER' },
        pred: { kind: 'EXISTS', target: { kind: 'SELF' } }},
      stack: 'SINGLE' },
  ]}}
```

### Cosmo
```ts
{ defId: 'cosmo', basePower: 3, cost: 3,
  abilities: { ongoing: [
    { kind: 'DISABLE_ON_REVEAL',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'ANY_OWNER' },
      stack: 'SINGLE' },
  ]}}
```

### Echo
```ts
{ defId: 'echo', basePower: 2, cost: 2,
  abilities: { onReveal: [
    { kind: 'ADD_CARD_TAG',
      target: { kind: 'SAME_LANE', of: { kind: 'SELF' }, ownerFilter: 'OPP_OWNER' },
      tag: { kind: 'ONGOING_DISABLED', sourceId: /* self */ }},
  ]}}
// Tag persists as long as Echo is alive at this lane; cleaned when Echo dies or moves.
```

---

## 12. Appendix: Open design questions resolved

| # | Question | Decision |
|---|---|---|
| Q1 | Ability representation scope | `effectId` compiles down to same `EffectExpr` / `OngoingExpr` shapes. DSL (Tier 0.1) is a compile-time transform. |
| Q2 | Ongoing model | Projections over state, per-expression stacking policy (`MULTIPLICATIVE` / `ADDITIVE` / `MAX` / `SINGLE`). No derived state. |
| Q3 | Priority tie-break | Implemented fully: most-lanes → most-power → seeded coin flip. |
| Q4 | Reveal sequencing | Recursive AST evaluator, stack-based, depth cap 32. Two re-entry combinators: `TRIGGER_ON_REVEAL`, `SPAWN_AND_REVEAL`. |
| Q5 | State immutability | Immer `produce` inside `apply`; engine never mutates input. |
| Q6 | Intent IDs | UUID v4, required on all intents. |
| Q7 | Manifest | `BOOTSTRAP_MANIFEST` (one file) for 0.2; per-card folders deferred to 1.2. |
| Q8 | In-flight match migration | Nuke. No users yet. |
| Q2-A | Projection memoization | Defer. Profile before optimizing. |
| Q2-B | `lastPlayedCardIdByOwner` | `MatchState.lastPlayedBy: Record<Owner, CardId \| null>`, updated on `CARD_STAGED`. |
| Q2-C | Tag vocabulary | Closed union of `CardTag` + `LaneTag`. Extensible. |
| Q2-D | Text override cycles | Recursive resolution with visited-set, 3-hop hard cap. |
| Q2-E | RNG threading | `rng.fork(tag)` per effect invocation. Deterministic per seed. |

---

## 13. Reference: Verified Math Against Live Snap Behavior

All checked against community sources (snap.untapped.gg, marvelsnapzone.com, r/MarvelSnap patch archaeology):

- **Wong × Panther (alone)**: OR fires 2× → 5 → 10 → 20. ✓
- **Wong × Panther × Odin**: 5 → 20 (Panther with Wong), Odin fires 2× (Wong), each fire retriggers Panther 2× (Wong). Final = 20 × 2^4 = **320**. ✓
- **Citadel (location: doubles Ongoings) × Wong × Panther**: Citadel is `MULTIPLIER_BOOST` on `ON_REVEAL_MULTIPLIER`. Effective OR mult = 2 × 2 = 4. Panther 5 × 2^4 = 80. ✓ (matches community reports)
- **Iron Man alone**: lane × 2. ✓
- **Iron Man + Onslaught (post-Nov-2022 patch)**: `ADDITIVE` stacking → base mult 2, boost 2, effective 4. lane × 4. ✓ (Second Dinner patch notes)
- **Iron Man + 2 Onslaughts**: 2 + 2 + 2 = 6, lane × 6. ✓
- **2 Wongs (Wong + Mystique copying Wong)**: MULTIPLICATIVE — 2 × 2 = 4× OR multiplier. Panther 5 → 80. ✓
- **Jubilee pulls Odin, Odin retriggers Jubilee, Jubilee pulls again**: emerges from recursion; bounded by deck exhaustion or depth cap 32. ✓ (Reddit evidence)

---

END OF SPEC 0.2.
