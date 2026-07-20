# Phase 1.5 Checkpoint 4D — Governed Play and Reveal

Status: complete

Date: 2026-07-19

Authority: `docs/playgame-transactional-rules-kernel-spec.md`

## Result

C4D is implemented and exit-proven.

Hand-origin play, natural reveal, On Reveal invocation, retrigger, created-card
reveal, deck deployment, card/location turn reactions, location reveal, and
played-here reactions now use the bounded reveal transaction and committed
semantic envelopes.

Private stage, unstage, and undo remain reaction-free. A precommit reveal
timing policy handles delayed-play locations without restoring the old
ambiguous staging trigger.

## Canonical Route

```text
PLAY_CARD
  -> CARD_REVEALED
  -> affected card natural On Reveal
  -> location onCardRevealedHere
  -> CARD_PLAY_COMPLETED
  -> other cards onAnyCardPlayedHere
  -> location onCardPlayedHere
  -> spell cleanup
```

`REVEAL_CARD` commits reveal semantics without hand-play semantics.
`INVOKE_ON_REVEAL` snapshots effective ability text and multiplier when the
invocation starts. Retriggering emits neither a fake reveal nor a fake
completed play.

Created lane cards and existing deck cards are different commands. Both reveal
through the ordinary reveal route after their placement transition, while only
new instances emit `CARD_CREATED`.

## Nested Queue

Sequences, conditionals, iteration, retriggers, deployment, and lane
create-and-reveal expand into ordered work on the parent depth-first queue.

The golden coverage proves:

- Wong-multiplied nested On Reveal;
- a Jubilee-style deck deployment that reveals the existing instance;
- a repeater that invokes earlier On Reveal text again;
- Drone Pilot creates a Drone, reveals it, runs its text, then resumes the
  parent;
- Security Detail and Riff Raff lower built-in token creation into the parent
  reveal queue;
- repeated creation stops at four lane slots;
- a created card with no text still commits `CARD_REVEALED`.

No evaluator recursion controls these production create/reveal chains.

## Delayed Reveal Policy

`REVEAL_TIMING_OVERRIDE` is a precommit operation policy. The stage resolver:

1. folds the staged card and energy spend into a private candidate;
2. evaluates policy selectors against the candidate destination lane;
3. emits `CARD_REVEAL_SCHEDULED` in the same command result.

The policy does not dispatch a gameplay reaction. Multiple policies choose the
latest timing deterministically. Stored timing follows a moved card and
survives later location replacement; unstage and undo clear it.

Cryobank now authors this policy. It no longer misuses
`onCardEnteredHere`, whose sole meaning is committed lane-to-lane movement.

## Production Content Reconciliation

- Cryobank uses `REVEAL_TIMING_OVERRIDE(END_OF_GAME)`.
- Gun Store uses `onCardPlayedHere` for hand plays and
  `onCardEnteredHere` for lane moves.
- Security Detail's Guards are face-up and execute their text if the Guard
  definition later gains On Reveal text.
- Riff Raff tokens follow the same created/revealed lifecycle.

## Proof

Focused coverage proves:

- stage may store a schedule but dispatches no entry reaction;
- unstage reverses the stored schedule;
- numeric timing policies use the latest turn;
- `END_OF_GAME` outranks every numeric turn;
- committed play and lane movement each trigger Gun Store exactly once;
- built-in created cards commit creation, reveal, On Reveal, and capacity
  behavior on the parent queue;
- natural reveal, suppression, retrigger, nested ordering, and spell cleanup
  retain exact committed event traces;
- no active `CARD_FLIPPED` producer or manual play/reveal trigger exists.

Canonical gate:

```bash
npm run verify:playgame:phase15
```
