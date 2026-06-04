import { fault } from '../../../utils/logger';
import type { SurfaceOptions } from './surfaceSchema';
import {
  CLIENT_SKIN_VERSION,
  MATERIAL_SCHEMA_VERSION,
  validateSkinManifest,
  type SkinManifest,
} from './skinManifest';

export const BUILT_IN_SKIN_ID = 'cruel-deal-default';

const BASE_SURFACE: SurfaceOptions = {
  material: 'white',
  texture: 'none',
  gradient: 'both',
  border: ['top', 'right', 'bottom', 'left'],
  borderOpacity: 34,
  radius: 7,
  contentTone: 'black',
};

const builtInSkins = new Map<string, SkinManifest>();
const downloadedSkins = new Map<string, SkinManifest>();

const parseVersion = (version: string) => version.split('.').map((part) => Number(part));

const versionGte = (actual: string, required: string) => {
  const a = parseVersion(actual);
  const r = parseVersion(required);
  for (let i = 0; i < Math.max(a.length, r.length); i += 1) {
    const av = a[i] ?? 0;
    const rv = r[i] ?? 0;
    if (av > rv) return true;
    if (av < rv) return false;
  }
  return true;
};

export const isSkinCompatible = (manifest: SkinManifest) => (
  manifest.compatibility.materialSchemaVersion === MATERIAL_SCHEMA_VERSION
  && versionGte(CLIENT_SKIN_VERSION, manifest.compatibility.minClientVersion)
);

export const registerBuiltInSkin = (manifest: unknown): SkinManifest | null => {
  const parsed = validateSkinManifest(manifest, 'built-in-skin');
  if (!parsed) return null;
  builtInSkins.set(parsed.id, parsed);
  return parsed;
};

export const registerDownloadedSkin = (manifest: unknown): SkinManifest | null => {
  const parsed = validateSkinManifest(manifest, 'downloaded-skin');
  if (!parsed) return null;
  downloadedSkins.set(parsed.id, parsed);
  return parsed;
};

export const clearDownloadedSkinsForTest = () => downloadedSkins.clear();

const resolveFromManifest = (manifest: SkinManifest | undefined, materialId: string) => {
  if (!manifest) return undefined;
  if (!isSkinCompatible(manifest)) return undefined;
  return manifest.recipePatches[materialId];
};

const firstCompatibleDownloadedPatch = (materialId: string) => {
  for (const manifest of downloadedSkins.values()) {
    const patch = resolveFromManifest(manifest, materialId);
    if (patch) return patch;
  }
  return undefined;
};

export const resolveSurfaceForMaterial = (params: {
  materialId?: string;
  skinId?: string;
}): SurfaceOptions | undefined => {
  const { materialId, skinId } = params;
  if (!materialId) return undefined;

  const requested = skinId
    ? resolveFromManifest(downloadedSkins.get(skinId) ?? builtInSkins.get(skinId), materialId)
    : undefined;
  if (requested) return { ...BASE_SURFACE, ...requested };

  const downloaded = firstCompatibleDownloadedPatch(materialId);
  if (downloaded) {
    if (skinId) fault('skin.resolve.fallback', { skinId, materialId, fallback: 'downloaded' });
    return { ...BASE_SURFACE, ...downloaded };
  }

  const builtIn = resolveFromManifest(builtInSkins.get(BUILT_IN_SKIN_ID), materialId);
  if (builtIn) {
    if (skinId) fault('skin.resolve.fallback', { skinId, materialId, fallback: BUILT_IN_SKIN_ID });
    return { ...BASE_SURFACE, ...builtIn };
  }

  fault('skin.resolve.fallback', { skinId, materialId, fallback: 'base' });
  return { ...BASE_SURFACE };
};

registerBuiltInSkin({
  id: BUILT_IN_SKIN_ID,
  version: '1.0.0',
  displayName: 'Cruel Deal Default',
  appliesTo: ['ui-node'],
  compatibility: {
    minClientVersion: '1.0.0',
    materialSchemaVersion: MATERIAL_SCHEMA_VERSION,
  },
  recipePatches: {
    'cta-primary': {
      material: 'custom',
      materialColor: '#707275',
      texture: 'stone04',
      textureStrength: 80,
      glass: true,
      glassOpacity: 15,
      gradient: 'both',
      lightStrength: 60,
      darkStrength: 36,
      border: ['top', 'right', 'bottom', 'left'],
      borderColor: 'custom',
      borderCustomColor: '#eaeaea',
      borderOpacity: 54,
      dropShadow: true,
      shadowOpacity: 55,
      shadowBlur: 6,
      shadowY: 3,
      radius: 6,
      contentTone: 'black',
      textTransform: 'uppercase',
      fontStyle: 'normal',
      fontWeight: 800,
      letterSpacing: 0.05,
    },
    'cta-secondary': {
      material: 'custom',
      materialColor: '#151a21',
      texture: 'none',
      glass: true,
      glassOpacity: 22,
      gradient: 'both',
      lightStrength: 18,
      darkStrength: 42,
      border: ['top', 'right', 'bottom', 'left'],
      borderColor: 'custom',
      borderCustomColor: '#5f6a77',
      borderOpacity: 72,
      radius: 8,
      contentTone: 'gold',
      textTransform: 'uppercase',
      fontStyle: 'normal',
      fontWeight: 800,
      letterSpacing: 0.06,
    },
    'body-panel': {
      material: 'custom',
      materialColor: '#0f1216',
      texture: 'none',
      gradient: 'none',
      border: ['top', 'right', 'bottom', 'left'],
      borderColor: 'custom',
      borderCustomColor: '#262b33',
      borderOpacity: 70,
      radius: 10,
      textSizeRem: 0.95,
      contentTone: 'white',
      contentOpacity: 78,
      textTransform: 'none',
      fontStyle: 'normal',
      textAlign: 'left',
      textEmboss: false,
    },
    'mission-card': {
      material: 'none',
      texture: 'none',
      textureStrength: 0,
      glass: true,
      glassOpacity: 0,
      glassBlurEnabled: true,
      glassBlur: 3,
      bevelCorners: ['top-right'],
      bevelSize: 18,
      tint: 'black',
      tintStrength: 50,
      gradient: 'both',
      border: 'top',
      borderOpacity: 22,
      lightStrength: 10,
      darkStrength: 10,
      sheen: false,
      edgeWearTexture: 'edge-bw-noise-dense',
      edgeWearOpacity: 0,
      edgeWearWidth: 1,
      edgeWearScale: 256,
      edgeWearLayer: 'above-highlights',
      radius: 8,
      contentTone: 'white',
      contentOpacity: 80,
      textFontFamily: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
      textSizeRem: 0.65,
      fontWeight: 100,
      fontStyle: 'normal',
      textTransform: 'none',
      letterSpacing: 0.05,
    },
    'mission-panel': {
      material: 'none',
      texture: 'none',
      textureStrength: 0,
      glass: true,
      glassOpacity: 41,
      glassReflectionOpacity: 52,
      glassBlurEnabled: true,
      glassBlur: 3,
      glassHighlightWidth: 100,
      glassHighlightHeight: 2,
      glassHighlightY: 0,
      bevelCorners: ['top-right'],
      bevelSize: 18,
      tint: 'none',
      tintStrength: 42,
      gradient: 'none',
      border: ['top', 'left'],
      borderColor: 'custom',
      borderCustomColor: '#c2c2c2',
      borderOpacity: 49,
      lightStrength: 5,
      darkStrength: 0,
      sheen: false,
      edgeWearTexture: 'edge-bw-noise-dense',
      edgeWearOpacity: 45,
      edgeWearWidth: 1,
      edgeWearScale: 1024,
      edgeWearLayer: 'above-highlights',
      dropShadow: true,
      shadowOpacity: 69,
      shadowBlur: 22,
      shadowX: 11,
      shadowY: 10,
      shadowSpread: -1,
      radius: 8,
      contentTone: 'white',
      contentOpacity: 90,
      textFontFamily: '"IBM Plex Sans Condensed", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
      textSizeRem: 0.65,
      fontWeight: 100,
      fontStyle: 'normal',
      textTransform: 'none',
      letterSpacing: 0.05,
    },
    'mission-badge': {
      material: 'none',
      texture: 'stoneGray01',
      textureStrength: 0,
      glass: false,
      tint: 'white',
      tintStrength: 9,
      gradient: 'top-light',
      border: ['top', 'right', 'bottom', 'left'],
      borderOpacity: 24,
      lightStrength: 22,
      darkStrength: 8,
      sheen: true,
      edgeWearTexture: 'none',
      edgeWearOpacity: 0,
      edgeWearLayer: 'below-highlights',
      radius: 4,
      contentTone: 'gold',
      contentOpacity: 80,
      textFontFamily: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
      textSizeRem: 0.58,
      fontWeight: 800,
      fontStyle: 'normal',
      textTransform: 'uppercase',
      letterSpacing: 0.08,
    },
    'mission-sector': {
      material: 'none',
      texture: 'none',
      textureStrength: 0,
      glass: false,
      tint: 'none',
      gradient: 'none',
      border: 'none',
      radius: 0,
      contentTone: 'gold',
      contentOpacity: 90,
      textFontFamily: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
      textSizeRem: 0.74,
      fontWeight: 800,
      fontStyle: 'normal',
      textTransform: 'uppercase',
      letterSpacing: 0.08,
      textAlign: 'center',
    },
    'mission-cta': {
      material: 'custom',
      materialColor: '#707275',
      texture: 'stone04',
      textureStrength: 84,
      textureScale: 256,
      glass: false,
      glassOpacity: 0,
      glassReflectionOpacity: 0,
      glassBlurEnabled: false,
      glassBlur: 0,
      glassShine: false,
      glassHighlightWidth: 100,
      glassHighlightHeight: 32,
      glassHighlightY: 4,
      tint: 'none',
      tintStrength: 0,
      gradient: 'both',
      border: ['top', 'right', 'bottom', 'left'],
      borderColor: 'custom',
      borderCustomColor: '#eaeaea',
      borderOpacity: 54,
      lightStrength: 62,
      darkStrength: 36,
      sheen: true,
      edgeWearTexture: 'edge-bw-noise-dense',
      edgeWearOpacity: 45,
      edgeWearWidth: 1,
      edgeWearScale: 1024,
      edgeWearLayer: 'above-highlights',
      dropShadow: true,
      shadowOpacity: 58,
      shadowBlur: 6,
      shadowX: 0,
      shadowY: 3,
      radius: 6,
      contentTone: 'black',
      contentOpacity: 90,
      textFontFamily: '"DIN Condensed", "Bahnschrift", "Arial Narrow", ui-sans-serif, system-ui, sans-serif',
      textSizeRem: 0.8,
      fontWeight: 800,
      fontStyle: 'normal',
      textTransform: 'uppercase',
      letterSpacing: 0.05,
    },
  },
});
