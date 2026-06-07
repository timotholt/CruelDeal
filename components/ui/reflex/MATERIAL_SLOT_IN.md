# Reflective Metal → Material System: slot-in contract

**Status:** design only. Nothing in `components/ui/reflex/` imports the material
system, and the material system is **not** modified yet. This doc is the
contract for when we wire reflective gold/silver/brass/etc into `Surface`.

## What the reflex module already publishes (the whole contract)

The material layer needs only two things, both already global, both already
maintained by the reflex module:

1. **Per-metal baked texture var** — `--metal-<id>-texture`
   - written to `:root` by `injectMetalVars()` → `publishMetalTextureVars()` in
     `components/ui/reflex/metals.ts`.
   - value: `url(data:image/png…)` — one baked canvas texture per metal
     (`gold | silver | brass | kan | credit | mark`), built from `METALS[id].stops`
     so it matches the icon/text exactly.
   - re-bake/tuning: `setMetalTextureOptions({ size, grain })` clears the cache
     and republishes the vars.

2. **Reflex direction vars** — `--reflex-gx` / `--reflex-gy` (−1..1)
   - written to `:root` once per rAF by `ReflexController` (deduped).

3. **The movement formula** — `metalSurfaceStyle(id, shiftPx?)` in `metals.ts`
   returns the exact `{ background-image, background-size, background-position }`
   the texture uses. This is the single source of the formula; the CSS rule
   below is just it written as static CSS.

That's it. No imports, no components, no coupling — the material layer reads
CSS vars the reflex module already sets.

## How `Surface` adopts it later (3 small edits, no reflex changes)

Insertion points confirmed against the current material code:

### 1. `components/ui/material-lab/Surface.tsx` — add one layer span
In `SurfaceBaseLayers`, between `cd-surface__texture` and `cd-surface__tint`:
```tsx
<Show when={props.metalSheen && props.metalSheen !== 'none'}>
  <span class="cd-surface__metal" aria-hidden="true" />
</Show>
```

### 2. `components/ui/material-lab/surfaceFeatures.ts` — flag + var
Mirror the existing `material`/`texture` layer pattern:
- add `metalSheen` to `SurfaceLayerFlags` + `surfaceLayerFlags()` (`true` when
  `options.metalSheen && options.metalSheen !== 'none'`).
- in `surfaceLayerEmissions()`: `if (flags.metalSheen) layers.push(surfaceLayerSpan('cd-surface__metal'));`
- in the style aggregation, set `--metal-sheen-texture: var(--metal-${options.metalSheen}-texture)`.
- `surfaceSchema.ts`: add `metalSheen?: MetalId | 'none'` to `SurfaceOptions`
  (import `MetalId` type from `components/ui/reflex`).

### 3. `src/styles/ui-material-lab.css` — the layer rule
This is `metalSurfaceStyle()` as static CSS:
```css
.cd-surface__metal {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background-image: var(--metal-sheen-texture);
  background-size: 180% 180%;
  background-position:
    calc(50% + var(--reflex-gx) * 60px)
    calc(50% + var(--reflex-gy) * 60px);
  mix-blend-mode: overlay; /* or normal for a solid metal face */
}
```

## Recipe flow (already supports it)
`MaterialRecipe` → `materialRecipeToResolvedSurface()` already passes options
through unchanged; add `metalSheen` to the recipe type + pass-through, then the
main-material editor can expose a metal picker. No reflex changes.

## Notes
- The icon (`KanIcon`) is the only surface that also needs the vector **bevel**;
  surfaces/text/buttons use the masked texture alone (+ their own border/emboss
  chrome). The texture layer is purely the *fill*.
- Same texture under every mask (glyphs / hexagon+K / rounded-rect) = true parity.
