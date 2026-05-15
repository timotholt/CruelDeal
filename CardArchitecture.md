# Card Architecture

## Goal

Cards must have one source of truth. Runtime code, decks, docs, and generated module indexes should not duplicate card facts such as names, stats, rules text, or token identities.

The canonical card record is:

```text
services/playgame/engine/manifest/card-sets/core-v1/cards/<defId>/card.json
```

Everything else either references a `defId` or is generated from those card JSON files.

## Ownership Boundaries

### Canonical Content

Each `card.json` owns:

- `defId`
- `name`
- `cosmetic.displayName`
- `cost`
- `basePower`
- `cardType`
- `abilities`
- user-facing card rules/flavor/art metadata

The folder name must match `defId`.

```text
cards/drone-pilot/card.json -> { "defId": "drone-pilot", ... }
```

### Generated Content

`services/playgame/engine/manifest/card-sets/core-v1/cards.generated.ts` is generated only.

Do not edit it by hand. It exists because Vite/browser builds need static JSON imports. Regenerate it after adding, deleting, or renaming card folders.

### References

Decks, locations, tests, and effects should reference cards by `defId` only:

```ts
{ defId: 'drone-pilot' }
```

They should not duplicate card name, cost, power, type, or rules text. When a UI needs those fields, it should resolve the `defId` through the manifest.

Debug decks are allowed to be authored by hand, but only as ID lists plus deck metadata. Pretty deck sheets and card lists should be generated snapshots, not runtime truth.

### Runtime

Engine code consumes a `Manifest`; it should not import card JSON directly. Manifest bootstrap owns content assembly, and engine functions stay parameterized by manifest data.

## Commands

Regenerate the static module index:

```bash
npm run cards:generate
```

Check whether generated files are stale:

```bash
npm run cards:generate:check
```

Validate the active card set:

```bash
npm run cards:validate
```

Validation checks:

- every active card module is well-formed
- folder name matches `defId`
- `cards.generated.ts` is current
- `DEF_ID_LIST` card references point to existing cards
- `COPY_OF_DEF` card references point to existing cards
- `REPLACE_LOCATION` references point to existing locations
- debug deck entries point to existing cards

Rename a card identity:

```bash
npm run cards:rename -- <old-defId> <new-defId>
```

Example:

```bash
npm run cards:rename -- drone-printer drone-pilot
```

The rename command:

- moves the card folder
- updates the card's `defId`
- updates exact active JSON references to the old `defId`
- updates exact active TypeScript string references in debug decks, manifest content, and presentation fixtures
- regenerates `cards.generated.ts`

It does not infer display names. After an identity rename, edit the renamed card's `name` and `cosmetic.displayName` intentionally if the user-facing name also changed.

## Change Workflow

### Edit A Card

1. Edit only `cards/<defId>/card.json`.
2. Run `npm run cards:validate`.
3. Run focused gameplay tests when behavior changed.

### Add A Card

1. Create `cards/<new-defId>/card.json`.
2. Run `npm run cards:generate`.
3. Add it to decks or pools by `defId` only.
4. Run `npm run cards:validate`.
5. Run `npm run build`.

### Rename A Card Identity

1. Run `npm run cards:rename -- <old-defId> <new-defId>`.
2. Edit `name` and `cosmetic.displayName` if needed.
3. Run `npm run cards:validate`.
4. Run `rg "<old-defId>|Old Display Name"` to catch historical docs or deprecated archives if the change should be global.
5. Run `npm run build`.

### Update Decks

Deck source may remain hand-authored, but deck card entries must stay ID-only. If a deck document needs names/stats/rules, generate it from the manifest instead of duplicating those fields manually.

## Non-Goals

Deprecated archives under `card-sets/deprecated/` are not active truth and are not part of validation. They may retain historical names and IDs unless a migration explicitly targets them.

Design documents under `documents/` are supporting material. They should not be used by runtime or validation as authoritative card content.
