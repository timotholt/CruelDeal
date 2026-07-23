# Card-back asset pipeline

This dependency-free Node script uses the system `ffmpeg` binary for decoding
and encoding. Pixel classification, card detection, rectification, mask
morphology, and preview compositing are implemented in `build.mjs`.

Run from the repository root:

```sh
node scripts/card-backs/build.mjs
```

Override either source without editing the script:

```sh
CARD_BACK_IVORY=/path/to/ivory.png \
CARD_BACK_ONYX=/path/to/onyx.png \
node scripts/card-backs/build.mjs
```

## Runtime assets

- `scg-back-onyx.png`: aligned 5:7 onyx base artwork.
- `scg-back-ivory.png`: aligned 5:7 ivory base artwork.
- `scg-back-gold-mask.png`: white reflection gate with confidence stored in its
  alpha channel. More opaque pixels reflect more strongly.

The mask intentionally overcovers gold edges slightly. It is meant to gate an
additive or screen-blended reflection above the baked base, not replace gold in
the artwork. Use the same mask for both colorways.

## Debug assets

- `debug-gold-mask-overlay.png`: magenta mask overlay on the onyx base.
- `preview-*-reflection*.png`: four-layer reference composites containing the
  base, a static upper-right key light, the baked gold material, and a masked
  sample reflection.
- `manifest.json`: source paths, detected crop, dimensions, and build settings.

The PNG bases and mask are `1000x1400`. At runtime, stack the base image, a
masked static gold response, a directional-light gradient, and the moving
reflection in one clipped 5:7 card container. Apply
`scg-back-gold-mask.png` to both gold-only layers.
