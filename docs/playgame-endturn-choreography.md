# END TURN Choreography — Authoritative Spec

Designer-specified 2026-07-17. Presentation MUST match this sequence
exactly. Any presentation change to /play turn resolution is validated
against this document.

## Sequence

1. **Local lock.** The bottom (local) player's cards played during the
   staging phase flip face-down where they sit. Each is tagged
   "to be revealed on turn N" (the current turn).
2. **Remote fly-in.** The top (remote) player's staged cards fly face-down
   from their hand position (top-center of their side — the "fake hand")
   into their lane slots. Same reveal-turn tagging.
3. **Priority reveals.** The player with priority reveals their cards one
   at a time — only cards scheduled to reveal on the current turn.
4. **Non-priority reveals.** The other player's scheduled cards reveal one
   at a time.

Then turn bookkeeping (location reveals at their frame positions, draws,
energy) paces in frame order as committed.

## Hard rules

- A card flips exactly ONCE face-down (step 1 or 2) and at most ONCE
  face-up (step 3 or 4) per resolution. No intermediate flip churn.
- Reveal eligibility is by scheduled reveal time, not "everything staged":
  cards tagged for a later turn stay face-down through steps 3-4. The
  schedule is a first-class value: a turn number OR the END_OF_GAME
  sentinel (planned card: "Ongoing: cards played in this lane are revealed
  at the end of the game" — Invisible Woman pattern). End-of-game reveals
  run as their own step in the match-end sequence, same one-flip rule.
- Effect-driven moves (e.g. a location relocating a card) animate as card
  transfers (FLIP between rects) with VFX chosen by the event's
  cause (effectKind/sourceId). Never teleport.
- Animations are best-effort and bounded: a missing anchor or timeout
  advances the walk without changing the sequence's ORDER.
