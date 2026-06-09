import assert from 'node:assert/strict';
import {
  surfaceClass,
  surfaceLayerEmissions,
  surfaceLayerFlags,
  surfaceStateStyle,
  surfaceStyle,
} from './surfaceFeatures';
import type { SurfaceOptions } from './surfaceSchema';
import { materialTextEmbossShadow } from '../material-node/materialTextEmboss';

const layerClasses = (options: SurfaceOptions) =>
  surfaceLayerEmissions(options).map((layer) => (layer.classNames || [])[0]);

// --- Default surface ---------------------------------------------------------
// road012a texture at full strength suppresses the material base; gradient and
// border are on by default.
assert.deepEqual(surfaceLayerFlags({}), {
  material: false,
  texture: true,
  tinted: false,
  gradient: true,
  glass: false,
  glowing: false,
  emitting: false,
  border: true,
  edgeWear: false,
});

assert.equal(
  surfaceClass({}),
  'cd-surface cd-surface--rect cd-surface--texture-road012a cd-surface--gradient-both cd-surface--bordered cd-surface--border-lit',
);

assert.deepEqual(layerClasses({}), [
  'cd-surface__texture',
  'cd-surface__gradient',
  'cd-surface__border',
]);

const defaultStyle = surfaceStyle({}) as Record<string, string>;
assert.equal(defaultStyle['--surface-radius'], '7px');
assert.equal(defaultStyle['--texture-strength'], '1');
assert.equal(defaultStyle['--texture-scale'], '512px');
assert.equal(defaultStyle['--light-alpha'], '0.2');
assert.equal(defaultStyle['--dark-alpha'], '0.32');
assert.equal(defaultStyle['--border-alpha'], '0.34');
assert.equal(defaultStyle['--content-size'], '0.8125rem');
assert.equal(defaultStyle['--content-font-weight'], '700');
assert.equal(defaultStyle['--content-font-weight-base'], '700');
assert.equal(defaultStyle['--content-font-style'], 'italic');
assert.equal(defaultStyle['--content-text-transform'], 'uppercase');
assert.equal(defaultStyle['--material-base-color'], undefined);

// --- Texture off re-enables the material base --------------------------------
const noTexture = surfaceLayerFlags({ texture: 'none' });
assert.equal(noTexture.material, true);
assert.equal(noTexture.texture, false);
assert.equal((surfaceStyle({ texture: 'none', material: 'white' }) as Record<string, string>)['--material-base-color'], '#ffffff');

// --- Tint toggles on strength ------------------------------------------------
assert.equal(surfaceLayerFlags({ tint: 'gold', tintStrength: 0 }).tinted, false);
assert.equal(surfaceLayerFlags({ tint: 'gold', tintStrength: 10 }).tinted, true);
assert.equal(surfaceLayerFlags({ tint: 'none', tintStrength: 50 }).tinted, false);

// --- Glow needs a tone AND a target edge/corner ------------------------------
assert.equal(surfaceLayerFlags({ glow: 'gold', glowStrength: 50 }).glowing, false);
assert.equal(surfaceLayerFlags({ glow: 'gold', glowStrength: 50, edgeHighlight: 'top' }).glowing, true);
assert.equal(surfaceLayerFlags({ glow: 'gold', glowStrength: 0, corners: 'all' }).glowing, false);
// Glow emits its own edge + corner-arc layers.
assert.deepEqual(layerClasses({ texture: 'none', material: 'none', gradient: 'none', borderEnabled: false, glow: 'gold', glowStrength: 50, corners: 'all' }), [
  'cd-surface__glow',
  'cd-surface__edge',
  'cd-surface__corners',
]);

// --- Border respects enable + opacity ----------------------------------------
assert.equal(surfaceLayerFlags({ borderEnabled: false }).border, false);
assert.equal(surfaceLayerFlags({ border: 'none' }).border, false);
assert.equal(surfaceLayerFlags({ borderOpacity: 0 }).border, false);

// --- Drop shadow is an explicit opt-in (unset = off) -------------------------
assert.equal(surfaceLayerFlags({ dropShadow: true }).edgeWear, false);
assert.equal((surfaceStyle({ dropShadow: true }) as Record<string, string>)['--surface-drop-shadow'], undefined);
assert.ok((surfaceStyle({ dropShadow: true, shadowOpacity: 50, shadowBlur: 6 }) as Record<string, string>)['--surface-drop-shadow']);

// --- Default value lock ------------------------------------------------------
// Pins every default-driven CSS variable so a future defaults refactor is
// provably behavior-preserving. Each block enables one feature and leaves its
// numeric fields unset, forcing the built-in defaults to surface.
const styleOf = (options: SurfaceOptions) => surfaceStyle(options) as Record<string, string>;

// shape
assert.equal(styleOf({})['--surface-radius'], '7px');
assert.equal(styleOf({ bevelCorners: ['top-left'] })['--bevel-size'], '11px');

// texture
const tex = styleOf({});
assert.equal(tex['--texture-strength'], '1');
assert.equal(tex['--texture-scale'], '512px');
const silver = styleOf({ texture: 'silver01', textureStrength: 100, textureScale: 512 });
assert.equal(surfaceLayerFlags({ texture: 'silver01', textureStrength: 100 }).texture, true);
assert.match(surfaceClass({ texture: 'silver01', textureStrength: 100 }), /cd-surface--texture-silver01/);
assert.equal(silver['--texture-strength'], '1');
assert.equal(silver['--texture-image'], 'url("/art/textures/stone-local/Silver01.png")');

// material base
assert.equal(styleOf({ texture: 'none', material: 'white' })['--material-base-color'], '#ffffff');
assert.equal(styleOf({ texture: 'none', material: 'custom' })['--material-base-color'], '#808080');

// tint
const tint = styleOf({ tint: 'gold' });
assert.equal(tint['--tint-rgb'], '248 215 112');
assert.equal(tint['--tint-alpha'], '0.32');

// glass
const glass = styleOf({ glass: true });
assert.equal(glass['--glass-alpha'], '0.42');
assert.equal(glass['--glass-reflection-alpha'], '1');
assert.equal(glass['--glass-highlight-width'], '100%');
assert.equal(glass['--glass-highlight-height'], '34%');
assert.equal(glass['--glass-highlight-y'], '10%');
const blurWithoutGlass = { glass: false, glassBlurEnabled: true, glassBlur: 12 } satisfies SurfaceOptions;
assert.equal(surfaceLayerFlags(blurWithoutGlass).glass, false);
assert.match(surfaceClass(blurWithoutGlass), /cd-surface--glass-blur/);
assert.equal(styleOf(blurWithoutGlass)['--glass-blur'], '12px');

// drop shadow: opacity AND >=1 non-zero geometry field are explicit opt-ins;
// the remaining geometry fields then fall back to their defaults.
// blur=6 set -> locks X=8, Y=12, spread=0 defaults.
assert.equal(
  styleOf({ dropShadow: true, shadowOpacity: 50, shadowBlur: 6 })['--surface-drop-shadow'],
  '8px 12px 6px 0px rgb(0 0 0 / 0.5)',
);
// x=1 set -> locks Y=12, blur=24, spread=0 defaults.
assert.equal(
  styleOf({ dropShadow: true, shadowOpacity: 50, shadowX: 1 })['--surface-drop-shadow'],
  '1px 12px 24px 0px rgb(0 0 0 / 0.5)',
);

// gradient
const grad = styleOf({});
assert.equal(grad['--light-alpha'], '0.2');
assert.equal(grad['--dark-alpha'], '0.32');

// border
const border = styleOf({});
assert.equal(border['--border-alpha'], '0.34');
assert.equal(border['--border-rgb'], '235 226 205');

// edge wear (width/scale defaults; opacity is an explicit opt-in)
assert.equal(surfaceLayerFlags({ edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 50 }).edgeWear, false);
const wear = styleOf({ edgeWear: true, edgeWearTexture: 'edge-bw-noise-dense', edgeWearOpacity: 50 });
assert.equal(wear['--edge-wear-alpha'], '0.5');
assert.equal(wear['--edge-wear-width'], '5px');
assert.equal(wear['--edge-wear-scale'], '256px');

// glow (cornerSize default; glowStrength defaults to 42 so glow is reachable unset)
const glow = styleOf({ glow: 'gold', corners: 'all' });
assert.equal(glow['--corner-size'], '18px');
assert.ok(glow['--glow-alpha']);

// content
const content = styleOf({});
assert.equal(content['--content-size'], '0.8125rem');
assert.equal(content['--content-alpha'], '1');
assert.equal(content['--content-rgb'], '255 255 255');
assert.equal(content['--content-color'], 'rgb(255 255 255 / 1)');
assert.equal(content['--content-shadow'], '0 2px 6px rgb(0 0 0 / 0.64)');
assert.equal(content['--content-shadow-base'], '0 2px 6px rgb(0 0 0 / 0.64)');
assert.equal(content['--content-font-weight'], '700');
assert.equal(content['--content-font-style'], 'italic');
assert.equal(content['--content-text-transform'], 'uppercase');
assert.equal(content['--content-letter-spacing'], '0em');
assert.equal(content['--content-align'], 'center');
assert.equal(content['--content-justify'], 'center');
assert.equal(content['--content-x'], '0px');
assert.equal(content['--content-y'], '0px');

// state style emission is intentionally live-vars only; base aliases are only
// minted by rest style emission.
const stateStyle = surfaceStateStyle({}) as Record<string, string>;
assert.equal(stateStyle['--content-shadow'], '0 2px 6px rgb(0 0 0 / 0.64)');
assert.equal(stateStyle['--content-shadow-base'], undefined);
assert.equal(stateStyle['--content-font-weight-base'], undefined);

// emission
const emission = styleOf({ emission: 'line', emissionStrength: 50 });
assert.equal(emission['--emission-rgb'], '0 0 0');
assert.equal(emission['--emission-alpha'], '0.5');
assert.equal(emission['--emission-length'], '42%');
assert.equal(emission['--emission-thickness'], '1px');
assert.equal(emission['--emission-blip-size'], '12px');

// motion (no vars unless explicitly non-identity)
assert.equal(styleOf({})['--state-scale'], undefined);
assert.equal(styleOf({})['--state-translate-y'], undefined);

// visual filtering (identity values are still emitted when authored so states
// can disable host brightness while brightening paint layers only)
assert.equal(styleOf({ surfaceFilterBrightness: 1 })['--surface-filter-brightness'], '1');
assert.equal(styleOf({ surfaceLayerBrightness: 1.18 })['--surface-layer-brightness'], '1.18');

// textEmboss: object emboss drives the shadow from materialTextEmbossShadow.
// A 'dark' object with strength yields a non-'none' shadow; explicit false is 'none';
// and the object shadow must differ from the legacy boolean default shadow.
const embossObjectShadow = styleOf({
  textEmboss: { textEmbossMode: 'dark', textEmbossStrength: 100, textEmbossOffset: 50, textEmbossBlur: 50 },
})['--content-shadow'];
const embossFalseShadow = styleOf({ textEmboss: false })['--content-shadow'];
const embossBoolDefaultShadow = styleOf({ textEmboss: true })['--content-shadow'];
assert.equal(embossFalseShadow, 'none');
assert.notEqual(embossObjectShadow, 'none');
assert.notEqual(embossObjectShadow, embossBoolDefaultShadow);
assert.equal(
  embossObjectShadow,
  materialTextEmbossShadow({
    contentTone: 'white',
    textEmbossMode: 'dark',
    textEmbossStrength: 100,
    textEmbossOffset: 50,
    textEmbossBlur: 50,
  }),
);

console.log('Surface feature pipeline tests passed');
