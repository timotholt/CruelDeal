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
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-sans-condensed/latin-400.css';
import '@fontsource/ibm-plex-sans-condensed/latin-600.css';
import '@fontsource/ibm-plex-sans-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-400.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';

export const FONT_REGISTRY = {
  'IBM Plex Sans': { weights: [400, 500, 600, 700] },
  'IBM Plex Sans Condensed': { weights: [400, 600, 700] },
  'Barlow Condensed': { weights: [400, 600, 700] },
  'JetBrains Mono': { weights: [400, 700] },
} as const;

export type GameFontFamily = keyof typeof FONT_REGISTRY;

let loadPromise: Promise<void> | undefined;

/**
 * Boot gate. Awaited once before the React root mounts; idempotent afterwards.
 * Resolves when every registered family/weight face is usable, so no text
 * component can ever render with fallback-font metrics.
 */
export const loadGameFonts = (): Promise<void> => {
  if (!loadPromise) {
    loadPromise = (async () => {
      if (!document.fonts?.load) return;
      await Promise.all(
        Object.entries(FONT_REGISTRY).flatMap(([family, def]) =>
          def.weights.map((weight) => document.fonts.load(`${weight} 16px "${family}"`)),
        ),
      );
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

/**
 * Dev-mode tripwire. A component that renders game text calls this on mount;
 * an unregistered or unloaded font is an instant loud error pointing at the
 * registry — never silently-wrong measurements.
 */
export const assertFontReady = (fontFamily: string): void => {
  if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
  const family = primaryFamily(fontFamily);
  if (GENERIC_FAMILIES.has(family)) return;
  if (!(family in FONT_REGISTRY)) {
    throw new Error(`[fontManager] "${family}" is not in FONT_REGISTRY. Register and bundle it in services/fontManager.ts.`);
  }
  if (document.fonts?.check && !document.fonts.check(`16px "${family}"`)) {
    throw new Error(`[fontManager] "${family}" is registered but not loaded. Was loadGameFonts() awaited before mounting the app?`);
  }
};
