# PlayGame Seat And Viewer Spec

## Goal

The `/play` stack should move to an absolute-seat engine plus a viewer-relative UI.

After reviewing:

- [contexts/PlayGameContext.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/contexts/PlayGameContext.tsx)
- [components/screens/play/PlayBoard.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/play/PlayBoard.tsx)
- [services/playgame/view.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/view.ts)
- [services/playgame/script/actions.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/script/actions.ts)
- [services/playgame/engine/types/ids.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/engine/types/ids.ts)

the current design is still "single local player vs enemy" in the UI and "`PLAYER`/`OPP`" in the engine. That works offline, but it is the wrong abstraction for multiplayer bootstrapping.

## Target Model

Use three separate concepts:

1. `Seat`
   Absolute match side in engine state. Replace `Owner = 'PLAYER' | 'OPP'` with `Seat = 'P0' | 'P1'`.
2. `localSeat`
   Which seat this client controls for this match.
3. `viewer relation`
   Derived in UI only, such as `local/remote` or `friendly/opposing`.

The engine should never care about `player` or `enemy`.

The UI should never guess who is local from engine seat names.

## What Needs To Change

### 1. Engine identity layer

In [services/playgame/engine/types/ids.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/engine/types/ids.ts), rename `Owner` to `Seat` and move to absolute values like `P0/P1`.

Add helpers such as:

- `otherSeat(seat)`
- `sameSeat(a, b)`

All engine state maps like `energy`, `deck`, `hand`, `lastPlayedBy`, lane card buckets, and events keep absolute seat keys.

### 2. PlayGame bootstrap contract

[contexts/PlayGameContext.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/contexts/PlayGameContext.tsx) should accept a boot payload, not invent the worldview internally.

New provider inputs:

- `initialState`
- `manifest`
- `localSeat`
- `seatMeta` such as display name/avatar per seat

`resetMatch()` can still create a local dev match, but it should also assign a `localSeat` explicitly.

### 3. View selectors

[services/playgame/view.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/view.ts) is currently viewpoint-baked with `getPlayerHand`, `getPlayerLaneCards`, `getEnemyLaneCards`.

Replace with seat-based selectors:

- `getHandForSeat(state, seat, manifest)`
- `getLaneCardsForSeat(state, laneIdx, seat, manifest)`
- `getLanePowerForSeat(state, laneIdx, seat, manifest)`

Add viewer helpers on top if useful:

- `getLocalHand(state, localSeat, manifest)`
- `getRemoteLaneCards(state, laneIdx, localSeat, manifest)`

### 4. PlayBoard layout and HUD

[components/screens/play/PlayBoard.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/play/PlayBoard.tsx) hardcodes:

- bottom row = `PLAYER`
- top row = `OPP`
- HUD left = `PLAYER`
- HUD right = `OPPONENT`
- local energy = `engineState.energy['PLAYER']`

Replace with:

- `bottomSeat = localSeat`
- `topSeat = otherSeat(localSeat)`
- HUD names, priority, and energy resolved from `seatMeta` and seat mapping

`playerPower/enemyPower` props should become `bottomPower/topPower` or `localPower/remotePower`.

### 5. Local interaction rules

[components/screens/play/useDragDrop.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/play/useDragDrop.ts) and [components/screens/play/BoardCard.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/play/BoardCard.tsx) assume only `'player'` side is interactive.

Change the rule to:

- only cards owned by `localSeat` are draggable, stageable, and undoable
- only the bottom row is droppable because it is the local seat's row

Face-down logic should be relation-based:

- unrevealed remote cards are always face-down
- unrevealed local cards are face-down only during resolution

### 6. Script and action layer

[services/playgame/script/actions.ts](/Users/timotholt/Projects/SolidJS-Galactic-Snap/services/playgame/script/actions.ts) is heavily hardcoded to `PLAYER` for draw, hand, and UI and `OPP` for auto-play.

Parameterize all of these by seat:

- local draw and deal actions use `localSeat`
- auto and AI actions use a passed seat, not `enemy`

Rename `enemyPlayRandom()` to something like `autoPlaySeat(seat)`.

### 7. Inspector and presentation naming

[components/screens/ZoomInspector.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/ZoomInspector.tsx), [components/screens/play/LaneSlots.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/play/LaneSlots.tsx), and [components/screens/play/LocationTile.tsx](/Users/timotholt/Projects/SolidJS-Galactic-Snap/components/screens/play/LocationTile.tsx) still use `player/enemy`.

Replace with view-relative naming:

- `top/bottom` for layout
- `local/remote` for interaction
- `friendly/opposing` for card relation if needed

### 8. Multiplayer boot/load path

When a multiplayer match loads, the server should send absolute seat assignments plus the client's `localSeat`.

Both clients receive the same match state.

Only `localSeat` differs between clients.

The UI derives `me vs them` from `localSeat`, not from engine state labels.

## Non-Goals

- Do not make the engine store `local`, `remote`, `player`, or `enemy`.
- Do not use `player[0]` and `player[1]` as keys. Use stable seat ids like `P0` and `P1`.

## Recommended Migration Order

1. Introduce `Seat` plus `localSeat` alongside current names.
2. Make `view.ts` selectors seat-based.
3. Convert `PlayGameContext` to carry `localSeat` and `seatMeta`.
4. Convert `PlayBoard` and play components to `top/bottom` plus `local/remote`.
5. Convert script and actions to seat-parameterized helpers.
6. Remove remaining `PLAYER/OPP` assumptions from `/play`.

## Summary

This is not a rename pass. It is a separation-of-concerns pass.

The engine should know absolute seats, and the client should know which seat is local.
