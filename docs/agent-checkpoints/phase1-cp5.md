# Phase 1 Checkpoint 5 — Final Adapters and Authority Removal

Status: complete. All Phase 1 **BUILD NOW** authority-migration work is landed.
`MatchSession` owns validated setup and `MatchRuntime` remains the only live
gameplay authority. The plan's explicitly **BUILD AFTER**, **BUILD LAST**, and
**DEFER** exit items remain future work and are identified below; no Phase 2
provider split was started.

## Session and replay adapters

- Added `MatchSession.fromBootstrap(...)`. It validates and defensively copies
  the candidate, retains the frozen validated bootstrap, resolves the manifest
  and ruleset, and constructs the sole `MatchRuntime` from mechanical and local
  scheduling inputs only: match/seed/rules identity, viewer/controller roles,
  and deck entries. Display names, participant/deck IDs, avatars, deck names,
  revisions, hashes, and mode remain session-owned.
- `/play`, the city-map experiment, and provider tests now mount
  `PlayGameProvider` with a `MatchSession`; the provider no longer constructs a
  second setup/runtime path from a bootstrap prop.
- `MatchRuntime.exportReplay()` returns genesis plus committed records;
  `MatchSession.exportReplay()` adds its retained bootstrap to form the UI/debug
  replay export. Added `renderRuntimeReplay(...)`, a read-only fold over that
  bootstrap, genesis, and ordered committed transaction shape. It validates
  match identity, seed/manifest compatibility, transaction ordering, and
  commit revision shape without mutating the export.
- `PlayBoard` replay rendering and ReplayDrawer's Copy Replay JSON action now
  consume `exportRuntimeReplay()`. The old UI reconstruction from
  `initialState + replayEvents()` was deleted, as were those context surfaces.
- Added session/replay tests proving setup rejection precedes runtime creation,
  the validated bootstrap is frozen and retained, the runtime is the sole
  session authority, replay reaches runtime state, and rendering leaves the
  export unchanged.

## Development-only debug adapter

- Moved the complete `window.__snapDebug` declaration and installer to
  `services/playgame/debug/installSnapDebug.ts`.
- `PlayGameProvider` loads that module only inside `import.meta.env.DEV` and
  unregisters the exact installed API on cleanup. The production build has no
  `__snapDebug` or `installSnapDebug` symbol.
- Debug replay inspection and JSON copy use the same runtime export and
  read-only runtime replay renderer as ReplayDrawer.

## Deletion inventory

The final tree has no production definition, import, call, or retained state
for these former authority paths:

- `PlayScriptCtx._engineEvents`, `_engineFinalState`, and
  `_revealsConsumedUpTo`;
- `liveRevealHandoff.ts` and `liveRemoteSeatPlanner.ts`;
- `captureEngineEndTurn`, `revealByPriorityFromEngine`, and
  `advanceTurnFromEngine`;
- `dispatchLocationRevealEffects`, `autoPlayRemoteSeat`, `startResolving`, and
  `finishResolving`;
- live `planEnemyTurnFromPool` imports/calls (the legacy engine planner remains
  only as an engine definition and engine-test subject);
- context `initialState`, `replayEvents`, and the inline debug-global block;
- the provider's `setEngineState` name/surface; the internal Solid adapter is
  explicitly `setPresentedState` and is not exposed;
- script `commitTurnResolution`, `submitEndTurn`, and mutable
  `presentationTimeline` handoff.

END_TURN is now submitted through the typed context command before the script
starts. `resolveTurnFlow(timeline)` and `openingSequence(timeline)` accept only
already-committed timelines and perform presentation pacing/UI-sidecar work.
No script action originates, selects, slices, suppresses, or applies gameplay
events.

## Grep proofs

All commands below were run from the repository root. Empty results are the
expected proof.

Legacy authority symbols and script command handoffs — no matches:

```sh
rg -n -g '*.ts' -g '*.tsx' '_engineEvents|_engineFinalState|_revealsConsumedUpTo|liveRevealHandoff|liveRemoteSeatPlanner|captureEngineEndTurn|revealByPriorityFromEngine|advanceTurnFromEngine|dispatchLocationRevealEffects|autoPlayRemoteSeat|startResolving|finishResolving|commitTurnResolution|submitEndTurn|presentationTimeline' contexts components services
```

Removed seam files — no matches:

```sh
rg --files services/playgame | rg 'liveRevealHandoff|liveRemoteSeatPlanner'
```

Raw gameplay mutation surfaces in the runtime/context/play components — no
matches:

```sh
rg -n -g '*.ts' -g '*.tsx' '\bdispatch\s*\(|\bsetEngineState\b|\bsetState\b' contexts/PlayGameContext.tsx components/screens/play services/playgame/runtime
```

Component gameplay dispatch — no matches:

```sh
rg -n -g '*.tsx' -g '*.ts' '\bdispatch\s*\(' components
```

Live pool-planner imports/calls outside its engine definition and tests — no
matches:

```sh
rg -n -g '*.ts' -g '*.tsx' -g '!*.test.ts' -g '!*.test.tsx' 'import[^;]*planEnemyTurnFromPool|planEnemyTurnFromPool\s*\(' contexts components services/playgame | rg -v '^services/playgame/engine/ai\.ts:'
```

Replay UI/debug routing — every match is runtime-export based; there is no
`replayMatch(...)` call in these UI/debug paths:

```sh
rg -n -g '*.ts' -g '*.tsx' 'renderRuntimeReplay|exportRuntimeReplay|replayMatch\(' contexts components/screens/play services/playgame/debug services/playgame/runtime/replayExport.ts
```

Development-only debug source and production output:

```sh
rg -n 'import\.meta\.env\.DEV|installSnapDebug' contexts/PlayGameContext.tsx services/playgame/debug/installSnapDebug.ts
rg -n '__snapDebug|installSnapDebug' dist
```

The first command shows the guarded dynamic import and adapter definition. The
second returns no matches after `npm run build`.

## Final gates

- `npm run test:playgame:phase0` — **pass** with
  `PLAYGAME_PROPERTY_CASES=200`: 9 files, 52 tests. The five named properties
  each ran at the configured 200-case depth.
- `npx vitest run services/playgame/runtime contexts` — **pass**: 10 files,
  55 tests.
- `npm run build` — **pass**: Vite production build, 1,184 modules transformed.
- `npm run lint` — expected repository-baseline exit 1: 608 problems,
  **266 errors**, 342 warnings. This is three fewer errors than the recorded
  269-error baseline in `phase0-taskE-baseline.md`; there are no new errors by
  baseline count. Focused ESLint over every CP5 production/test file passes
  with zero warnings.
- `npx vitest run services/playgame/engine` — baseline-shaped collection
  result: 22 file-level failures (legacy no-suite files plus the recorded
  manifest drift), 6 files passed, **131 tests passed and 0 test-level
  failures**. This exactly preserves the baseline test-level failure count.
- `git diff --check` — **pass**.
- Production debug-global grep over `dist` — **pass**, no matches.

## Phase 1 exit-criteria checklist

1. **MET — complete DOM-free turn and exact live/headless parity.** Runtime
   characterization and P-PARITY cover full turns without DOM/director; CP4
   routes live play through the same runtime.
2. **MET — P-PARITY, P-EXACTLY-ONCE, P-PROVENANCE, P-FOLD, and P-NO-TIME.**
   All pass at 200 generated cases in the Phase 0 gate.
3. **MET — no raw setter and no authoritative presentation/script cursor.**
   Runtime exposes read methods, typed intent submission, subscription, and
   export only. The deletion greps above are empty.
4. **MET — one live/replay frame builder; presentation cannot partially apply
   authority.** Runtime commits with `buildEventTransactionFrames`; runtime
   replay rendering uses the same builder. CP4 presentation tests prove frame
   pacing is over already-committed state and failure fast-forwards display.
5. **MET — shared opening size and provenance.** Both seats draw
   `startingHandSize`; P-PROVENANCE and the live-opponent contract prove AI
   plans from authoritative hand instances rather than manifest-pool minting.
6. **MET — invalid setup rejects without deck shortening.** Tests explicitly
   cover manifest version, ruleset, length, unknown/disabled definition,
   variant, uniqueness, copy limit, and content hash.
7. **MET — canonical local replay export shape.** Export contains the frozen
   bootstrap, pre-opening genesis, and ordered non-overlapping committed
   records; both fold and read-only-render tests reach runtime state.
8. **MET — typed rejection/idempotency and FIFO continuity.** Runtime contracts
   cover duplicate, stale, phase/rules invalidity, dequeue-time illegality,
   malformed work, no event/frame additions, and continued drain.
9. **MET — first lock waits and system reveal uses decided order.** The
   two-non-AI lock test proves no first-lock transaction; runtime merges the
   priority owner's retained private order first in one SYSTEM transaction.
10. **NOT MET — normal UI/presentation projected types only.** The opaque
    projected contracts and trusted-local adapter seam exist, but the current
    unsplit compatibility provider still exposes trusted local canonical state
    and frame types. Migrating its consumers belongs to the plan's explicit
    BUILD AFTER provider/projection integration and was not pulled into this
    checkpoint.
11. **NOT MET — H1–H7/P-INTERLEAVE provider/director integration.** Explicitly
    BUILD AFTER. CP4 has local provider/pacing regressions, but the general
    director/cursor harness is not claimed.
12. **NOT MET — bounded frame retention, log-free materialized state, bounded
    gameplay indexes.** Explicitly BUILD LAST; Phase 1 preserves the named
    seams and does not claim this later hardening.
13. **NOT MET — durable recovery/receipt/checksum/CAS and exhaustive wire
    redaction.** Explicitly DEFER until live-server storage/transport exists.
14. **MET — complete BUILD NOW authority migration.** Live setup, intents, AI,
    locks, resolution, opening, replay export, and every authoritative state
    transition have one owner (`MatchRuntime`); no second live authority path
    remains.

Phase 1's complete BUILD NOW authority migration is therefore closed. The four
not-met entries are the plan's explicitly later integration, hardening, and
server-adapter work; none was started here.

## Post-merge fixes

- Fixed END TURN presentation choreography so the committed
  `TURN_RESOLUTION_STARTED` frame locks every staged card on both seats
  face-down in one shared 250 ms beat before the priority-ordered reveal walk.
  Planning still shows the owner's staged cards face-up, and each subsequent
  `CARD_FLIPPED` frame now reveals from the locked face-down presentation in
  canonical frame order.
- Split the presentation-only opening cadence into committed deal, location
  reveal, and turn-start beats. The `TURN 1` toast now lands after the
  three-card deal and before the first `LOCATION_REVEALED` frame; the normal
  draw animation follows the reveal.
- Added manifest constant `turnStartDraw: 1` and made the canonical opening
  transaction deal `startingHandSize` cards, reveal lane 1, then draw once for
  each seat through the shared deterministic draw pipeline. Turn 1 therefore
  starts symmetrically at four cards in hand and eight remaining in deck, with
  headless execution, runtime projection, replay, and generated properties all
  consuming the same changed event stream.
- Made dev replay descriptions resolve card and location instance ids through
  replay state and the active manifest, with historical location fallback for
  post-destroy/replace frames and raw-id fallback for unknown instances. The
  selected-frame summary and nested `cause.sourceId` now render labels such as
  `b0v5a7im (Bone Market)`, while the JSON block remains the untouched event.
- Added one-line human-readable replay causes for card effects, location
  effects, resolved-spell cleanup, and other game-rule mutations. The same
  description is available from `window.__snapDebug.getFrameDescription()`.
- Extended `EffectRef` with optional `systemReason`; resolved spells now emit
  `SPELL_RESOLVED`. The SYSTEM-emitter audit found no other production
  `EffectRef` emitters (remaining SYSTEM references are intent seats, spawn
  provenance, or test/debug fixtures).
- Verified these fixes with the focused replay-presentation Vitest (3 tests),
  the standalone evaluator suite including the new spell-reason assertion,
  `npm run test:playgame:phase0` (9 files, 53 tests, 200 property cases),
  `npx vitest run services/playgame/runtime contexts` (10 files, 57 tests),
  and `npm run build` (1,186 modules transformed). All passed; focused ESLint,
  `git diff --check`, and the production-bundle debug-global grep also
  passed.
- Removed the staged-card lock flicker by batching the presentation-only
  `isFlipped` lock with adoption of the committed
  `TURN_RESOLUTION_STARTED` projection. Solid observers now see one atomic
  `{ phase: RESOLVING, locked: true }` update, so `BoardCard` cannot paint an
  intermediate owner-visible face between the committed fold and the lock.
  A `createRenderEffect` regression asserts that exact facing boundary.
- Anchored hidden opponent-hand transfers at the board's top center and added
  the same opponent-hand-region fallback to `eventAnimator`. Remote
  `CARD_STAGED` flyers no longer use the neutral board-center fallback when
  their source hand card has no visible DOM element.
- Added transaction actor and card ownership to replay presentation. Runtime
  replay frames retain their transaction id for read-only debug lookup;
  summaries and the drawer header show `P0 (YOU)`, `P1 (OPPONENT)`, or
  `SYSTEM` from the committed intent identity and bootstrap display name.
  Card labels now use `instance (name, owner)`, decoded card causes include
  the source owner, and event JSON remains raw apart from extended comments
  such as `// Leon (P1)`. Historical card-owner fallback mirrors historical
  definition/name resolution.
- Verified this follow-up with focused presentation/provider Vitest (3 files,
  10 tests), focused ESLint, and `git diff --check`, plus all requested gates:
  `npm run test:playgame:phase0` (9 files, 53 tests, 200 property cases),
  `npx vitest run services/playgame/runtime contexts` (10 files, 57 tests),
  and `npm run build` (1,186 modules transformed). All passed.
- Conformed the END TURN presentation walk to the designer-authored sequence:
  the local private plan locks first in one 250 ms beat, remote staged cards
  then fly face-down from the opponent hand region, priority-owner
  `CARD_FLIPPED` frames reveal one at a time, and non-priority frames follow.
  Local canonical `CARD_STAGED` frames are adopted without replaying an extra
  hand-to-lane flight, while delayed cards remain absent from the reveal walk.
- Routed effect-driven `CARD_MOVED` and visible `CARD_MOVED_TO_ZONE` frames
  through the shared rect-capture/card-transfer FLIP animator. Move VFX is now
  keyed by `cause.effectKind` and `cause.sourceId`, with location relocations
  receiving the location palette instead of silently adopting the destination
  projection.
- Centralized `BoardCard` facing so a local card is owner-visible only while it
  belongs to the current staging order. The resolution lock supplies its sole
  face-down transition, each committed reveal supplies at most one face-up
  transition, and cards held by the engine's `DELAY_REVEAL` projection stay
  face-down after turn cleanup instead of flipping back up during planning.
- Added presentation regressions for the per-card facing-transition ceiling,
  delayed-card facing, real `CARD_MOVED` transfer invocation, and the exact
  lock → remote fly-in → priority reveal → non-priority reveal order. Also
  made the legacy presentation mapping checks Vitest-collectable and excluded
  nested `.claude/worktrees` checkouts from the repository test boundary.
- Verified this conformance round with `npm run test:playgame:phase0` (9 files,
  53 tests, 200 property cases),
  `npx vitest run services/playgame/runtime contexts services/playgame/presentation`
  (16 files, 67 tests), and `npm run build` (1,187 modules transformed). All
  requested gates passed.
- Established the design rule that spells have no Power. Hand, board, pile,
  zoom-inspector, legacy card, and inspector-history presentation now omit the
  power element for `cardType: "spell"` while retaining cost. A shared
  card-type guard excludes spells before lane aggregation, breakdowns,
  effective-power thresholds, min/max power selection, query filters, power
  mutations, and the two bespoke weakest-card builtins; staged spells can no
  longer become phantom zero-Power targets. `basePower` remains schema-required
  but is documented as meaningless for spells, and card validation emits
  non-failing warnings for the 15 nonzero legacy spell values without requiring
  JSON migration. Added projection/selector, direct builtin, and rendered pile
  regressions. Verified with focused Vitest (4 files, 52 tests), card validation
  (128 cards, 15 warnings), `npm run test:playgame:phase0` (9 files, 53 tests,
  200 property cases),
  `npx vitest run services/playgame/runtime contexts services/playgame/presentation services/playgame/engine/testkit`
  (16 files, 67 tests), `npm run build` (1,188 modules transformed), and
  `git diff --check`; all requested gates passed.
- Composed each board card's deterministic resting rotation into reveal and shared card-transfer flight transforms, including nested-wrapper ownership without double rotation; `npx vitest run services/playgame/presentation contexts` (8 files, 16 tests) and `npm run build` (1,189 modules transformed) passed.
