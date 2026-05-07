# Top Bar Redesign Spec

## Goals

1. Keep the player's actionable energy at the bottom of the screen.
2. Redesign the top bar around opponent state and neutral match state.
3. Show enemy hidden information only as counts or card backs, never card faces.
4. Make both player portraits clickable entry points for public pile inspection.

## Layout

### Left

- Local player portrait anchored to the far left.
- Clicking the portrait opens a compact player-zone menu.

### Center

- A non-button turn orb.
- Orb only communicates turn state and does not invite interaction.

### Right

- Enemy hidden hand indicator.
- Enemy deck count.
- Enemy compact energy badge.
- Enemy portrait anchored to the far right.

The enemy cluster order is:

`hand backs -> deck count -> energy badge -> portrait`

## Components

### `EnergyBadge`

- Reusable compact resource display.
- Renders: number + SVG lightning bolt.
- No `current/max` mode.
- Used for enemy energy in the top bar and player energy in the bottom bar.

### `TurnOrb`

- Circular decorative status element.
- Shows small `TURN` label and large turn number.
- Not clickable.

### `HiddenHandIndicator`

- Shows `1-3` miniature card backs.
- If hand size is greater than `3`, still show only `3` backs.
- Always show the true count as a numeric badge beside the backs.

### `PlayerPortraitMenu`

- Opens when portrait is clicked.
- Contains buttons for:
  - `Discard`
  - `Destroyed`
  - `Banished`
- Each button shows the pile count.

### `PileViewer`

- Modal overlay for a single player's single zone.
- Displays cards from:
  - `DISCARD`
  - `DESTROYED`
  - `BANISHED`
- Cards in these zones are treated as public information.

## Data Rules

- All counts and piles come from the authoritative presented match state.
- In replay mode, the top bar reflects the selected replay frame.
- In live mode, the top bar reflects live engine state.
- Opponent hand is count-only.
- Opponent deck is count-only.
- Public terminal zones show actual cards for both players.

## Interaction Rules

- Clicking outside a portrait menu closes it.
- Clicking a pile button closes the menu and opens the pile viewer.
- Clicking outside the pile viewer closes it.
- Replay mode does not disable top-bar inspection because it is read-only.

## Out Of Scope

- Enemy draw animations in the top bar.
- Deck inspection contents.
- Hand inspection contents.
- Priority redesign beyond preserving a small portrait-level marker.
