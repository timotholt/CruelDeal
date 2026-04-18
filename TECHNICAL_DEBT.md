# Galactic Snap - Technical Debt Registry

This document tracks intentional architectural shortcuts and "big components" that are currently deferred.

## 1. Data-Driven Ability Engine (Ability DSL) - [CRITICAL DEBT]
- **Status:** Hardcoded (In-Code Logic)
- **Current State:** Card effects are hardcoded TypeScript functions in `services/effects.ts`.
- **The "Debt":** Balancing the game requires a full app deployment. We cannot "hot-fix" a broken interaction or update a card's ability without an App Store update.
- **Future Requirement:** 
    - **Instruction Sets:** Move all logic into a JSON-based schema.
    - **The Interpreter:** Build a service that parses these instructions (e.g., `TARGET: "ENEMIES", STAT: "POWER", DELTA: -1`) and executes them against the `ActionSet`.
    - **Dynamic Sync:** The client should download a `card_definitions.json` manifest on every boot. This allows designers to change abilities server-side instantly.

## 2. Server-Side Source of Truth (SSOT)
- **Status:** Shortcut (Mock API)
- **Description:** Game engine runs client-side. 
- **Future Requirement:** Move `services/engine` to a Node.js/Go backend to prevent cheating and enable true multiplayer.

## 3. Multi-language Dynamic Content Authoring Tool (CMS)
- **Status:** Deferred
- **Description:** Server-side localizations for Inbox/News are currently mocked in `mockData.ts`.
- **Future Requirement:** A web-based UI for Live-Ops to author multi-language messages with scheduled release windows.

## 4. Persistent Database Layer
- **Status:** Shortcut (LocalStorage)
- **Description:** Progress is device-locked.
- **Future Requirement:** PostgreSQL/MongoDB with Proper Auth (Firebase/Auth0).

## 5. Asset CDN & Manifest Management
- **Status:** Hardcoded
- **Description:** Static URLs, aggressive preloading.
- **Future Requirement:** Support for Delta-patching and background downloading of high-res textures.
