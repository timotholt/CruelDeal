// Font manager — the single source of truth for game fonts.
//
// Fonts are startup assets, not runtime events. Every family/weight the game
// renders is declared in FONT_REGISTRY, bundled via the @fontsource imports
// below, and loaded to completion by loadGameFonts() before the app mounts.
// Nothing downstream (GameText included) is allowed to react to late font
// arrival — after the boot gate resolves, font metrics are invariant.
//
// The @font-face declarations and the registry live in this one file so a
// registry entry without a matching import (or vice versa) is visible in a
// single diff.

import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-400-italic.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-500-italic.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-600-italic.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-sans/latin-700-italic.css';
import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-400-italic.css';
import '@fontsource/ibm-plex-sans-condensed/latin-500.css';
import '@fontsource/ibm-plex-sans-condensed/latin-500-italic.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600-italic.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700-italic.css';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-400-italic.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-500-italic.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-600-italic.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-400-italic.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-500-italic.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-600-italic.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-700-italic.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/unica-one/latin-400.css';

type GameFontStyle = 'normal' | 'italic';

interface GameFontDefinition {
  weights: readonly number[];
  styles: readonly GameFontStyle[];
  sample: string;
}

export const FONT_REGISTRY = {
  'IBM Plex Sans': { weights: [400, 500, 600, 700], styles: ['normal', 'italic'], sample: 'BESbswy' },
  'IBM Plex Sans Condensed': { weights: [400, 500, 600, 700], styles: ['normal', 'italic'], sample: 'BESbswy' },
  'Barlow Condensed': { weights: [400, 500, 600, 700], styles: ['normal', 'italic'], sample: 'BESbswy' },
  'JetBrains Mono': { weights: [400, 500, 600, 700], styles: ['normal', 'italic'], sample: 'BESbswy' },
  Inter: { weights: [400, 500, 600, 700], styles: ['normal'], sample: 'BESbswy' },
  'Unica One': { weights: [400], styles: ['normal'], sample: 'BESbswy' },
} as const satisfies Record<string, GameFontDefinition>;

export type GameFontFamily = keyof typeof FONT_REGISTRY;

let loadPromise: Promise<void> | undefined;

const fontDescriptor = (family: string, weight: number, style: GameFontStyle) =>
  `${style} ${weight} 16px "${family}"`;

const faceKey = (family: string, weight: string | number, style: string) =>
  `${family.replace(/^["']|["']$/g, '')}|${weight}|${style}`;

const registeredFaceKeys = () => {
  const keys = new Set<string>();
  document.fonts.forEach((face) => {
    keys.add(faceKey(face.family, face.weight, face.style));
  });
  return keys;
};

const requiredFaces = () => Object.entries(FONT_REGISTRY).flatMap(([family, definition]) =>
  definition.styles.flatMap((style) =>
    definition.weights.map((weight) => ({
      family,
      weight,
      style,
      sample: definition.sample,
    })),
  ),
);

const waitForRegisteredFaces = async () => {
  const faces = requiredFaces();
  const deadline = Date.now() + 3000;

  while (Date.now() < deadline) {
    const registered = registeredFaceKeys();
    if (faces.every(({ family, weight, style }) => registered.has(faceKey(family, weight, style)))) {
      return faces;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  const registered = registeredFaceKeys();
  const missing = faces
    .filter(({ family, weight, style }) => !registered.has(faceKey(family, weight, style)))
    .map(({ family, weight, style }) => `${family} ${weight} ${style}`);
  throw new Error(`[fontManager] Font-face CSS did not register: ${missing.join(', ')}`);
};

/**
 * Boot gate. Awaited once before the Solid root mounts; idempotent afterwards.
 * Resolves when every registered family/weight face is usable, so no text
 * component can ever render with fallback-font metrics.
 */
export const loadGameFonts = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = (async () => {
      if (!document.fonts?.load) return;
      // In Vite development, CSS imports are injected as style elements. Their
      // modules may have executed before the browser exposes the @font-face
      // rules through FontFaceSet, so wait for registration before requesting
      // any face. Calling fonts.load() too early resolves with an empty result.
      const faces = await waitForRegisteredFaces();
      await Promise.all(
        faces.map(({ family, weight, style, sample }) =>
          document.fonts.load(fontDescriptor(family, weight, style), sample),
        ),
      );
      const unavailable = faces.filter(({ family, weight, style, sample }) =>
        !document.fonts.check(fontDescriptor(family, weight, style), sample));
      if (unavailable.length) {
        throw new Error(`[fontManager] Font faces failed to load: ${unavailable
          .map(({ family, weight, style }) => `${family} ${weight} ${style}`)
          .join(', ')}`);
      }
    })();
  }
  return loadPromise;
};

/** First concrete family name out of a CSS font-family list. */
const primaryFamily = (fontFamily: string) =>
  fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');

const GENERIC_FAMILIES = new Set([
  'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'cursive', 'fantasy',
]);

const numericWeight = (weight: number | string) => {
  if (typeof weight === 'number') return weight;
  if (weight === 'normal') return 400;
  if (weight === 'bold') return 700;
  const parsed = Number.parseInt(weight, 10);
  return Number.isFinite(parsed) ? parsed : 400;
};

export const resolveGameFontFace = (
  fontFamily: string,
  fontWeight: number | string,
  fontStyle: GameFontStyle,
) => {
  const family = primaryFamily(fontFamily);
  const definition = FONT_REGISTRY[family as GameFontFamily];
  if (!definition) return { fontWeight, fontStyle };

  const requestedWeight = numericWeight(fontWeight);
  const resolvedWeight = definition.weights.reduce((nearest, candidate) =>
    Math.abs(candidate - requestedWeight) < Math.abs(nearest - requestedWeight) ? candidate : nearest);
  const resolvedStyle = (definition.styles as readonly GameFontStyle[]).includes(fontStyle) ? fontStyle : 'normal';
  return { fontWeight: resolvedWeight, fontStyle: resolvedStyle };
};

/**
 * Dev-mode tripwire. A component that renders game text calls this on mount;
 * an unregistered or unloaded font is an instant loud error pointing at the
 * registry — never silently-wrong measurements.
 */
export const assertFontReady = (
  fontFamily: string,
  fontWeight: number | string = 400,
  fontStyle: GameFontStyle = 'normal',
): void => {
  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
  const family = primaryFamily(fontFamily);
  if (GENERIC_FAMILIES.has(family)) return;
  if (!(family in FONT_REGISTRY)) {
    throw new Error(`[fontManager] "${family}" is not in FONT_REGISTRY. Register and bundle it in services/fontManager.ts.`);
  }
  const definition = FONT_REGISTRY[family as GameFontFamily];
  const resolved = resolveGameFontFace(fontFamily, fontWeight, fontStyle);
  const descriptor = fontDescriptor(family, Number(resolved.fontWeight), resolved.fontStyle);
  if (document.fonts?.check && !document.fonts.check(descriptor, definition.sample)) {
    throw new Error(`[fontManager] "${descriptor}" is registered but not loaded. Was loadGameFonts() awaited before mounting the app?`);
  }
};
