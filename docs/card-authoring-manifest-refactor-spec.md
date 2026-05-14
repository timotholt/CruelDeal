# Card Authoring Manifest Refactor Spec

## Goal

Replace the monolithic `cyberpunk-cards.ts` card catalog with a phone-friendly, per-card authoring system that can be safely edited by Tim, Codex, Claude, or another agent without opening a laptop.

The system must:

- Make one card equal one small editable file.
- Keep the engine consuming one normalized `Manifest`.
- Quarantine old/deprecated card experiments so they do not confuse active game content.
- Validate cards before they can enter `/play`.
- Keep authored card files friendly to mobile editing and agent-driven edits.

## Current State

Active card content used to come from:

```txt
services/playgame/engine/manifest/content/cyberpunk-cards.ts
```

The manifest is assembled in:

```txt
services/playgame/engine/manifest/bootstrap.ts
services/playgame/engine/manifest/card-loader.ts
```

There was an older per-card JSON structure:

```txt
services/playgame/engine/manifest/cards/<card-id>/card.json
```

That structure is not loaded anymore. `card-loader.ts` explicitly says the old JSON cards are retained but no longer loaded.

There was also deprecated card content in:

```txt
services/playgame/engine/manifest/archive/cards.ts
```

## Decision

Use per-card JSON files as the primary authoring format.

JSON is not the prettiest authoring format, but it is the best first step because:

- It already exists in the repo.
- It is easy for agents to create and modify.
- It is easy to validate.
- It can be edited from a phone in GitHub, Working Copy, a mobile editor, or a lightweight web UI.
- It avoids executable content in card files.

YAML may become a later authoring layer, but it should not be the first migration.

## New Folder Layout

```txt
services/playgame/engine/manifest/
  card-sets/
    core-v1/
      set.json
      cards/
        clean-operator/
          card.json
        backchannel-contact/
          card.json
        debt-collector/
          card.json
    deprecated/
      legacy-json-demo/
        cards/
          sentinel/card.json
          ...
      cyberpunk-monolith/
        cyberpunk-cards.ts
        README.md
    experiments/
      README.md
```

### Active Set

`card-sets/core-v1` is the only active launch set for now.

`set.json`:

```json
{
  "setId": "core-v1",
  "displayName": "Core V1",
  "status": "active",
  "cardsPath": "cards",
  "notes": "Primary 3-lane MVP card set."
}
```

### Deprecated Content

Deprecated content must stay physically separated from the active loader path.

Moved:

```txt
services/playgame/engine/manifest/cards/*
```

to:

```txt
services/playgame/engine/manifest/card-sets/deprecated/legacy-json-demo/cards/*
```

Moved:

```txt
services/playgame/engine/manifest/archive/cards.ts
```

to:

```txt
services/playgame/engine/manifest/card-sets/deprecated/legacy-ts-archive/cards.ts
```

Moved after migration:

```txt
services/playgame/engine/manifest/content/cyberpunk-cards.ts
```

to:

```txt
services/playgame/engine/manifest/card-sets/deprecated/cyberpunk-monolith/cyberpunk-cards.ts
```

Only do this after `core-v1/cards/*/card.json` fully replaces it.

## Card File Shape

Each active card file is one complete `CardDef`.

```txt
card-sets/core-v1/cards/clean-operator/card.json
```

```json
{
  "defId": "clean-operator",
  "version": 1,
  "name": "Clean Operator",
  "basePower": 2,
  "cost": 1,
  "tribes": ["operator"],
  "abilities": {
    "onReveal": []
  },
  "cosmetic": {
    "displayName": "CLEAN OPERATOR",
    "flavorText": "",
    "rulesText": "",
    "keywords": [],
    "accent": "#6cc3ff",
    "frame": "common",
    "art": {
      "portrait": {
        "path": ""
      }
    }
  }
}
```

Rules:

- Folder name should match `defId`.
- `defId` uses kebab-case.
- `displayName` is the card title shown in game.
- `name` is human-readable title case.
- `rulesText` is player-facing text.
- `abilities` is the engine DSL.
- Empty/no-ability cards use `"abilities": {}` and may have empty `rulesText`.
- Cards with abilities must have non-empty `rulesText`.
- `version` increments when behavior, cost, power, text, or art path changes.

## Loader Refactor

Replace the old monolith loader with a real set loader.

New files:

```txt
services/playgame/engine/manifest/card-set-loader.ts
services/playgame/engine/manifest/card-sets/core-v1/cards.generated.ts
```

Because `/play` builds through Vite but the manifest tests and card validator run through `tsx`, the first implementation should use a generated static import index instead of `import.meta.glob`.

```txt
card-sets/core-v1/cards.generated.ts
```

The loader should:

- Read every card exported by the active set's generated index.
- Validate each card.
- Ensure folder name matches `defId`.
- Ensure no duplicate `defId`.
- Return `Record<string, CardDef>`.
- Exclude deprecated and experiment sets unless explicitly requested.

`bootstrap.ts` should become:

```ts
import { loadActiveCards } from './card-set-loader';

export const BOOTSTRAP_MANIFEST: Manifest = {
  ...
  cards: loadActiveCards(['core-v1']),
  ...
};
```

## Validation

Add a validation script:

```txt
services/playgame/engine/manifest/validate-cards.ts
```

Add package script:

```json
{
  "scripts": {
    "cards:validate": "tsx services/playgame/engine/manifest/validate-cards.ts"
  }
}
```

Validation should check:

- JSON parses.
- Shape satisfies `CardDef`.
- Folder name equals `defId`.
- No duplicate ids.
- Cost is `0..6`.
- `basePower >= 0`.
- `version >= 1`.
- `cosmetic.displayName` exists.
- Cards with abilities have `cosmetic.rulesText`.
- `cosmetic.art.portrait.path` is either empty or starts with `/art/cards/`.
- Ability DSL expressions are structurally valid.
- No deprecated cards are loaded into active manifest.

The existing `manifest.test.ts` should remain, but card validation should become a fast standalone authoring command.

## Phone Authoring Workflow

The target workflow:

1. Create or edit:

   ```txt
   services/playgame/engine/manifest/card-sets/core-v1/cards/<def-id>/card.json
   ```

2. Commit from phone or ask an agent:

   ```txt
   "Add a 2-cost disruptor card in core-v1. Use existing DSL only."
   ```

3. Agent edits only one card folder.

4. Agent runs:

   ```sh
   npm run cards:validate
   npm run build
   ```

5. If validation passes, the card is available in `/play`.

## Agent Rules For Card Creation

When Codex/Claude creates a card:

- Create exactly one folder per new card.
- Do not edit engine code unless the requested card needs an unsupported primitive.
- If a requested ability is unsupported, create a vanilla placeholder and add `TODO_UNSUPPORTED_ABILITY` in a separate notes field only if the schema allows it.
- Prefer existing ability DSL atoms.
- Keep `rulesText` honest to actual implemented behavior.
- Do not add deprecated cards to active sets.
- Do not resurrect `cyberpunk-cards.ts`.

## Migration Plan

### Phase 1: Establish Structure

- Add `card-sets/core-v1`.
- Add `card-sets/deprecated`.
- Add `card-sets/experiments`.
- Move old `manifest/cards/*` into `deprecated/legacy-json-demo`.
- Move `archive/cards.ts` into `deprecated/legacy-ts-archive`.
- Keep `cyberpunk-cards.ts` temporarily active only until the generated JSON set is verified.

### Phase 2: Build Loader

- Implement `card-set-loader.ts`.
- Load active set cards through `import.meta.glob`.
- Update `bootstrap.ts` to use the new loader.
- Add validation script.
- Update manifest tests.

### Phase 3: Migrate Cyberpunk Cards

- Convert every card in `cyberpunk-cards.ts` into:

  ```txt
  card-sets/core-v1/cards/<def-id>/card.json
  ```

- Preserve:
  - `defId`
  - cost
  - basePower
  - rules text
  - ability DSL
  - accent/frame/art values

- Run validation after every batch.
- Compare manifest card count before/after.

### Phase 4: Deprecate Monolith

- Move `content/cyberpunk-cards.ts` into `deprecated/cyberpunk-monolith`.
- Delete the old `card-loader.ts` if it is replaced.
- Ensure active loader does not import anything from deprecated folders.
- Add a README to deprecated folders explaining they are not loaded.

### Phase 5: Optional Authoring Helpers

Later, add:

```txt
npm run cards:new -- --id clean-operator --cost 1 --power 2
npm run cards:list
npm run cards:find -- clean
```

This can generate starter JSON for phone/agent workflows.

## Non-Goals

- Do not build a full card editor UI yet.
- Do not redesign the ability DSL in this migration.
- Do not convert locations yet.
- Do not make deprecated cards selectable in `/play`.
- Do not introduce YAML until JSON workflow is proven.

## Success Criteria

- Active `/play` cards are no longer authored in one monolithic TS file.
- A new card can be added by creating one `card.json` folder.
- Deprecated card junk is physically separated from active content.
- `npm run cards:validate` catches malformed card files.
- `npm run build` passes.
- `BOOTSTRAP_MANIFEST.cards` is still the single runtime registry consumed by the engine and UI.
