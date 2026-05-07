# CSS Card VFX Effect Catalog

## Purpose

Define the reusable card-local visual effects that can be rendered inside the
CSS Card VFX Wrapper Stack.

The wrapper stack answers "how do simultaneous CSS animations compose?" This
catalog answers "what effects can a persistent/ongoing layer render?"

These effects are presentation vocabulary only. They do not imply gameplay
rules. A card can be visually burning without the engine having a literal
`BURNING` status, and a gameplay status can choose a different visual skin.

## Effect Shape

Each persistent visual source should resolve to a small effect descriptor:

```ts
type CardPersistentFxKind =
  | 'fire'
  | 'ice'
  | 'acid'
  | 'electric'
  | 'poison'
  | 'barrier'
  | 'glitch'
  | 'void'
  | 'overclock'
  | 'stealth'
  | 'holy'
  | 'bleed';

type CardPersistentFxSource = {
  id: string;
  sourceId: string;
  kind: CardPersistentFxKind;
  intensity?: number;      // default 1, visual range roughly 0.25-3
  priority?: number;       // higher survives aggregation first
  palette?: {
    primary: string;
    secondary?: string;
    accent?: string;
  };
};
```

The renderer may turn each source into its own nested ongoing wrapper, or group
several sources into one aggregated persistent wrapper.

## Effect Module Layout

Each effect must live in its own source module. Do not implement the catalog as
one giant switch or one giant effects file.

Target shape:

```txt
services/vfx/card-effects/
  index.ts
  types.ts
  effects/
    fire.ts
    ice.ts
    acid.ts
    electric.ts
    poison.ts
    barrier.ts
    glitch.ts
    void.ts
    overclock.ts
    stealth.ts
    holy.ts
    bleed.ts
```

If the implementation is plain JavaScript instead of TypeScript, keep the same
one-effect-per-file shape with `.js` files. In this repo, `.ts` source modules
are acceptable because they compile to JavaScript, but the ownership rule is the
same: one visual effect per module.

Each effect module owns:

- default palette;
- default CSS class names;
- CSS variable normalization;
- same-kind aggregation behavior;
- optional application/exit cue metadata;
- render-mode preference for `single`, `stacked`, `aggregated`, or
  `prioritized`.

Example module contract:

```ts
export const fireCardFx: CardFxDefinition = {
  kind: 'fire',
  defaultPalette: {
    primary: '#ff6a1a',
    secondary: '#ffcf5a',
    accent: '#7a1200',
  },
  className: 'card-fx-fire',
  aggregate(sources) {
    return {
      renderMode: sources.length <= 2 ? 'stacked' : 'aggregated',
      vars: {
        '--card-fx-count': String(sources.length),
        '--card-fx-intensity': String(sumIntensity(sources)),
      },
    };
  },
};
```

`index.ts` is only a registry:

```ts
export const cardFxDefinitions = {
  fire: fireCardFx,
  ice: iceCardFx,
  acid: acidCardFx,
  // ...
} satisfies Record<CardPersistentFxKind, CardFxDefinition>;
```

The lifecycle registry resolves `visualKind` through this definition registry.
It should not know the internal visual rules for fire, ice, acid, or any other
effect.

## Shared CSS Variables

All persistent card effects should prefer a shared variable contract:

```css
--card-fx-intensity: 1;
--card-fx-count: 1;
--card-fx-primary: #ffffff;
--card-fx-secondary: transparent;
--card-fx-accent: transparent;
--card-fx-speed: 1;
--card-fx-opacity: 1;
--card-fx-seed: 0;
```

Effect-specific classes can derive animation duration, glow size, and opacity
from those variables. This makes aggregation possible without inventing a new
CSS class for every count.

## Persistent Effects

### Fire

Visual meaning: heat, burn, rage, volatility, sacrifice.

CSS strategy:
- Warm border glow.
- Upward shimmer on `::before`.
- Small edge tongues using repeating radial/linear gradients.
- Optional periodic brightness pulse.

Layer notes:
- Good as an ongoing aura or damage-over-time visual.
- Avoid full-card orange wash; keep card text readable.
- Multiple fire sources aggregate well by increasing `--card-fx-intensity` and
  flame height rather than adding many separate fire wrappers.

### Ice

Visual meaning: frozen, slowed, locked, preservation, stasis.

CSS strategy:
- Cool cyan edge frost.
- Diagonal crystalline highlight lines.
- Subtle desaturated overlay.
- Slow sparkle/flake glints on `::after`.

Layer notes:
- Ice should feel mostly still. Use slow animation and crisp edges.
- When stacked, add density/crack count before increasing motion.

### Acid

Visual meaning: corrosion, armor melt, power reduction, toxic tech.

CSS strategy:
- Green/yellow bubbling edge mask.
- Drip-like vertical shimmer.
- Irregular border erosion illusion through animated gradients.
- Brief surface sizzle on new application.

Layer notes:
- Acid can be visually noisy. Keep opacity capped.
- Multiple acid sources should aggregate into larger bubbles and stronger edge
  erosion, not many independent drips.

### Electric

Visual meaning: shock, overcharge, stun, chain effects, energy.

CSS strategy:
- Thin jagged outline flashes.
- Short high-contrast arcs using clipped pseudo-elements.
- Fast opacity bursts rather than continuous glow.
- Optional one-frame white/cyan flash on application.

Layer notes:
- Electric reads best as intermittent. Do not animate constantly at high
  opacity.
- Multiple electric sources can stagger arc timing with `--card-fx-seed`.

### Poison

Visual meaning: infection, decay, debuff, hidden cost.

CSS strategy:
- Muted green/purple haze.
- Slow breathing opacity.
- Soft stain-like gradients near lower corners.
- Optional tiny floating motes only if DOM budget allows.

Layer notes:
- Poison should be lower frequency than acid.
- Stacks by deepening haze color and expanding stain coverage.

### Barrier

Visual meaning: shield, armor, prevention, protection.

CSS strategy:
- Outer translucent shield outline.
- Hex/grid glints.
- Slow rotating or sweeping highlight.
- Strong impact ripple when damage is prevented.

Layer notes:
- Barrier is a persistent defensive state and should sit visually outside many
  surface effects, but inside impact shake.
- Multiple barriers can become layered rings or one thicker shield.

### Glitch

Visual meaning: hacked, copied text, disabled text, data corruption.

CSS strategy:
- RGB split shadows.
- Horizontal scanline jitter.
- Tiny clipped displacement strips.
- Occasional frame-skip flicker.

Layer notes:
- Use sparingly; too much glitch makes text unreadable.
- Glitch is a good candidate for prioritized stacking: copied text and disabled
  text may need different colors but should share one glitch wrapper if both
  are active.

### Void

Visual meaning: banish, silence, nullify, antimatter, missing data.

CSS strategy:
- Dark/violet inward shadow.
- Subtle edge collapse pulse.
- Low-opacity star/noise specks.
- Negative-space ring.

Layer notes:
- Keep mostly dark and calm until triggered.
- Multiple void sources aggregate with deeper inner shadow, not more motion.

### Overclock

Visual meaning: speed, extra energy, unstable power, machine heat.

CSS strategy:
- Amber/cyan racing edge lines.
- Fast diagonal scan.
- Micro scale pulse.
- Clock/tick-like border flashes.

Layer notes:
- Overclock can sit between persistent and power-pulse semantics.
- Persistent overclock uses edge lines; one-shot overclock uses `power-pulse`.

### Stealth

Visual meaning: hidden, evasive, untargetable, invisible.

CSS strategy:
- Low-opacity card fade.
- Refractive edge shimmer.
- Horizontal cloak sweep.
- Slight saturation reduction.

Layer notes:
- Must not hide power/cost readability.
- Multiple stealth effects probably aggregate only by duration/source count,
  not by making the card more transparent.

### Holy

Visual meaning: cleanse, restore, blessing, high-value protection.

CSS strategy:
- Gold/white soft ring.
- Gentle radial shine.
- Slow halo shimmer.
- Clean vertical light sweep on application.

Layer notes:
- Useful for healing/protection style effects.
- Stacks with barrier by color separation: barrier is structural blue, holy is
  soft gold/white.

### Bleed

Visual meaning: wound, vulnerability, damage taken, sacrifice cost.

CSS strategy:
- Crimson edge pulses.
- Downward streak accents.
- Short impact flash on application.
- Slow dark red breathing for persistent state.

Layer notes:
- Bleed is more organic than acid. Less bubbling, more pulse/streak.
- Stacks by increasing pulse amplitude and streak count.

## Stacking Rules

Persistent effects can be stacked in three ways.

### Same Kind

Same-kind sources should usually aggregate:

```txt
fire + fire + fire -> one fire layer with --card-fx-count: 3
```

This avoids unreadable duplicate motion.

### Compatible Kinds

Compatible kinds can render as nested wrappers in stable order:

```txt
barrier
  fire
    poison
      card-face
```

Use this for visually distinct effects that can coexist without muddying the
card.

### Conflicting Kinds

Conflicting kinds should use priority or visual blending:

```txt
ice + fire -> prioritized dominant layer + small secondary accent
glitch + stealth -> one shared distortion layer with mixed variables
acid + poison -> aggregated corrosion/toxic group
```

The persistent group owns those choices. Individual callers do not decide where
their wrapper appears.

## Default Persistent Order

Inside `persistent-fx`, render grouped effects in this order:

```txt
barrier
  holy
    void
      fire
        ice
          acid
            poison
              electric
                overclock
                  stealth
                    glitch
                      bleed
                        card-face
```

This is a starting point, not a law of nature. The intent is:
- protective shells sit outward;
- environment/material effects sit mid-stack;
- data/visibility effects sit closer to the face;
- wound/bleed accents sit close enough to read on the card body.

## CSS Budget

Initial budgets:

- Max 4 visible persistent wrappers per card before aggregation.
- Max 2 pseudo-elements per wrapper.
- Max 1 continuously animated expensive-looking effect per card.
- Prefer opacity/transform/custom-property keyframes.
- Avoid per-card DOM particles for persistent effects; use canvas for broad
  many-body effects.

If a card has more than 4 persistent visual sources, group by kind first, then
render the top-priority groups plus an aggregate remainder indicator.

## One-Shot Pairings

Persistent effects often have one-shot application beats:

| Persistent kind | One-shot application cue |
| --- | --- |
| `fire` | heat flash + quick upward flare |
| `ice` | snap-freeze glint + tiny scale lock |
| `acid` | sizzle flash + small recoil |
| `electric` | white/cyan shock flash + impact shake |
| `poison` | soft stain bloom |
| `barrier` | shield ripple |
| `glitch` | horizontal tear |
| `void` | inward pulse |
| `overclock` | fast edge scan + pop |
| `stealth` | cloak sweep |
| `holy` | vertical shine |
| `bleed` | red hit flash |

These one-shot cues belong in `surface-fx`, `impact-shake`, or `power-pulse`
depending on the event. The persistent aura remains in `persistent-fx`.

## Open Questions

- Which gameplay tags map to which visual kinds?
- Should card rarity/style skin modify the effect palette?
- How much should effects respect card art colors versus semantic colors?
- Do some locations apply location-themed persistent skins to all cards there?
