# CSS Card VFX Wrapper Stack Spec

## Purpose

Use the browser's native CSS keyframe/compositor pipeline for card-local visual
effects before reaching for heavier particle systems.

The goal is not to combine many animations on one DOM element. CSS animation
shorthands and transform writes clobber each other too easily. Instead, the
card renderer should compose effects by nesting DOM wrappers: each active VFX
caller gets a layer that owns its own CSS animation property.

```txt
MatchEvent / VfxCue
  -> eventAnimator
  -> card VFX stack model
  -> nested DOM wrappers
  -> CSS keyframes on isolated layers
```

The engine remains visual-free. This is presentation-only.

This spec defines the composition architecture. The companion effect catalog
defines the persistent/ongoing visual vocabulary such as fire, ice, acid, and
glitch. See `docs/css-card-vfx-effect-catalog.md`.

The lifecycle spec defines how VFX records are created, tracked, exited, and
garbage-collected. See `docs/css-card-vfx-lifecycle-spec.md`.

## Core Idea

CSS is weak at additive animation on a single element, but the browser is good
at compositing nested transforms and opacity on separate elements.

Instead of:

```html
<div class="card" style="animation: buff, damage, shake">...</div>
```

render:

```html
<div class="card-vfx-layer world-motion">
  <div class="card-vfx-layer impact-shake">
    <div class="card-vfx-layer power-pulse">
      <div class="card-vfx-layer face-transform">
        <div class="card-vfx-layer surface-fx">
          <CardFace />
        </div>
      </div>
    </div>
  </div>
</div>
```

Each layer owns exactly one animation channel. Multiple simultaneous callers do
not fight over `style.animation`, `transform`, or `translate` on the same node.

## Layer Order

Start with this deterministic nesting order:

```txt
slot/layout anchor
  world-motion
    impact-shake
      interaction-pose
        power-pulse
          face-transform
            surface-fx
              persistent-fx
                card-face
```

### Layer Responsibilities

| Layer | Owns | Examples |
| --- | --- | --- |
| `slot/layout anchor` | Real DOM position from Solid/layout. Not a transient VFX wrapper. | Hand slot, lane slot. |
| `world-motion` | Macro card movement. | Draw slide, lane move FLIP, undo return, enemy fly-in. |
| `impact-shake` | Local full-card hit/recoil that rides inside world movement. | Damage shake, destroy impact, heavy On Reveal hit. |
| `interaction-pose` | User interaction pose. | Hover tilt, drag lift, selected card raise. |
| `power-pulse` | Local scale/pulse reactions. | Buff pulse, debuff pulse, power gain/loss emphasis. |
| `face-transform` | Face orientation. | Reveal flip, face-down/face-up turn. |
| `surface-fx` | Short-lived surface overlays. | Flash wash, scanline, glitch glint, outline hit. |
| `persistent-fx` | Persistent visual state groups. | Ongoing aura stack, status effects, copied-text marker. |
| `card-face` | The actual card content. | Name, art, cost, power, tags. |

Shake is intentionally a child of full-card movement. If a moving card is hit,
the shake should be local to the moving card rather than competing with the
movement transform.

## VFX Layer Model

Transient effects should be represented as layer records:

```ts
type CardVfxLayer = {
  id: string;
  cardId: string;
  channel:
    | 'world-motion'
    | 'impact-shake'
    | 'interaction-pose'
    | 'power-pulse'
    | 'face-transform'
    | 'surface-fx'
    | 'persistent-fx';
  className: string;
  vars?: Record<string, string>;
  durationMs?: number;
  startedAtMs?: number;
  priority?: number;
};
```

The renderer sorts layers by channel order, then priority, then creation order.
Transient layers are removed after `durationMs`. Persistent layers remain until
their source state changes.

## N Ongoing Effects

Persistent effect groups are first-class. A card with N ongoing effects should
not blindly create unreadable noise.

The `persistent-fx` layer may contain an internal stack model:

```ts
type PersistentFxGroup = {
  cardId: string;
  kind: 'ongoing' | 'status' | 'copied-text' | 'disabled-text';
  sources: readonly {
    sourceId: string;
    visualKind?: string;
    palette?: string;
    intensity?: number;
    priority?: number;
  }[];
};
```

The group owns how N effects stack visually. It can choose one of these render
strategies based on count and importance:

- `single`: one aura for one source.
- `stacked`: several nested/ring layers for small N, such as 2-4 effects.
- `aggregated`: one stronger aura with CSS variables like `--fx-count`,
  `--fx-intensity`, and `--fx-palette-mix`.
- `prioritized`: top K visible sources plus an aggregate remainder.

This means "6 ongoings" is not 6 unrelated callers fighting the card. It is one
ongoing group that understands how to stack, cap, aggregate, and remain legible.

The ongoing group may still render multiple internal DOM wrappers. The important
rule is ownership: the group, not each individual caller, decides whether N
sources become N wrappers, one aggregate wrapper, or a prioritized mix.

## Simultaneous Effects

For a card with six buffs, six ongoings, and enemy damage in the same beat:

1. `persistent-fx` updates the ongoing group state.
2. `power-pulse` receives a combined buff/debuff pulse if the power delta can
   be aggregated.
3. `impact-shake` receives the enemy hit reaction.
4. `surface-fx` receives flash/glitch/outline overlays.
5. `world-motion`, if present, remains outermost and carries all local effects.

The adapter may aggregate same-channel bursts before creating layers. For
example, six same-frame positive power changes can become one `power-pulse`
layer with `--fx-count: 6` and `--fx-delta-total: 8`.

## Requirements

- No gameplay mutation in the VFX stack.
- No direct writes to `style.animation` from card components.
- Every VFX caller goes through a stack manager or `eventAnimator`.
- Each active wrapper owns one CSS animation channel.
- Missing DOM targets must degrade to "dispatch only" or "skip VFX", never block
  gameplay.
- Layer order must be deterministic for replay/debug readability.
- Persistent groups own their own stacking logic for N sources.
- Card-local effects prefer CSS wrappers. Board-wide many-body effects can use
  canvas particles.

## CSS Constraints

- Prefer compositor-friendly properties: `transform`, `translate`, `scale`,
  `rotate`, `opacity`, and CSS variables consumed by keyframes.
- Avoid layout-affecting animation properties for in-flow card elements.
- Spatial overlay helpers may animate `left/top/width/height` only on temporary
  absolutely positioned flyers where the cost is bounded.
- Avoid stacking many opacity/filter layers that muddy readability.
- Transform order matters; changing layer order is a behavioral presentation
  change and should be visual-QA'd.

## Relationship To Existing Code

- `services/playgame/presentation/choreography.ts` should keep describing
  semantic animation intent.
- `services/playgame/presentation/eventAnimator.ts` should remain the bridge
  from event intent to presentation execution.
- `services/vfx/timeline.ts` can remain useful for a single layer's CSS
  schedule, but it should not be responsible for composing all effects on one
  card element.
- `services/vfx/animations/*` remain special spatial primitives for measured
  motion such as FLIP, deck slide, and reveal cinematic.
- `services/vfx/engine.ts` remains the canvas path for board-level particles.
- `docs/css-card-vfx-lifecycle-spec.md` defines registry ownership, transient
  cleanup, persistent reconciliation, and lifecycle failure handling.

## Open Design Questions

- Should persistent groups render as generated wrappers in Solid, pseudo-elements
  inside one wrapper, or both depending on count?
- Should hover/drag interaction be suppressed during cinematic resolution, or
  composed inside impact/motion?
- What is the cap for visible persistent source rings before aggregating?
- Should layer lifecycle be stored in Solid state, a tiny imperative registry,
  or a hybrid keyed by `cardId`?
