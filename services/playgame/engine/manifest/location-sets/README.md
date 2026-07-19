# Location Set Authoring

Active locations are authored as one complete JSON definition per folder:

```text
core-v1/locations/<def-id>/location.json
```

`poolOrder` is authoritative because seeded location selection depends on
manifest insertion order. Keep it unique and contiguous. `status` controls
whether a definition is drawable (`playable`), disabled (`unimplemented`), or
engine-owned and non-drawable (`system`).

After editing or adding a location, run:

```sh
npm run locations:generate
npm run locations:generate:check
npm run locations:validate
```

The generated TypeScript index is the only active static import registry. Do
not import content from `deprecated/`.
