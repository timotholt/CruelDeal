# Cruel Deal — Project Overview

Cyberpunk-themed collectible card game (CCG). Marvel Snap-style: 3 lanes, 6 turns, 12-card decks. Rebranded from "Galactic Snap". Single-page app + pure game engine.

## Tech Stack
- **Framework**: SolidJS (not React) — `solid-js`, `@tanstack/solid-router`, `@tanstack/solid-query`
- **Build**: Vite 6, TypeScript ~5.8, ES2022
- **Styling**: Tailwind CSS v4
- **Animation/VFX**: PixiJS 7.4, Motion One (`@motionone/solid`)
- **Audio**: Howler 2.2
- **AI**: Google GenAI (`@google/genai`)
- **Testing**: Vitest 4 + jsdom
- **Linting**: ESLint 9 with TypeScript + solid-js plugins
- **Path alias**: `@/*` → project root

## Key Directories
```
cards/           individual card definitions (TS)
components/      SolidJS UI components
  board/         lane/grid rendering
  card/          card display
  deck/          deck editor UI
  game/          in-game HUD, overlays
  inspector/     detail overlays
  navigation/    nav bars
  progression/   XP/reward UI
  screens/       top-level page screens
contexts/        SolidJS contexts (User, UI, Game, PlayGame)
hooks/           custom SolidJS hooks
services/
  api/           mock backend (mockDb, services per domain)
  playgame/
    engine/      PURE game engine (no framework deps, deterministic)
    presentation/ animation choreography
    script/      high-level action flows
  engine/        legacy engine (being migrated)
  ai.ts          AI opponent
  audio.ts       Howler wrapper
  effects.ts     VFX
utils/           asset helpers, card styles, id gen
config/          sources, spatial map
locales/         i18n (en.ts)
types/           shared TS types
```
