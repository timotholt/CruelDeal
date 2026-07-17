# Phase 0 Task D — State Decisions

Audit basis: repository state at `06c7166` on 2026-07-17. This is analysis only. Line references identify the audited code; no implementation is included here.

## 1. Undo characterization and decision

### Exact current UI behavior: whole-state snapshot restore

`PlayGameContext` does not currently submit either engine undo intent. Before each accepted local stage attempt, `stageCardInLane` clones the entire pre-stage `MatchState` with `structuredClone` and pushes it into `ui.history` (`contexts/PlayGameContext.tsx:202-234`). A rejected stage removes the just-pushed snapshot.

- `undoPending` replaces the live engine store with the newest saved `MatchState` and pops one history entry (`contexts/PlayGameContext.tsx:238-246`). This restores card zones and ordering, energy, per-card deltas/logs/tags/counters, pending effects, tracked variables, `lastPlayedBy`, `stagingOrder`, and the canonical event log exactly to their pre-stage values.
- `undoPendingCard(cardId)` walks snapshots newest-to-oldest until it finds the first snapshot whose `stagingOrder` does not contain the target, restores it, and truncates history to that point (`contexts/PlayGameContext.tsx:248-267`). For stages `A, B, C`, undoing `C` restores the state before `C`; undoing `B` restores the state before `B` and therefore also removes `C`; undoing `A` restores the state before all three. This is the current targeted LIFO-suffix behavior.
- Because the snapshot is the whole match, it also erases any unrelated authoritative change made after that snapshot. Current presentation sequencing mostly prevents such interleaving while undo is available, but this is not safe for the planned simultaneous private-staging model.
- The RNG object is not snapshotted. Current stage randomness is obtained from a named `engineRng.fork`, so the parent RNG is not advanced by the stage; nevertheless, the future rollback contract should own RNG namespace/replay identity rather than rely on this UI detail.

### What a stage commits today

`resolveStage` validates the canonical `state.cards[cardId]`, projected cost, capacity, and location play restrictions, then returns one event batch (`services/playgame/engine/resolve.ts:55-111`):

1. `CARD_STAGED`: removes the card from hand, patches the canonical instance to `zone: 'LANE'`, sets its lane and `revealed: false`, adds `PLAYED_THIS_TURN`, appends the ID to `stagingOrder`, and sets `lastPlayedBy[owner]` (`services/playgame/engine/apply.ts:48-63`). The tracked fold also increments `cardsPlayedThisTurn` (`services/playgame/engine/apply.ts:687-692`).
2. `ENERGY_CHANGED` with `delta: -cost` and reason `CARD_PLAYED`: updates the live energy pool, appends `energyLog`, and updates `trackedVariables[owner].energyUnspentNow` (`services/playgame/engine/resolve.ts:92-99`; `services/playgame/engine/apply.ts:82-94,754-759`).
3. Zero or more events produced by the revealed location's `onCardEnteredHere` effects. `fireLocationTrigger` skips an absent or unrevealed location, but otherwise evaluates every configured expression and may return an arbitrary effect cascade (`services/playgame/engine/effects/evaluator.ts:91-130`). The current manifest's Gun Store emits `CARD_POWER_CHANGED +2` for the entered card (`services/playgame/engine/manifest/content/locations.ts:356-364`), which also changes `powerDelta` and `powerLog`.

`PlayGameContext` dispatches every returned event individually (`contexts/PlayGameContext.tsx:234`). `apply` appends every event—including diagnostics—to `state.log` (`services/playgame/engine/apply.ts:35-41,644-646`). Thus a successful Gun Store stage commits `CARD_STAGED`, the energy spend, and `CARD_POWER_CHANGED`; a future location expression can also create, destroy, move, transform, tag, schedule, or otherwise mutate cards and locations through the normal evaluator vocabulary.

### Why the existing engine undo intents are not equivalent

`UNSTAGE_CARD` currently emits only `CARD_UNSTAGED` plus an energy refund calculated from the card's projected cost at undo time (`services/playgame/engine/resolve.ts:114-132`). `UNDO_TURN` emits the same pair for every staged card owned by the caller, in reverse `stagingOrder` (`services/playgame/engine/resolve.ts:135-159`). Applying `CARD_UNSTAGED` only moves that card from lane to the end of hand and removes its ID from `stagingOrder` (`services/playgame/engine/apply.ts:66-79`). Consequently:

- Gun Store's `CARD_POWER_CHANGED` remains on the card, in `powerLog`, and in the canonical log.
- Any location-trigger mutation to another card, a location, a pending effect, counters, tracked variables, or energy remains.
- `PLAYED_THIS_TURN`, `lastPlayedBy`, and `trackedVariables.cardsPlayedThisTurn` are not reversed.
- The original hand position is not restored; unstage appends to hand. Reverse-unplaying several cards can therefore produce a different hand order from the pre-stage snapshot.
- The spend and refund both remain in `energyLog` and `state.log`, whereas snapshot restore removes the rejected planning history entirely.
- Refund uses current projected cost rather than the cost recorded on `CARD_STAGED`; a trigger or other intervening projection change can make the refund differ from the original spend.
- `UNSTAGE_CARD` accepts any staged card and removes only that card. It does not implement the UI's “target plus every later dependent stage” rule. `UNDO_TURN` removes all of the owner's staged cards, not one LIFO suffix.
- Full-log gameplay queries already expose the difference: `cardWasPlayedAtLaneThisTurn` sees the retained `CARD_STAGED` even after an event-based unstage, while snapshot restore erases it.

The existing tests prove only the trigger-free happy path: one unstage returns the card and energy, and `UNDO_TURN` removes three cost-1 cards (`services/playgame/engine/resolve.test.ts:245-280`). They do not cover location-entry effects, tracked state, log equivalence, hand order, changed projected cost, or targeted suffix rollback.

### Decision

**Keep the public intent names, but extend the runtime resolution contract. The current `MatchEvent[]` implementations of `UNSTAGE_CARD` and `UNDO_TURN` do not reproduce required undo semantics and must not be used as the Phase 1 rollback mechanism.**

The planning runtime should own a turn-base checkpoint plus an ordered stack of accepted, still-private stage transactions/intents. Its working projection is a deterministic fold of that base plus the retained stage transactions.

- `UNSTAGE_CARD(cardId)` removes the transaction for `cardId` and every later transaction in that seat's planning stack, then refolds the retained prefix. If the card is newest, this is a single-card rollback; if it is older, it is the current LIFO-suffix rollback.
- `UNDO_TURN(owner)` clears that owner's pending planning stack and refolds from the turn base.
- Rolled-back stage transactions never enter the canonical committed replay log. Only the finalized planning result crosses the system-owned reveal/commit boundary.
- In simultaneous play, each seat's private plan must be rebuilt without restoring a whole shared `MatchState`; otherwise one seat's undo can erase the other seat's accepted work.

Do not attempt to synthesize inverse events for every location/effect event. The evaluator's mutation surface is deliberately open-ended, so inverse-event maintenance would grow with the effect vocabulary and would still have to repair ordering, tracked folds, logs, and RNG-derived choices. A checkpoint-plus-refold planning overlay is the smaller and complete extension. If `resolve` remains an event-array API for ordinary intents, undo needs a distinct internal result such as a planning-stack edit/refold directive rather than pretending that two compensating events are equivalent.

Required characterization for implementation: stage on revealed Gun Store, verify `+2` and all logs appear, then verify latest-card undo, older-card suffix undo, and full-turn undo reproduce the exact pre-stage projection and leave no rolled-back stage/trigger transaction in canonical replay history.

## 2. A3 card-instance normalization decision

### Where `CardInstance` is duplicated

The canonical model already uses IDs for lane membership, `pending`, and `stagingOrder`, but not for deck and hand. `MatchState` declares `deck` and `hand` as `CardInstance[]` while also storing every instance in `cards: Record<CardId, CardInstance>` (`services/playgame/engine/types/state.ts:347-354`). The duplication is created or maintained at these sites:

| Site | Duplication behavior |
| --- | --- |
| `services/playgame/engine/cli/initState.ts:33-74,131-166` | Builds two arrays of full instances, indexes those same values into `cards`, then stores the full arrays in `deck`. |
| `services/playgame/debug/buildDebugState.ts:23-55,99-130` | Repeats the normal builder's full-instance deck plus `cards` index shape. |
| `services/playgame/engine/apply.ts:297-327` | `CARD_ADDED_TO_DECK` and `CARD_ADDED_TO_HAND` dereference `state.cards[id]` and insert that full object into a zone array. |
| `services/playgame/engine/apply.ts:340-360` | `CARD_MOVED_TO_ZONE` inserts the canonical full object when the destination is deck and delegates to the same full-object hand helper for hand. |
| `services/playgame/engine/apply.ts:372-380` | `DECK_SHUFFLED` rebuilds the deck from the full objects already embedded in the old deck. |
| `services/playgame/engine/apply.ts:607-629` | `addToHand`, removal, and all-zone removal maintain full-object hand/deck arrays by comparing embedded `.id`. |

The invariant is not maintained. `patchCard` replaces only `state.cards[id]` (`services/playgame/engine/apply.ts:569-575`); it does not replace an existing hand/deck element. Any later power/cost change, transform, tag, text override, counter change, provenance update, owner/zone/lane change, or reveal change can therefore leave the embedded zone copy stale. Initial object identity does not save this design because every patch is immutable and creates a new canonical object.

Concrete existing path: `addDiscountedCardToHand` inserts a new full instance in hand and immediately applies `CARD_COST_CHANGED` (`services/playgame/engine/effects/builtins.ts:231-290`). The canonical `cards[id].costDelta/costLog` changes, while the embedded hand object's fields do not.

### Production consumers of the embedded copies

Every production reader found by auditing `hand`/`deck` access is accounted for below. “ID-only” means the reader currently touches `.id` but already resolves gameplay state through `state.cards[id]` or a projection; “embedded-field” means it trusts another field on the potentially stale object.

| Consumer | Fields read from the zone element | Migration |
| --- | --- | --- |
| `services/playgame/engine/apply.ts:185-200,217-228,285-380,607-629` | `id`, and full objects for insertion/reordering | Make all filters/includes/reorders operate on `CardId`; zone insertion appends only the ID. |
| `services/playgame/engine/effects/pools.ts:67-82,104-114` | **`defId`** from deck elements | Map each deck ID through `state.cards[id]`; this removes stale transform risk. |
| `services/playgame/engine/effects/builtins.ts:93-215` | `id`, **`defId`**, **`spawnSource`** from hand elements | Select IDs, then dereference canonical instances before definition/provenance tests. |
| `services/playgame/engine/effects/builtins.ts:299-312,474-494,625-642` | `id`; copy-top also reads **`defId`** | Keep ordering in ID arrays and dereference `state.cards[id]` where `defId` is needed. Note that draws use index `0`, while copy-top currently calls the last element “top”; preserve or separately decide that pre-existing inconsistency during migration. |
| `services/playgame/engine/effects/evaluator.ts:632-655` | `id` of the top deck element | Element is already the `CardId`. Hand/deck capacity reads are unchanged. |
| `services/playgame/engine/resolve.ts:662-680` | `id` while constructing draw events | Element is already the `CardId`; remove the `CardInstance` cast/import. |
| `services/playgame/engine/ai.ts:138-180` | `id` for projected cost, ordering, RNG salt, and output | Sort and iterate IDs; projected cost already dereferences canonical state. |
| `services/playgame/engine/projections/select.ts:64-72` | `id` only | Return copies of the ID arrays directly. |
| `services/playgame/view.ts:153-160` | `id` only | Pass each ID directly to `resolveCard`, which already uses `state.cards`. |
| `services/playgame/presentation/cardTransfers.ts:127-146` | `id` for index lookup | Replace `.findIndex(c => c.id === id)` with ID lookup. Zone truth already comes from `state.cards`. |
| `contexts/PlayGameContext.tsx:182-193` | deck-top `id`; hand length | Use the top ID directly; length is unchanged. |
| `services/playgame/script/actions.ts:152-182,597-600` | deck-top `id`; hand length | Use the top ID directly; length is unchanged. |
| `components/screens/CityMapScreen.tsx:32-50` | deck-top `id`; hand/deck length | Use the top ID directly; length is unchanged. |
| `services/playgame/engine/cli/runMatch.ts:113-128` | deck-top `id` | Use the top ID directly. |
| `components/screens/play/PlayBoard.tsx:140-141` and `services/playgame/engine/projections/numexpr.ts:36-41` | length only | No semantic rewrite; ID arrays preserve cardinality. |

Test and fixture migration is broad but mechanical. Full-instance hand/deck fixtures or embedded-field assertions occur in `services/playgame/engine/apply.test.ts`, `resolve.test.ts`, `replay.test.ts`, `ai.test.ts`, `content-effects.test.ts`, `effects/evaluator.test.ts`, `location-primitives.test.ts`, `__tests__/builtins.test.ts`, `__tests__/dsl-atoms.test.ts`, `__tests__/tracked-vars.test.ts`, `projections/projections.test.ts`, `projections/query.test.ts`, `services/playgame/presentation/cardTransfers.test.ts`, and the Phase 0 runtime property/characterization fixtures under `services/playgame/runtime/__tests__`. Those fixtures should build one canonical `cards` map plus ID zone arrays; assertions about `defId` or provenance should read `state.cards[zoneId]`.

Replay/snapshot serialization also contains the duplicated shape today. Changing the genesis `initialState` schema requires a replay bundle version bump or an explicit local v1-to-v2 normalization at import if existing bundles must remain readable.

### Options and decision

**Decision: normalize both `hand` and `deck` to `Readonly<Record<Owner, readonly CardId[]>>`; keep `cards` as the sole `CardInstance` store.** All ordered zones then have the same representation as lanes: the zone array owns membership and order, while `cards[id]` owns instance state.

The alternative—retain `CardInstance[]` and expose enforced ID-only views—is weaker and not cheaper enough to justify itself:

- Accessors or lint rules can stop normal consumers from reading embedded fields, but raw `MatchState` still serializes contradictory values and remains available to reducers, replays, tests, debug tools, and future code.
- Synchronizing every `patchCard` into whichever zone currently embeds the object creates a second write path and an invariant that every new event must remember. That is the failure mode this task is meant to remove.
- Typing zone elements as `{ id: CardId }` would remove stale fields, but is effectively normalization with an unnecessary wrapper and larger serialized state.

Migration cost is moderate and localized: two state fields, the normal/debug builders, the reducer's zone helpers and shuffle logic, roughly a dozen ID-reading production call sites, three embedded-field engine consumers (`pools`, selected `builtins`, and copy-top behavior), plus the listed fixtures and replay schema. Most gameplay projections already use `state.cards[id]`, and lane membership is already normalized, so no redesign of the effect DSL or projection system is needed.

Acceptance invariant: for every `CardId`, exactly one canonical instance exists in `state.cards`; every live zone contains only IDs; an ID appears in exactly the zone implied by `cards[id].zone` (and the matching owner/lane); no selector, effect, UI adapter, or replay reads instance fields from a zone entry.

## 3. A4 `state.log` gameplay-query inventory

An audit of `services/playgame/engine`, including `effects/builtins.ts`, found exactly two authoritative gameplay decisions that scan `MatchState.log`. Both are in `builtins.ts`.

| Current query | Exact semantics | Bounded replacement |
| --- | --- | --- |
| `cardWasPlayedAtLaneThisTurn` (`services/playgame/engine/effects/builtins.ts:645-655`), used by Barracade and Riot Squad | Scans from genesis, reconstructs the active turn from `TURN_STARTED`, then asks whether any `CARD_STAGED` occurred this turn at a lane, optionally by owner. Because event-based unstage leaves the stage in the log, it currently counts an undone stage; snapshot undo does not. | Add fold-maintained `playedAtLaneThisTurn: Record<Owner, readonly [number, number, number]>`. Increment on an accepted `CARD_STAGED`; reset when a new turn begins. Planning rollback/refold removes rolled-back increments. If committed `CARD_UNSTAGED` remains supported outside the planning overlay, decrement using the pre-event card owner/lane (or carry owner/lane on the event). Query owner-specific count or the sum of both owners in O(1). Counts, not booleans, preserve multiple plays and allow rollback. |
| `traumaTeam` (`services/playgame/engine/effects/builtins.ts:753-782`) | Scans from genesis for `CARD_DESTROYED` events assigned to `state.turn - 1`, retains entries whose current canonical card is still owned by the caller and still in `DESTROYED`, and randomly picks the resulting event-order array. Repeated destruction events for the same still-destroyed card currently duplicate that ID and therefore weight the pick. | Add a two-bucket fold index: `{ current: { turn, idsByOwner }, previous: { turn, idsByOwner } }`. Append the victim ID on every `CARD_DESTROYED`; rotate current to previous only when `TURN_STARTED` advances the turn, then start an empty current bucket. Trauma Team reads `previous` only when its turn is `state.turn - 1`, filters IDs against current `state.cards[id].zone === 'DESTROYED'`, and samples the retained event-order multiset. Keeping duplicates preserves current RNG weighting. Retaining two per-turn buckets bounds history independently of match length; the planned per-transaction/event bound supplies a strict maximum bucket size. Rotating at `TURN_STARTED`, rather than `TURN_ENDED`, preserves turn-5 history for delayed end-game reveals after turn 6 has ended. |

These indexes belong beside `trackedVariables` as deterministic fold-maintained gameplay state (for example a `turnIndexes` field), not in presentation or replay infrastructure. Genesis/debug/test builders must initialize them, `apply` must update them from events, and replay/fold parity must include them. The undo decision above is coupled to the first index: a rolled-back private stage must disappear from the refolded index, just as it disappears under today's snapshot restore.

For completeness, the remaining engine/runtime `log` accesses are not gameplay queries and do not need tracked gameplay fields:

- `services/playgame/engine/apply.ts:644-646` uses `log.length` for sequence and appends the event. This is log storage, not a gameplay read; final log-free state should source sequence from the transaction builder/canonical record stream.
- `services/playgame/engine/replay.ts:78-94` maps the log to export a replay. The replacement is the session-owned transaction record/replay-export adapter specified by the refactor plan, not a bounded gameplay index.
- Development replay reads in `contexts/PlayGameContext.tsx:300-323` and `components/screens/play/PlayBoard.tsx:73-80`, plus parity/property serialization in `services/playgame/engine/testkit/transactionFrames.ts:69-79` and `services/playgame/runtime/__tests__`, consume the log for debug/replay/test output only. They should consume the same session transaction records when canonical `MatchState.log` is removed.
- Test assertions and empty-log fixtures do not make gameplay decisions.

Therefore A4 requires two gameplay indexes—per-owner/per-lane current-turn play counts and a two-turn destroyed-event ID ring—and no other bounded gameplay index for current `state.log` consumers.
