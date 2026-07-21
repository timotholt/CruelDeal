# Phase 5 Slice 1 — Shared Card Rendering

Date: 2026-07-20

Status: COMPLETE

Next active slice: Phase 5 board sizing

## Delivered

- `CardFace` is the canonical renderer for board, hand, and pile card faces.
- `BoardCard` and `HandCard` remain small zone adapters that own interaction,
  visibility, refs, drag metadata, and resting geometry.
- `PileViewer` retains its compact pile layout while consuming the same face
  model and the same spell-stat rule.
- The inspector continues to clone the canonical board/hand DOM, so it does
  not maintain a competing face implementation.
- Persistent text-disabled VFX reconciliation moved with the canonical play
  face; no second registry or compatibility path was added.
- Spell cards use the planned lollipop silhouette through a surface-only CSS
  clip. Their 5:7 bounding box, slot dimensions, refs, and transforms are
  unchanged, and power remains absent from both play and pile faces.

## Animation and geometry proof

The extraction adds no wrapper around the direct children of `.card`.
`CardVfxStack` remains a transparent fragment, and the architecture fence
requires board/hand adapters to keep their drag source and stable outer card
elements. The spell rule is forbidden from setting width, height, transform,
or transition. Therefore rect capture, drag hit testing, transfer flight,
reveal apex/hold, landing rotation, and inspector cloning retain their existing
coordinate space and timing.

## Verification

- Play/presentation gate: 28 files, 125 tests green.
- Focused face/pile/motion/drag gate: 5 files, 29 tests green after the spell
  surface rule.
- Touched-scope ESLint: green with no warnings.
- Production build: green.
- `git diff --check`: green.

## Exit decision

The shared-card-rendering slice is complete and independently reviewable. The
next Phase 5 commit may change board sizing ownership without reopening card
face, drag, or animation behavior.
