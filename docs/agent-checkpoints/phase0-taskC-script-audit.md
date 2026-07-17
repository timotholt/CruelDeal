# Phase 0 Task C — Script Authority, Event Vocabulary, and Staging Order Audit

Status: analysis only. This checkpoint makes no implementation change.

## Decisions

1. Every script path that creates, selects, suppresses, or applies a `MatchEvent`, and every script path that writes `MatchState.phase`, is engine/runtime intent. Its DOM work and waits are presentation pacing and must be split from that intent.
2. The existing vocabulary reconstructs opening draws, ordinary location reveal, card reveal/effect cascades, turn bookkeeping, and match end from genesis plus the ordered events. It does **not** reconstruct entry into `RESOLVING`, which is currently a direct script write. Add `TURN_RESOLUTION_STARTED { turn }` and have its reducer case set `phase: 'RESOLVING'`.
3. Ordinary opening location reveal needs no new reveal event. `LOCATION_REVEALED` is sufficient when the runtime emits it together with the location's effect cascade. The missing object is an engine/runtime opening transaction builder, not a second reveal schema.
4. The broader supported location vocabulary has one additional fold defect: `LOCATION_REPLACED` must carry `newDefId` (and the reducer must use it). Today replay constructs a location with `defId: ''`.
5. Choose **deterministic canonical merge at lock**, not serialized cross-seat staging order. Preserve each seat's final private order, merge priority owner first, and only then fold `resolveStage` over the merged list. `resolveStage` fires `onCardEnteredHere` immediately, so committing stages in arrival order would let queue/network timing choose gameplay effects and would make private revision non-invertible.

## Scope and classification rule

The audited source is exactly:

- `services/playgame/script/actions.ts`
- `services/playgame/script/flows.ts`
- `services/playgame/script/runner.ts`

“Authoritative” means a change to canonical `MatchState`, its event log, or the ordered engine transaction that produces that state. UI sidecar writes, DOM styles, toasts, sounds, and elapsed time are presentation. `animateEvent` is authoritative despite its name: it calls `ctx.dispatch(event)` both with and without card transfers (`services/playgame/presentation/eventAnimator.ts:349-364`, `services/playgame/presentation/eventAnimator.ts:375-380`).

The engine contract supports this distinction. `resolve` translates intents to events (`services/playgame/engine/resolve.ts:36-48`), `apply` folds every event and appends it to the log (`services/playgame/engine/apply.ts:35-41`), while the script runner says steps complete when their visible effect completes (`services/playgame/script/runner.ts:1-13`). The current defect is that those two contracts are nested inside each other.

## Complete script-action origin audit

### Authoritative actions and helpers

| Script step/helper | File:line evidence | Authoritative behavior | Disposition |
|---|---|---|---|
| `dispatchEventWithPresentation` | `services/playgame/script/actions.ts:95-97`; dispatch occurs in `services/playgame/presentation/eventAnimator.ts:349-364,375-380` | Applies an arbitrary engine event while awaiting its choreography. | Event application is engine/runtime intent. `animateEvent` must become a read-only frame consumer; its VFX/SFX/waits remain presentation pacing. |
| `drawFromDeck` | `services/playgame/script/actions.ts:152-183` | Originates `CARD_ADDED_TO_HAND` for the override path or `CARD_DRAWN` for the real deck path. The override also consumes `drawQueue` and mints a nondeterministic ID through `newEngineCardInstance` (`services/playgame/view.ts:255-280`; `utils/id.ts:104-109`). | Hand-cap/deck checks, identity/provenance, and draw/add events are engine/runtime intent. Hand-slot reservation and deck-slide timing are presentation. Remove the live authority path from script; test fixtures should build deterministic genesis or submit an explicit engine-created-card operation. |
| `dealPlayerCard` | `services/playgame/script/actions.ts:190-208` | Originates `CARD_ADDED_TO_HAND` when given a def; otherwise delegates to `drawFromDeck`. | Engine/runtime opening intent. The deal animation is presentation pacing. In the shared opening path, bootstrap cards use `CARD_DRAWN`; `CARD_ADDED_TO_HAND` is reserved for genuine creation. |
| `engineLocationRevealSlice` | `services/playgame/script/actions.ts:212-228` | Does not itself dispatch, but selects the authoritative suffix following a matching `LOCATION_REVEALED`. Its correctness assumes reveal is the final `resolveTurn` phase. | Transaction ownership belongs to engine/runtime. Presentation may group already-built frames, but must not infer transaction slices by scanning event variants. |
| `dispatchLocalLocationRevealEffects` | `services/playgame/script/actions.ts:230-260` | Reads live canonical state, evaluates each manifest location `onReveal` effect with gameplay RNG, and dispatches every resulting event. | Entire evaluation/event production is engine/runtime intent. Per-event animation is presentation. This fallback must disappear from script. |
| `dispatchLocationRevealEffects` | `services/playgame/script/actions.ts:262-276` | Either redispatches a retained engine suffix or locally originates a replacement cascade. | Engine/runtime transaction selection/application. Presentation may pace the committed reveal frames only. |
| `revealLocation` | `services/playgame/script/actions.ts:282-333` | Directly constructs and dispatches `LOCATION_REVEALED`, then runs the effect dispatcher (`:309-314`) between DOM waits/styles (`:284-307,316-332`). | The reveal and effects are one engine/runtime transaction. Blur, flip, opacity, and waits are presentation pacing around its frames. |
| `revealNextLocation` | `services/playgame/script/actions.ts:335-340` | Selects the first unrevealed canonical lane and invokes the authoritative reveal action. | Which location reveals and whether it can reveal are engine/runtime intent. Choosing/playing the matching cinematic is presentation. |
| `captureEngineEndTurn` | `services/playgame/script/actions.ts:369-380` | Calls `resolveTurn`, originates the complete turn event stream, and retains both events and final state without committing either. | Pure engine/runtime intent. The runtime must resolve and commit the complete transaction before publishing frames; script must not retain `_engineEvents` or `_engineFinalState`. |
| `dispatchPerRevealEvent` | `services/playgame/script/actions.ts:393-395` | Applies an event from the retained authoritative stream. | Engine/runtime application; its choreography is presentation. |
| `revealByPriorityFromEngine` | `services/playgame/script/actions.ts:414-465` | Scans the transaction, sets the consumption boundary, reconstructs and dispatches each `CARD_FLIPPED`, and dispatches inferred between-flip slices from a VFX callback. Early returns occur after the boundary is advanced (`:431-441`). | All event selection/application is engine/runtime responsibility and must be removed from presentation. The cinematic may consume the already-committed ordered `CARD_FLIPPED` frames and their following frames. |
| `advanceTurnFromEngine` | `services/playgame/script/actions.ts:486-520` | Resumes at `_revealsConsumedUpTo`, suppresses script-owned variants, stops at `LOCATION_REVEALED`, and dispatches the remaining authoritative events (`:491-506`). | Event iteration/suppression/application is engine/runtime responsibility. Resetting `ui.isFlipped`, result prompt state, toast, and wait (`:508-519`) are presentation derived from frames/state. |
| `autoPlayRemoteSeat` | `services/playgame/script/actions.ts:534-592` | Plans from the full manifest pool, mints a nondeterministic card, and directly dispatches `CARD_ADDED_TO_HAND`, `CARD_STAGED`, and `ENERGY_CHANGED` (`:537-570`). It bypasses `resolveStage`, so it also bypasses stage legality and `onCardEnteredHere`. | AI planning and submitted stage intents are engine/runtime intent. The face-down fly-in (`:572-590`) is presentation. Replace pool minting with hand-based intents through the common runtime queue. |
| `drawHandCard` | `services/playgame/script/actions.ts:597-601` | Performs an authoritative hand-cap check and delegates to `drawFromDeck`. | Engine/runtime draw intent; presentation consumes the resulting draw frame. |
| `startResolving` | `services/playgame/script/actions.ts:603-608` | Directly writes canonical `phase = 'RESOLVING'`. `PlayBoard` implements `setPhase` as `setEngineState('phase', phase)` (`components/screens/play/PlayBoard.tsx:213-215`). | Engine/runtime phase transition. Replace with `TURN_RESOLUTION_STARTED`; do not retain a script setter. |
| `finishResolving` | `services/playgame/script/actions.ts:610-615` | Directly writes canonical `phase = 'AWAITING_INTENT'`. | Engine/runtime phase transition, but the action should be deleted rather than translated one-for-one: `TURN_STARTED` already sets `AWAITING_INTENT` (`services/playgame/engine/apply.ts:478-486`), while `MATCH_ENDED` must remain `ENDED` (`services/playgame/engine/apply.ts:511-520`). The current unconditional write can overwrite terminal phase. |

### Composite flows

| Flow | File:line evidence | Disposition |
|---|---|---|
| `openingSequence` | `services/playgame/script/flows.ts:41-85`; four `dealPlayerCard` calls at `:65-80`; `revealNextLocation` at `:83-84` | Split it. Opening draws and first-location reveal/effects are a runtime-owned opening transaction or ordered transactions. Board visibility, tile fades, banners, and waits remain a presentation-only opening storyboard. |
| `resolveTurnFlow` | `services/playgame/script/flows.ts:102-123`; phase writes, remote staging, resolution capture, partial dispatch, turn advance, and location reveal are all sequenced here | Remove gameplay orchestration from the flow. Runtime owns lock, canonical stage merge, resolution, complete commit, and frame publication. The flow's face-down beat, fly-ins, reveal cinematic, banners, and waits become director choreography over committed frames. |

### Negative inventory: presentation-only script controls

The following steps do not originate events or mutate authoritative `MatchState`:

- `setBoardVisible`, `toast`, `hideLocationTiles`, and `fadeInLocationTile` manipulate DOM/toast state and time only (`services/playgame/script/actions.ts:101-139`).
- `flipPlayerCardsFaceDown` writes `ui.isFlipped`, not a card's canonical `revealed` field (`services/playgame/script/actions.ts:344-359`). It is a viewer-relative presentation beat derived from the resolution boundary.
- `wait`, `serial`, `parallel`, `label`, `run`, and `createScript` contain no engine event or `MatchState` write (`services/playgame/script/runner.ts:25-72`). `cancel` only sets `ctx.cancelled` (`:65-71`).

The runner is nevertheless part of the causal failure: `serial` stops when `ctx.cancelled` and otherwise waits for each visible step (`services/playgame/script/runner.ts:29-33`). It may cancel presentation, but after the refactor it must be structurally incapable of cancelling, delaying, or partially applying a runtime transaction.

## Event-vocabulary sufficiency proof

### Proof standard

The reconstruction input is:

1. canonical genesis `MatchState`, including shuffled decks and the three assigned but unrevealed location instances (`services/playgame/engine/cli/initState.ts:131-176`);
2. the manifest version used by that genesis; and
3. the complete ordered `MatchEvent[]`.

For every row below, folding `apply` from genesis must reproduce the canonical after-state, while observational events may additionally tell presentation how to narrate a state-neutral semantic window. Exact reconstruction does not require animation duration, DOM geometry, opacity, toast text, or sound in the event schema.

### Opening transitions

| Gameplay-visible transition | Reconstructing event(s) | Proof and disposition |
|---|---|---|
| A bootstrap card leaves a seat's deck and enters its opening hand | `CARD_DRAWN` | The event identifies owner/card (`services/playgame/engine/types/events.ts:66-83`); the reducer removes that card from deck, changes its zone, and adds it to hand (`services/playgame/engine/apply.ts:283-295`). Emit `startingHandSize` draws for **both** seats through the shared opening builder. Hidden-seat projection may expose only the opponent hand count/card back. |
| An effect genuinely creates a new opening-time card in hand | `CARD_ADDED_TO_HAND` | It carries owner, new card ID, definition, and provenance (`services/playgame/engine/types/events.ts:71-73`), and the reducer mints then inserts it (`services/playgame/engine/apply.ts:322-328`). This is sufficient for real creation, but current `drawQueue`/`dealPlayerCard(def)` misuse it as a deck draw. |
| First location changes from hidden to revealed | `LOCATION_REVEALED` | Genesis already contains stable `id`, `defId`, lane, and `locationRevealed: false` (`services/playgame/engine/cli/initState.ts:142-148`). The event names lane and exact location ID (`services/playgame/engine/types/events.ts:89-100`); the reducer validates that ID and sets the flag (`services/playgame/engine/apply.ts:394-400`). This is sufficient for the semantic reveal. |
| The revealed location's Ongoing rules begin affecting projected power/cost/play legality | Derived from the `LOCATION_REVEALED` after-state plus manifest | Ongoing location sources are exactly locations whose lane has `locationRevealed: true` (`services/playgame/engine/projections/context.ts:116-122`). No permanent delta event should be synthesized for a live projection; replaying the reveal flag reconstructs the same derived values. |
| First-location `onReveal` changes cards, hands, energy, lanes, tags, counters, or pending effects | The ordered effect events immediately after `LOCATION_REVEALED` | The engine already evaluates location effects against the post-reveal state and threads each result (`services/playgame/engine/resolve.ts:556-573`). The opening builder must use the same helper/logic instead of the script fallback. Individual event families are enumerated below. |
| Turn-1 number, initial energy, and initial priority become visible | Genesis fields; no transition event required | Genesis is already turn 1, `AWAITING_INTENT`, with deterministic priority and energy (`services/playgame/engine/cli/initState.ts:150-176`). The `TURN 1` banner is presentation derived from genesis, not a second canonical mutation. |

Black-board state, the `CRUEL DEAL` banner, left-to-right `???` tile fades, card-flight duration, and the location flip timing are presentation-only beats (`services/playgame/script/flows.ts:43-63,75-84`). They need choreography metadata, not gameplay events.

### Staging and turn-resolution transitions

| Gameplay-visible transition | Reconstructing event(s) | Proof and disposition |
|---|---|---|
| Final locked card moves hand → lane, is face-down canonically, gains `PLAYED_THIS_TURN`, and enters stage order | `CARD_STAGED` | Payload is complete (`services/playgame/engine/types/events.ts:33-45`); reducer performs all listed changes and appends order (`services/playgame/engine/apply.ts:48-63`). Before lock, private draft presentation is runtime staging state, not a public canonical card transition. |
| Staging spends energy | `ENERGY_CHANGED(reason: 'CARD_PLAYED')` | `resolveStage` emits it after `CARD_STAGED` (`services/playgame/engine/resolve.ts:80-100`); reducer updates energy and its log (`services/playgame/engine/apply.ts:82-98`). |
| A revealed location reacts when the staged card enters | Effect events following that stage pair | `resolveStage` calls `fireLocationTrigger('onCardEnteredHere')` against the already-staged/spent state (`services/playgame/engine/resolve.ts:101-111`). The trigger only fires for a revealed location and threads its effects (`services/playgame/engine/effects/evaluator.ts:91-129`). |
| A private staged choice is revised before lock | Runtime draft operation; no committed `MatchEvent` yet under the selected semantics | This is deliberately outside the canonical fold until lock. Once committed, arbitrary entry-trigger effects have no general inverse. Existing `CARD_UNSTAGED` + refund reconstruct a simple lane → hand reversal (`services/playgame/engine/apply.ts:66-79`), but not reversal of an already-fired entry cascade. |
| Both seats become ready | Typed runtime lock results/status, not a gameplay event | `END_TURN` is currently an intent, not an event (`services/playgame/engine/types/intents.ts:11-16`). Per-seat readiness is queue/session coordination. It may be projected as “waiting for opponent,” but it should not pollute replay with wall-clock/arrival information. |
| Canonical match becomes non-interactive and resolution begins | **Missing: add `TURN_RESOLUTION_STARTED { turn }`** | Current script directly writes `RESOLVING` (`services/playgame/script/actions.ts:603-608`), but the turn-flow event vocabulary contains only `TURN_STARTED`, `TURN_ENDED`, and `MATCH_ENDED` (`services/playgame/engine/types/events.ts:102-105`). This is the flow-blocking vocabulary gap. |
| Owner's locally-previewed staged cards turn face-down at lock | Derived presentation from the resolution-start frame plus viewer seat | Canonically `CARD_STAGED` already set `revealed: false`; the owner-only face-up display is a UI override (`services/playgame/script/actions.ts:344-359`). No card mutation event is needed. |
| Cards reveal in priority-owner-first, per-seat stage order | Ordered `CARD_FLIPPED` events | `resolveTurn` filters `stagingOrder` by priority owner then opponent (`services/playgame/engine/resolve.ts:209-220`); `CARD_FLIPPED` sets `revealed: true` (`services/playgame/engine/apply.ts:116-124`). Event order reconstructs narrative order without presentation scanning. |
| A revealed card's Ongoing rules begin affecting projected power/cost/legality | Derived from the `CARD_FLIPPED` after-state plus manifest | Ongoing card sources must be revealed cards in a lane (`services/playgame/engine/projections/context.ts:103-113`). The visible projected change is exactly reconstructible without inventing `CARD_POWER_CHANGED`/`CARD_COST_CHANGED` events for derived modifiers. |
| An On Reveal window opens/closes, including multiplier | `OR_WINDOW_OPEN`, effect events, `OR_WINDOW_CLOSE` | The evaluator emits the brackets and threads every effect between them (`services/playgame/engine/effects/evaluator.ts:294-327`). The reducer intentionally treats brackets as observational (`services/playgame/engine/apply.ts:121-124`), which is sufficient for presentation semantics. |
| No card flips, a reveal is delayed, or a card has no On Reveal effect | Zero `CARD_FLIPPED` for delayed cards, or `CARD_FLIPPED` without an OR window for ordinary/suppressed cards; all other emitted events remain in order | Delay can return no reveal events (`services/playgame/engine/effects/evaluator.ts:239-244`); suppressed/no-ability paths still emit the flip and any allowed downstream trigger/cleanup (`:246-283`). Completeness comes from committing the whole transaction, not from requiring a flip sentinel. |
| End-of-turn card/location/scheduled effects occur | Their concrete ordered effect events | `resolveTurn` runs card EOT, location EOT, scheduled effects, and power-gain draws before cleanup (`services/playgame/engine/resolve.ts:223-339`). No generic “effect happened” state event is needed because each concrete mutation is recorded. |
| Turn closes, transient tags and stage order clear, phase becomes `BETWEEN_TURNS` | `TURN_ENDED` | Reducer behavior is explicit (`services/playgame/engine/apply.ts:488-509`). This also reconstructs no-card turns because the event does not depend on a flip. |
| Match reaches its terminal result | `MATCH_ENDED` | After final EOT cleanup/delayed reveals, engine emits the complete result (`services/playgame/engine/resolve.ts:341-363`); reducer sets result and `phase: 'ENDED'` (`services/playgame/engine/apply.ts:511-520`). End prompt/locked-result UI is derived presentation. |
| Next-turn max energy ramps, current energy refills, and one-shot bonus is consumed | `MAX_ENERGY_CHANGED`, `ENERGY_CHANGED`, `NEXT_TURN_ENERGY_BONUS_CHANGED` | Engine emits them in a specified per-owner order (`services/playgame/engine/resolve.ts:385-425`); corresponding reducer cases reconstruct all pools (`services/playgame/engine/apply.ts:82-114`). |
| Turn number and priority change and interaction reopens | `TURN_STARTED` | Payload contains new turn, priority, and reason (`services/playgame/engine/types/events.ts:102-105`); reducer sets turn/priority and `AWAITING_INTENT` (`services/playgame/engine/apply.ts:478-486`). A `TURN N` toast is derived presentation. |
| Start-of-turn scheduled, card, and location effects occur | Their concrete ordered effect events | Engine runs these after `TURN_STARTED` and before normal draw (`services/playgame/engine/resolve.ts:439-528`). |
| Each eligible seat draws for the new turn and hand-entry reactions occur | `CARD_DRAWN` followed by concrete hand-entry effect events | Engine emits one per eligible owner, then appends debuff events (`services/playgame/engine/resolve.ts:530-540`). |
| Location for turns 2 or 3 reveals and its effects occur | `LOCATION_REVEALED` followed by concrete location-effect events | Engine emits and applies the reveal, then evaluates its `onReveal` list as the final turn phase (`services/playgame/engine/resolve.ts:542-577`). |

### Concrete effect-transition alphabet

The ordered events are sufficient to reconstruct the effect-driven board changes that opening/turn evaluation can expose:

- card stats/text/metadata: `CARD_POWER_CHANGED`, `CARD_COST_CHANGED`, `CARD_TRANSFORMED`, `CARD_TAG_ADDED`, `CARD_TAG_REMOVED`, `CARD_TEXT_OVERRIDDEN`, `CARD_COUNTER_CHANGED` (`services/playgame/engine/types/events.ts:52-64`);
- card-zone movement/removal/creation: `CARD_DESTROYED`, `CARD_DISCARDED`, `CARD_BANISHED`, `CARD_MOVED`, `CARD_RETURNED_TO_LANE`, `CARD_DRAWN`, `CARD_ADDED_TO_DECK`, `CARD_ADDED_TO_HAND`, `CARD_ADDED_TO_LANE`, `CARD_MOVED_TO_ZONE`, `DECK_SHUFFLED` (`services/playgame/engine/types/events.ts:55-83`);
- scheduled state: `PENDING_EFFECT_ADDED`, `PENDING_EFFECT_REMOVED` (`services/playgame/engine/types/events.ts:85-87`);
- location removal/movement/tags/counters: `LOCATION_DESTROYED`, `LOCATION_SHIFTED`, `LOCATION_TAG_ADDED`, `LOCATION_TAG_REMOVED`, `LOCATION_COUNTER_CHANGED` (`services/playgame/engine/types/events.ts:89-100`);
- energy and turn/result state: the energy and turn-flow variants already mapped above (`services/playgame/engine/types/events.ts:33-45,102-105`).

`INTENT_REJECTED` and `RECURSION_LIMIT_HIT` are diagnostic variants (`services/playgame/engine/types/events.ts:107-109`). Per the target runtime contract, local rejection should become a typed result rather than a committed gameplay frame; recursion diagnostics may remain in deterministic transactions.

### Location reveal, in depth

There are currently two semantic implementations hidden behind one cinematic:

1. **Opening:** `_engineEvents` is absent, so `revealLocation` dispatches a newly constructed `LOCATION_REVEALED` and `dispatchLocalLocationRevealEffects` evaluates gameplay locally (`services/playgame/script/actions.ts:230-260,309-314`).
2. **Turns 2–3:** `resolveTurn` already emitted `LOCATION_REVEALED` and all effects last (`services/playgame/engine/resolve.ts:542-577`). `advanceTurnFromEngine` stops before that event (`services/playgame/script/actions.ts:501-505`); `revealLocation` dispatches an equivalent newly constructed reveal; then `engineLocationRevealSlice` finds the retained original and treats every later event as its effect slice (`services/playgame/script/actions.ts:212-228,262-275`).

The second path works only because location reveal is currently last. It has no explicit end boundary, so adding any post-location bookkeeping would cause that bookkeeping to be misclassified as a location effect. The first path can use a different RNG parent and cannot be replayed as an engine-produced opening transaction. Both are authority defects; neither proves a missing `LOCATION_REVEALED` payload.

The correct opening/turn contract is:

```text
before frame: lane has { id, defId, locationRevealed: false }
LOCATION_REVEALED(lane, id)
zero or more ordered onReveal effect events
after frames: lane is revealed and every effect is folded
```

Presentation may hold its cursor on the `before` frame during map fade/blur, advance to the reveal frame at the tile flip, and then animate effect frames. It never re-evaluates the location or slices the transaction.

Hidden-location presentation is a projection concern, not an event gap. Current `ResolvedLocation` deliberately exposes `mapArt` before reveal (`services/playgame/view.ts:85-101`), and `PlayBoard` uses the assigned location's map art immediately (`components/screens/play/PlayBoard.tsx:182-191`). A seat projection must mask name, definition-derived art, and rules until the `LOCATION_REVEALED` frame; genesis plus the reveal event still reconstruct canonical truth.

One supported location mutation is not currently fold-complete. `REPLACE_LOCATION` knows `effect.newDefId`, but emits `LOCATION_REPLACED` without it (`services/playgame/engine/effects/evaluator.ts:941-958`). The event type likewise omits it (`services/playgame/engine/types/events.ts:90-91`), and `apply` writes `defId: ''` (`services/playgame/engine/apply.ts:402-410`). Required schema extension:

```ts
{ type: 'LOCATION_REPLACED'; lane: LaneIdx; oldId: LocationId;
  newId: LocationId; newDefId: string; cause: EffectRef }
```

That extension is required for an exhaustive event-vocabulary claim even though no currently enabled location `onReveal` uses `REPLACE_LOCATION`. Ordinary opening reveal remains sufficient with the existing `LOCATION_REVEALED` variant.

## Staging-order semantics decision

### Option A — deterministic canonical merge at lock

Each seat owns a private, revisable draft list for the turn. At the system reveal boundary:

```text
seatOrder = [priorityOwner, otherOwner]
merged = finalDraft[priorityOwner] ++ finalDraft[otherOwner]
```

Within each seat, preserve the player's final order. Removing a draft removes it; removing and restaging it puts it at the tail. Fold the merged `STAGE_CARD` intents one by one through `resolveStage` on a temporary authoritative state, including each `CARD_STAGED`, energy event, and `onCardEnteredHere` cascade. If any final draft is illegal in that canonical fold, reject the lock transaction atomically and return the affected seat to editable draft state; never commit a partial merge. Once the fold succeeds, append `TURN_RESOLUTION_STARTED` and the `resolveTurn` cascade as the complete system-owned resolution transaction.

Why priority first: `resolveTurn` already reveals priority owner's cards first and preserves that owner's staging order (`services/playgame/engine/resolve.ts:209-220`). Using the same fixed seat order for lock-time entry triggers gives one explainable semantic rule and removes local-seat, AI scheduling, queue arrival, and network timing from outcomes.

### Option B — serialized staging order

Every accepted stage would immediately run `resolveStage` against canonical state in FIFO dequeue order, with each seat's cards hidden by projection until reveal. This is cheapest mechanically and preserves today's append-only `stagingOrder` behavior (`services/playgame/engine/apply.ts:48-63`). It is not acceptable for the target product model.

The decisive constraint is not reveal order; `resolveTurn` filters the global list per owner. It is `resolveStage`'s immediate entry trigger. After staging and spending energy, `resolveStage` calls `onCardEnteredHere` and returns its arbitrary effect events (`services/playgame/engine/resolve.ts:80-111`). The location trigger receives `EVENT_CARD`/`EVENT_OWNER` and threads mutable state through every expression (`services/playgame/engine/effects/evaluator.ts:91-129`). The schema permits conditionals, counters, destroys, moves, card creation, and other non-commutative effects, not merely the currently enabled Gun Store's `+2` to the entering card (`services/playgame/engine/manifest/content/locations.ts:356-364`).

Therefore serialized arrival has three semantic costs:

1. Two hidden simultaneous plays entering an order-sensitive location can produce different victims/counters solely because one intent reached the queue first.
2. Undo cannot generally restore the prior state: current `CARD_UNSTAGED` and energy refund reverse only the card and cost, not an entry-trigger cascade (`services/playgame/engine/resolve.ts:114-159`; `services/playgame/engine/apply.ts:66-79`).
3. Existing drivers already choose different serialization policies: headless stages priority owner then opponent (`services/playgame/engine/cli/runMatch.ts:49-83`), while live play stages the local player during interaction and only later stages the remote seat inside `resolveTurnFlow` (`services/playgame/script/flows.ts:102-113`). Worse, live `autoPlayRemoteSeat` bypasses `resolveStage`, so remote entry triggers do not run at all (`services/playgame/script/actions.ts:545-570`).

### Executable decision examples

1. **Stable per-seat order.** Priority is P1. P0 final draft is `[A, B]`; P1 final draft is `[X, Y]`. Canonical merge is `[X, Y, A, B]`. Reveal order is also P1's `X, Y`, then P0's `A, B` unless effects move/destroy/delay a card.
2. **Revision.** P0 drafts `[A, B]`, removes A, then stages A again. P0 final order is `[B, A]`; no `onCardEnteredHere` event has fired during editing. At lock, B's full stage cascade runs before A's exactly once.
3. **Order-sensitive location.** In a test manifest, a revealed location's `onCardEnteredHere` destroys `EVENT_CARD` only while counter `first-entry` is zero, then increments the counter. With P0 priority and final drafts `[A]`/`[X]`, A is deterministically the first entrant and victim regardless of which seat locked or submitted first. Serialized staging would let arrival order choose A or X.
4. **Current Gun Store.** Each entering card gets its own `CARD_POWER_CHANGED(+2)` after its stage event. Canonical fold produces both buffs in fixed order. It also fixes the present live asymmetry where the local `resolveStage` path fires the trigger but manual remote dispatch does not.

## Final recommendation

Preserve the deterministic engine and reducer, but revise the event schema narrowly:

- add `TURN_RESOLUTION_STARTED { turn }` to reconstruct the authoritative transition into `RESOLVING`;
- add `newDefId` to `LOCATION_REPLACED` so supported location replacement folds exactly;
- add no new event for ordinary opening reveal; build it in runtime as `LOCATION_REVEALED` plus its engine-evaluated effect events;
- hold private staging as revisable runtime drafts and canonically merge priority owner first at lock, preserving each seat's final order;
- never let script cancellation, DOM availability, animation completion, local/remote seat, or staging arrival time select, omit, or reorder authoritative events.
