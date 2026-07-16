# Mission V2 R0 Conformance Proof

This directory records the deterministic full-screen comparison for the real
Mission Briefing renderer. The capture route is:

`/main-material?mission-proof=1`

Proof mode bypasses local storage, loads the canonical Mission source and
appearance fixture, renders the same `MainMaterialPreview` and
`MissionBriefingRuntime` used by the editor, disables motion, and removes the
workbench/inspector chrome. It is a capture seam, not a second renderer.

## Evidence

- `current-941x1672.png` — exact DPR 1 implementation capture.
- `target-current.png` — approved R0 target on the left, implementation on the
  right.
- `difference.png` — absolute pixel difference.
- `environment.json` — reproducible browser, viewport, route, and hashes.
- `dom-audit.json` — semantic counts and normalized Mission bounds.
- `metrics.json` — whole-screen SSIM and its interpretation.

The full-screen SSIM remains low because the repository does not contain the
standalone R0 blue server-room/hand/datablock artwork. The closest local image
is a different composition and is used only as an explicit proxy. The local
layout/compiler defects found by comparison are fixed: shell composition,
reproducible condensed font, layer background sizing/repeat, asymmetric panel
chamfer, top-only reward divider, fingerprint brackets, and the exact Mission
region/body/footer geometry.

M9 therefore remains failed until replacement background artwork is approved
or supplied. This proof intentionally does not hide that remaining delta.
