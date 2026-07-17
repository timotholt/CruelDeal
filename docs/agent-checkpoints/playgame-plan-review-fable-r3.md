# Fable Review — Round 3 — MatchBootstrap incorporation

Rounds 1-2 reached equilibrium on runtime authority. Round 3 adds the
match-bootstrap/deck-contract analysis (verified against code) to the same
plan. Incorporate the following into
docs/playgame-runtime-and-ui-refactor-plan.md.

## Verified findings to add to the Problem Statement (or a sibling section)

- /play receives an anonymous pre-built MatchState; player identity, deck
  identity, mode, and matchmaking data never reach the session or are
  discarded before the provider mounts (router passes nothing; UI defaults
  to YOU/OPPONENT).
- VERIFIED gameplay bug: live opponent turns use planEnemyTurnFromPool
  (actions.ts ~537), minting cards from the whole manifest, while the real
  P1 deck accumulates unused draws; headless runMatch.ts already uses
  planEnemyTurnFromHand. Opponent deck selection is currently cosmetic.
- VERIFIED: no startingHandSize in MatchConstants; UI draws 4 local-only,
  headless draws 3 per seat (runMatch.ts comment admits the gap).
- VERIFIED: buildDebugState silently skips unknown card IDs, producing
  short decks.
- Deck.variantId accepted then ignored at card creation.

## Contract to add

Adopt the MatchBootstrap interface as specified in the analysis (matchId,
mode, seed, rulesetId, manifestVersion, viewerSeat, participants per seat
{participantId, controller, displayName, avatarId?}, decks per seat
{deckId, revision, name, entries, contentHash}). Responsibilities:

- Match setup validates and freezes both deck snapshots.
- MatchSession retains participant/deck/mode/match metadata; presentation
  reads it from the session, never from MatchState.
- Engine receives only mechanical inputs: seed, manifest, rules, deck
  entries. Names/avatars NEVER enter reducer MatchState.
- Replay records the bootstrap descriptor alongside mechanical state.

## Phase placement (keep the existing phase structure)

- Phase 0: add the deck-provenance characterization proof — given two
  explicit debug decks, every card drawn or played by either seat
  originates from that seat's frozen deck snapshot unless an engine event
  explicitly creates it. Also characterize the current 4-vs-3 starting-hand
  divergence.
- Phase 1: MatchRuntime/MatchSession is constructed FROM a MatchBootstrap;
  initially fed by the existing debug picker. Switch live AI to
  planEnemyTurnFromHand here (runtime-accepted AI intents must reference
  real hand cards). Add startingHandSize to MatchConstants and make both
  live and headless paths use it. Deck validation at bootstrap: exactly-12,
  known definitions, variant existence, uniqueness/copy rules as manifest
  defines them; debug builder's silent skip becomes a hard error.
- Phase 2: MatchSessionContext exposes participant/deck/mode metadata from
  the bootstrap (replaces YOU/OPPONENT defaults).
- Scope guards: collection wiring stays EXCLUDED (legacy c1-style IDs vs
  manifest IDs is a separate migration). Ownership and per-player
  card-possession validation are DEFERRED until collection migrates —
  listed, not built. mode is carried in the bootstrap but must not
  introduce ruleset branching yet; both /play entry buttons may pass their
  mode string and nothing else changes.
- Replay export gains the bootstrap descriptor in Phase 1 alongside the
  committed log.

## Instructions for this round

Verify the findings against code yourself where not already verified.
Apply what you agree with to the plan. Write
docs/agent-checkpoints/playgame-plan-codex-response-r3.md with a change
list and any objections; state EQUILIBRIUM if you have none and no further
changes of your own. Touch no other files.
