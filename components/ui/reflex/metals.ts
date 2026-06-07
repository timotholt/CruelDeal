/**
 * Canonical metal definitions — the SINGLE source of truth for every reflective
 * surface (KanIcon SVG hexes, reflective text, buttons, progress bars, lines,
 * and [gold]/[silver]/[brass]... rich-text tokens).
 *
 * Each metal is defined once here as a rich multi-stop gradient (the same detail
 * KanIcon's profiles carried). Both consumers read from this one place:
 *   - SVG: metalSvgStops(spec) → <stop offset color> array
 *   - CSS: injected to :root as --metal-<id>-gradient / --metal-<id>-highlight,
 *          which index.css .metal-* and rich-token rules reference.
 * Change a color here and the hex, the text, and the button all move together.
 */

export type MetalId = 'gold' | 'silver' | 'brass' | 'kan' | 'credit' | 'mark';

export interface MetalStop {
  offset: number; // 0..100
  color: string;
}

export interface MetalSpec {
  id: MetalId;
  stops: MetalStop[];
  highlight: string;
  /** Angle (deg) for the CSS linear-gradient mirror of the stop list. */
  angle: number;
}

const GOLD_STOPS: MetalStop[] = [
  { offset: 0, color: '#7C6535' },
  { offset: 8, color: '#997E47' },
  { offset: 26, color: '#B8A269' },
  { offset: 30, color: '#7C6535' },
  { offset: 34, color: '#FFFDDA' },
  { offset: 60, color: '#D5BB8A' },
  { offset: 81, color: '#B8A269' },
  { offset: 85, color: '#7C6535' },
  { offset: 93, color: '#FBECA9' },
  { offset: 100, color: '#7C6535' },
];

export const METALS: Record<MetalId, MetalSpec> = {
  gold: { id: 'gold', highlight: '#FFFDDA', angle: 135, stops: GOLD_STOPS },
  kan: { id: 'kan', highlight: '#FFFDDA', angle: 135, stops: GOLD_STOPS },
  silver: {
    id: 'silver',
    highlight: '#EBEFF5',
    angle: 135,
    stops: [
      { offset: 0, color: '#EBEFF5' },
      { offset: 25, color: '#B5B9BF' },
      { offset: 50, color: '#EDF1F7' },
      { offset: 75, color: '#83878D' },
      { offset: 100, color: '#CED2D8' },
    ],
  },
  brass: {
    id: 'brass',
    highlight: '#FFFDDA',
    angle: 135,
    stops: [
      { offset: 0, color: '#55411B' },
      { offset: 15, color: '#997E47' },
      { offset: 30, color: '#55411B' },
      { offset: 45, color: '#FFFDDA' },
      { offset: 60, color: '#D5BB8A' },
      { offset: 75, color: '#B8A269' },
      { offset: 85, color: '#55411B' },
      { offset: 100, color: '#FBECA9' },
    ],
  },
  mark: {
    id: 'mark',
    highlight: '#f3f4f6',
    angle: 135,
    stops: [
      { offset: 0, color: '#9CA3AF' },
      { offset: 25, color: '#4B5563' },
      { offset: 50, color: '#1F2937' },
      { offset: 75, color: '#111827' },
      { offset: 100, color: '#374151' },
    ],
  },
  credit: {
    id: 'credit',
    highlight: '#93c5fd',
    angle: 135,
    stops: [
      { offset: 0, color: '#1e3a8a' },
      { offset: 50, color: '#3b82f6' },
      { offset: 100, color: '#1d4ed8' },
    ],
  },
};

/** SVG <stop> array for a KanIcon linearGradient/radialGradient. */
export const metalSvgStops = (spec: MetalSpec) =>
  spec.stops.map((s) => ({ offset: `${s.offset}%`, color: s.color }));

/** CSS linear-gradient() string mirroring the same stop list. */
export const metalCssGradient = (spec: MetalSpec) =>
  `linear-gradient(${spec.angle}deg, ${spec.stops.map((s) => `${s.color} ${s.offset}%`).join(', ')})`;

/** KanIcon gradientProfile → canonical metal (the showcase profiles). */
export const PROFILE_TO_METAL: Partial<Record<string, MetalId>> = {
  J: 'gold',
  D: 'silver',
  G: 'brass',
  F: 'mark',
};

let injected = false;

/**
 * Write the canonical gradients/highlights to :root as CSS custom properties so
 * index.css metal classes can reference one source. Runs once, before paint.
 */
export const injectMetalVars = () => {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const root = document.documentElement.style;
  (Object.keys(METALS) as MetalId[]).forEach((id) => {
    const spec = METALS[id];
    root.setProperty(`--metal-${id}-gradient`, metalCssGradient(spec));
    root.setProperty(`--metal-${id}-highlight`, spec.highlight);
  });
};

// Inject at module load (before any component renders) so CSS vars are ready.
injectMetalVars();
