import type { SurfaceOptions } from '../../material-lab/surfaceSchema';
import {
  surfaceFieldDefinitions,
  type SurfaceFieldControl,
} from '../../material-lab/surfaceFieldMetadata';

export type AuthoringControlValueType =
  | 'boolean'
  | 'number'
  | 'color'
  | 'length'
  | 'enum'
  | 'asset'
  | 'text'
  | 'json';

export type AuthoringControlUnit =
  | 'px'
  | '%'
  | 'rem'
  | 'em'
  | 'cqw'
  | 'deg'
  | 'ms'
  | 'ratio';

export type AuthoringPaintSlot =
  | 'H'
  | 'H::before'
  | 'U'
  | 'C'
  | 'H::after'
  | 'O'
  | 'compiler';

export type AuthoringControlWrite =
  | { kind: 'css-property'; name: string }
  | { kind: 'css-variable'; name: `--${string}` }
  | { kind: 'mode-class'; name: string }
  | { kind: 'paint-operation'; name: string }
  | { kind: 'compiler'; name: string };

export interface AuthoringControlRule {
  id: string;
  label: string;
  sourcePath: string;
  legacySourceKeys: readonly string[];
  valueType: AuthoringControlValueType;
  unit?: AuthoringControlUnit;
  allowedValues?: readonly string[];
  min?: number;
  max?: number;
  step?: number;
  writes: readonly AuthoringControlWrite[];
  slot: AuthoringPaintSlot;
  dependencies: readonly string[];
  conflicts: readonly string[];
  cost: 0 | 1 | 2 | 3;
  expectedResult: string;
  internal?: boolean;
}

interface ControlLowering {
  writes: readonly AuthoringControlWrite[];
  slot: AuthoringPaintSlot;
  cost: AuthoringControlRule['cost'];
  expectedResult: string;
  dependencies?: readonly string[];
  conflicts?: readonly string[];
  internal?: boolean;
}

const css = (name: string): AuthoringControlWrite => ({ kind: 'css-property', name });
const variable = (name: `--${string}`): AuthoringControlWrite => ({ kind: 'css-variable', name });
const modeClass = (name: string): AuthoringControlWrite => ({ kind: 'mode-class', name });
const paint = (name: string): AuthoringControlWrite => ({ kind: 'paint-operation', name });
const compiler = (name: string): AuthoringControlWrite => ({ kind: 'compiler', name });

const surfaceLowering = {
  renderMode: { writes: [compiler('render-context')], slot: 'compiler', cost: 0, expectedResult: 'Selects editor, runtime, or export compilation without emitting product CSS.', internal: true },
  material: { writes: [paint('fill'), modeClass('has-base-material')], slot: 'H', cost: 0, expectedResult: 'Selects the bottommost surface material or omits it.' },
  materialColor: { writes: [paint('fill')], slot: 'H', cost: 0, expectedResult: 'Changes the custom base color without affecting other paint operations.', dependencies: ['surface.material=custom'] },
  glass: { writes: [paint('backdropGlass'), modeClass('has-glass')], slot: 'U', cost: 2, expectedResult: 'Adds or removes the translucent glass wash while preserving its tuned parameters.' },
  texture: { writes: [paint('texture')], slot: 'H', cost: 1, expectedResult: 'Selects the pinned texture asset or procedural texture.' },
  shape: { writes: [modeClass('is-beveled'), css('corner-shape'), css('clip-path')], slot: 'H', cost: 0, expectedResult: 'Selects rounded or beveled host geometry shared by all paint slots.' },
  bevelCorners: { writes: [css('corner-shape'), css('border-radius'), css('clip-path')], slot: 'H', cost: 0, expectedResult: 'Chooses which host corners are beveled.' },
  bevelSize: { writes: [variable('--ui-bevel-size')], slot: 'H', cost: 0, expectedResult: 'Changes the cut depth of selected beveled corners.', dependencies: ['surface.shape=bevel'] },
  corners: { writes: [paint('corner-highlight')], slot: 'H::after', cost: 1, expectedResult: 'Chooses which corners receive authored highlight paint.' },
  edgeHighlight: { writes: [paint('edge-highlight')], slot: 'H::after', cost: 1, expectedResult: 'Chooses which edges receive authored highlight paint.' },
  border: { writes: [css('border-top'), css('border-right'), css('border-bottom'), css('border-left')], slot: 'H', cost: 0, expectedResult: 'Chooses the bordered sides without changing padding or outer size.' },
  glow: { writes: [paint('glow')], slot: 'H', cost: 1, expectedResult: 'Selects the glow tone used by the compiled shadow and highlight lists.' },
  tint: { writes: [paint('tint')], slot: 'H', cost: 1, expectedResult: 'Selects a tint layer without replacing the base material.' },
  gradient: { writes: [paint('static-gradient')], slot: 'H', cost: 1, expectedResult: 'Selects the static top-light, bottom-dark, both, or no-gradient recipe.' },
  sheen: { writes: [paint('static-sheen')], slot: 'H', cost: 1, expectedResult: 'Adds or removes the secondary static directional sheen.' },
  selected: { writes: [compiler('editor-selection')], slot: 'compiler', cost: 0, expectedResult: 'Decorates editor selection outside the product subtree.', internal: true },
  interactive: { writes: [compiler('semantic-interaction-capability')], slot: 'compiler', cost: 0, expectedResult: 'Enables semantic interaction states declared by the component contract.', internal: true },
  hoverPreview: { writes: [compiler('editor-hover-preview')], slot: 'compiler', cost: 0, expectedResult: 'Previews hover without changing canonical runtime state.', internal: true },
  textureStrength: { writes: [variable('--ui-texture-opacity')], slot: 'H', cost: 1, expectedResult: 'Changes texture alpha only.', dependencies: ['surface.texture!=none'] },
  textureScale: { writes: [css('background-size')], slot: 'H', cost: 1, expectedResult: 'Changes the selected texture frequency only.', dependencies: ['surface.texture!=none'] },
  glowStrength: { writes: [variable('--ui-glow-strength')], slot: 'H', cost: 1, expectedResult: 'Recomputes one stable glow shadow and highlight recipe.', dependencies: ['surface.glow!=none'] },
  tintStrength: { writes: [variable('--ui-tint-opacity')], slot: 'H', cost: 1, expectedResult: 'Changes tint alpha only.', dependencies: ['surface.tint!=none'] },
  glassOpacity: { writes: [variable('--ui-glass-opacity')], slot: 'U', cost: 2, expectedResult: 'Changes the glass wash alpha only.', dependencies: ['surface.glass=true'] },
  glassReflectionOpacity: { writes: [variable('--ui-glass-reflection-opacity')], slot: 'U', cost: 2, expectedResult: 'Changes the glass shine alpha without changing wash or blur.', dependencies: ['surface.glass=true', 'surface.glassShine=true'] },
  glassBlurEnabled: { writes: [paint('backdrop-blur')], slot: 'U', cost: 2, expectedResult: 'Includes or omits backdrop blur while preserving its radius.' },
  glassBlur: { writes: [variable('--ui-glass-blur')], slot: 'U', cost: 2, expectedResult: 'Changes backdrop blur radius without blurring child content.', dependencies: ['surface.glassBlurEnabled=true'] },
  glassShine: { writes: [paint('glass-shine')], slot: 'U', cost: 2, expectedResult: 'Includes or omits the glass highlight recipe.', dependencies: ['surface.glass=true'] },
  glassHighlightWidth: { writes: [variable('--ui-glass-highlight-width')], slot: 'U', cost: 2, expectedResult: 'Changes glass highlight width.', dependencies: ['surface.glassShine=true'] },
  glassHighlightHeight: { writes: [variable('--ui-glass-highlight-height')], slot: 'U', cost: 2, expectedResult: 'Changes glass highlight height.', dependencies: ['surface.glassShine=true'] },
  glassHighlightY: { writes: [variable('--ui-glass-highlight-y')], slot: 'U', cost: 2, expectedResult: 'Moves the glass highlight vertically without moving the wash.', dependencies: ['surface.glassShine=true'] },
  borderEnabled: { writes: [paint('border')], slot: 'H', cost: 0, expectedResult: 'Includes or omits the border while preserving border settings.' },
  borderColor: { writes: [css('border-color')], slot: 'H', cost: 0, expectedResult: 'Selects the border tone.' },
  borderCustomColor: { writes: [css('border-color')], slot: 'H', cost: 0, expectedResult: 'Changes the custom border color.', dependencies: ['surface.borderColor=custom'] },
  borderLit: { writes: [paint('lit-border')], slot: 'H', cost: 1, expectedResult: 'Adds directional inset light to the same border geometry.' },
  borderOpacity: { writes: [variable('--ui-border-opacity')], slot: 'H', cost: 0, expectedResult: 'Changes border alpha without changing element opacity.' },
  lightStrength: { writes: [variable('--ui-static-light-opacity')], slot: 'H', cost: 1, expectedResult: 'Changes the bright part of the selected static-light recipe.' },
  darkStrength: { writes: [variable('--ui-static-dark-opacity')], slot: 'H', cost: 1, expectedResult: 'Changes the dark part of the selected static-light recipe.' },
  surfaceFilterBrightness: { writes: [css('filter')], slot: 'H', cost: 1, expectedResult: 'Changes brightness for the complete host through the shared filter list.' },
  surfaceLayerBrightness: { writes: [css('filter')], slot: 'U', cost: 2, expectedResult: 'Changes decorative paint brightness without changing content.', conflicts: ['content-sharing-same-filter-slot'] },
  edgeWear: { writes: [paint('edgeWear')], slot: 'H::after', cost: 1, expectedResult: 'Includes or omits edge wear while preserving its configured texture and dimensions.' },
  edgeWearTexture: { writes: [paint('edgeWear')], slot: 'H::after', cost: 1, expectedResult: 'Selects the pinned mask texture used for chips or scratches.', dependencies: ['surface.edgeWear=true'] },
  edgeWearOpacity: { writes: [variable('--ui-edge-wear-opacity')], slot: 'H::after', cost: 1, expectedResult: 'Changes wear paint alpha only.', dependencies: ['surface.edgeWear=true'] },
  edgeWearWidth: { writes: [variable('--ui-edge-wear-width')], slot: 'H::after', cost: 1, expectedResult: 'Changes the inward wear band while keeping it aligned to host geometry.', dependencies: ['surface.edgeWear=true'] },
  edgeWearScale: { writes: [variable('--ui-edge-wear-scale')], slot: 'H::after', cost: 1, expectedResult: 'Changes wear texture frequency.', dependencies: ['surface.edgeWear=true'] },
  edgeWearLayer: { writes: [compiler('paint-order-preference')], slot: 'compiler', cost: 0, expectedResult: 'Places wear below or above highlights without adding a layer-shaped element.' },
  dropShadow: { writes: [paint('shadow')], slot: 'H', cost: 1, expectedResult: 'Includes or omits the outer shadow while preserving its geometry.' },
  shadowOpacity: { writes: [variable('--ui-shadow-opacity')], slot: 'H', cost: 1, expectedResult: 'Changes shadow alpha only.', dependencies: ['surface.dropShadow=true'] },
  shadowBlur: { writes: [variable('--ui-shadow-blur')], slot: 'H', cost: 1, expectedResult: 'Changes shadow softness without changing host geometry.', dependencies: ['surface.dropShadow=true'] },
  shadowX: { writes: [variable('--ui-shadow-x')], slot: 'H', cost: 1, expectedResult: 'Moves the shadow horizontally.', dependencies: ['surface.dropShadow=true'] },
  shadowY: { writes: [variable('--ui-shadow-y')], slot: 'H', cost: 1, expectedResult: 'Moves the shadow vertically.', dependencies: ['surface.dropShadow=true'] },
  shadowSpread: { writes: [variable('--ui-shadow-spread')], slot: 'H', cost: 1, expectedResult: 'Expands or contracts the shadow.', dependencies: ['surface.dropShadow=true'] },
  cornerSize: { writes: [variable('--ui-corner-highlight-size')], slot: 'H::after', cost: 1, expectedResult: 'Changes highlighted corner arm length.', dependencies: ['surface.corners!=none'] },
  radius: { writes: [css('border-radius')], slot: 'H', cost: 0, expectedResult: 'Changes host corner radius inherited by every helper.' },
  textContent: { writes: [compiler('content-data')], slot: 'C', cost: 0, expectedResult: 'Changes semantic content without generating CSS.' },
  contentLayer: { writes: [compiler('content-allocation-preference')], slot: 'compiler', cost: 0, expectedResult: 'Places content below or above glass without duplicating it.', conflicts: ['glass-with-both-under-and-over-content'] },
  textFontFamily: { writes: [css('font-family')], slot: 'C', cost: 0, expectedResult: 'Changes the pinned font family for content.' },
  textSizeRem: { writes: [css('font-size')], slot: 'C', cost: 0, expectedResult: 'Changes content font size in rem.' },
  contentOpacity: { writes: [variable('--ui-content-opacity')], slot: 'C', cost: 0, expectedResult: 'Changes content alpha without changing host opacity.' },
  contentTone: { writes: [css('color')], slot: 'C', cost: 0, expectedResult: 'Changes text tone.' },
  iconTone: { writes: [css('color')], slot: 'C', cost: 0, expectedResult: 'Changes icon currentColor independently from text.' },
  contentGlowStrength: { writes: [css('text-shadow')], slot: 'C', cost: 1, expectedResult: 'Appends text glow to the shared text-shadow list.' },
  iconGlowStrength: { writes: [css('filter')], slot: 'C', cost: 1, expectedResult: 'Appends icon glow to the shared icon filter list.' },
  fontWeight: { writes: [css('font-weight')], slot: 'C', cost: 0, expectedResult: 'Changes text weight using an available font face.' },
  fontStyle: { writes: [css('font-style')], slot: 'C', cost: 0, expectedResult: 'Changes text between normal and italic.' },
  textTransform: { writes: [css('text-transform')], slot: 'C', cost: 0, expectedResult: 'Changes displayed case while preserving source text.' },
  letterSpacing: { writes: [css('letter-spacing')], slot: 'C', cost: 0, expectedResult: 'Changes tracking in em.' },
  textEmboss: { writes: [css('text-shadow')], slot: 'C', cost: 1, expectedResult: 'Recompiles emboss and glow into one text-shadow list.' },
  textAlign: { writes: [css('text-align')], slot: 'C', cost: 0, expectedResult: 'Changes inline text alignment without changing flex alignment.' },
  textX: { writes: [compiler('content-transform-x')], slot: 'C', cost: 0, expectedResult: 'Offsets content through the single transform owner.' },
  textY: { writes: [compiler('content-transform-y')], slot: 'C', cost: 0, expectedResult: 'Offsets content through the single transform owner.' },
  emission: { writes: [paint('emission')], slot: 'O', cost: 2, expectedResult: 'Selects line, center blip, rail plus blip, or no emission.' },
  emissionEdge: { writes: [paint('emission-position')], slot: 'O', cost: 2, expectedResult: 'Anchors emission to the selected edge.', dependencies: ['surface.emission!=none'] },
  emissionTone: { writes: [variable('--ui-emission-color')], slot: 'O', cost: 2, expectedResult: 'Changes emission color.', dependencies: ['surface.emission!=none'] },
  emissionStrength: { writes: [variable('--ui-emission-opacity')], slot: 'O', cost: 2, expectedResult: 'Changes emission opacity and glow alpha.', dependencies: ['surface.emission!=none'] },
  emissionLength: { writes: [variable('--ui-emission-length')], slot: 'O', cost: 2, expectedResult: 'Changes emission length along its edge.', dependencies: ['surface.emission!=none'] },
  emissionThickness: { writes: [variable('--ui-emission-thickness')], slot: 'O', cost: 2, expectedResult: 'Changes emission rail thickness.', dependencies: ['surface.emission!=none'] },
  emissionBlipSize: { writes: [variable('--ui-emission-blip-size')], slot: 'O', cost: 2, expectedResult: 'Changes center blip size.', dependencies: ['surface.emission!=none'] },
  stateScale: { writes: [compiler('state-transform-scale')], slot: 'H', cost: 1, expectedResult: 'Composes state scale with layout transforms.' },
  stateTranslateY: { writes: [compiler('state-transform-y')], slot: 'H', cost: 1, expectedResult: 'Composes state translation with layout transforms.' },
  stateful: { writes: [compiler('legacy-state-enable')], slot: 'compiler', cost: 0, expectedResult: 'Controls legacy state import only.', internal: true },
  stateVars: { writes: [compiler('legacy-state-values')], slot: 'compiler', cost: 0, expectedResult: 'Imports legacy state values into canonical state overrides.', internal: true },
  visualState: { writes: [compiler('preview-state')], slot: 'compiler', cost: 0, expectedResult: 'Selects an editor preview state without changing authored idle values.', internal: true },
} as const satisfies Record<keyof SurfaceOptions, ControlLowering>;

const valueTypeForSurfaceControl = (control: SurfaceFieldControl): AuthoringControlValueType => {
  if (control === 'toggle' || control === 'multi-toggle') return control === 'toggle' ? 'boolean' : 'enum';
  if (control === 'slider') return 'number';
  if (control === 'color') return 'color';
  if (control === 'text') return 'text';
  if (control === 'json') return 'json';
  return 'enum';
};

export const legacySurfaceControlRules: readonly AuthoringControlRule[] = surfaceFieldDefinitions.map((definition) => {
  const lowering: ControlLowering = surfaceLowering[definition.key];
  return {
    id: `surface.${definition.key}`,
    label: definition.label,
    sourcePath: `legacy.surface.${definition.key}`,
    legacySourceKeys: [definition.key],
    valueType: valueTypeForSurfaceControl(definition.control),
    ...(definition.min !== undefined ? { min: definition.min } : {}),
    ...(definition.max !== undefined ? { max: definition.max } : {}),
    ...(definition.step !== undefined ? { step: definition.step } : {}),
    ...(definition.options ? { allowedValues: definition.options } : {}),
    ...lowering,
    dependencies: lowering.dependencies ?? [],
    conflicts: lowering.conflicts ?? [],
  };
});

const rule = (
  input: Omit<AuthoringControlRule, 'dependencies' | 'conflicts' | 'cost'>
    & Partial<Pick<AuthoringControlRule, 'dependencies' | 'conflicts' | 'cost'>>,
): AuthoringControlRule => ({
  dependencies: [],
  conflicts: [],
  cost: 0,
  ...input,
});

export const layoutControlRules = [
  rule({ id: 'layout.display', label: 'Display', sourcePath: 'layout.display', legacySourceKeys: ['mode'], valueType: 'enum', allowedValues: ['block', 'flex', 'grid', 'none'], writes: [css('display')], slot: 'H', expectedResult: 'Changes the selected part formatting context.' }),
  rule({ id: 'layout.position', label: 'Position', sourcePath: 'layout.position', legacySourceKeys: ['selfPosition'], valueType: 'enum', allowedValues: ['static', 'relative', 'absolute', 'fixed', 'sticky'], writes: [css('position')], slot: 'H', expectedResult: 'Changes normal or positioned participation without paint code overriding it.' }),
  rule({ id: 'layout.slot', label: 'Semantic Slot', sourcePath: 'component.slot', legacySourceKeys: ['slot'], valueType: 'enum', writes: [compiler('semantic-slot')], slot: 'compiler', expectedResult: 'Assigns the part to a component-owned slot without emitting visual CSS.' }),
  rule({ id: 'layout.x', label: 'X', sourcePath: 'layout.inset.x', legacySourceKeys: ['x'], valueType: 'number', unit: '%', writes: [css('left'), css('right')], slot: 'H', expectedResult: 'Changes the selected horizontal inset or anchor.' }),
  rule({ id: 'layout.y', label: 'Y', sourcePath: 'layout.inset.y', legacySourceKeys: ['y'], valueType: 'number', unit: '%', writes: [css('top'), css('bottom')], slot: 'H', expectedResult: 'Changes the selected vertical inset or anchor.' }),
  rule({ id: 'layout.constraintH', label: 'Horizontal Constraint', sourcePath: 'layout.constraint.horizontal', legacySourceKeys: ['constraintH'], valueType: 'enum', allowedValues: ['left', 'right', 'left-right', 'center'], writes: [compiler('horizontal-constraint')], slot: 'H', expectedResult: 'Compiles horizontal anchoring into left, right, width, and the shared transform channel.' }),
  rule({ id: 'layout.constraintV', label: 'Vertical Constraint', sourcePath: 'layout.constraint.vertical', legacySourceKeys: ['constraintV'], valueType: 'enum', allowedValues: ['top', 'bottom', 'top-bottom', 'center'], writes: [compiler('vertical-constraint')], slot: 'H', expectedResult: 'Compiles vertical anchoring into top, bottom, height, and the shared transform channel.' }),
  rule({ id: 'layout.widthMode', label: 'Width Mode', sourcePath: 'layout.width.mode', legacySourceKeys: ['wMode'], valueType: 'enum', allowedValues: ['fixed', 'hug', 'fill'], writes: [compiler('width-mode')], slot: 'H', expectedResult: 'Resolves fixed, intrinsic, or parent-filling width using normal CSS.' }),
  rule({ id: 'layout.width', label: 'Width', sourcePath: 'layout.width.value', legacySourceKeys: ['width'], valueType: 'length', unit: '%', min: 4, max: 140, step: 1, writes: [css('width')], slot: 'H', expectedResult: 'Changes width when width mode consumes an explicit value.' }),
  rule({ id: 'layout.heightMode', label: 'Height Mode', sourcePath: 'layout.height.mode', legacySourceKeys: ['hMode'], valueType: 'enum', allowedValues: ['fixed', 'hug', 'fill'], writes: [compiler('height-mode')], slot: 'H', expectedResult: 'Resolves fixed, intrinsic, or parent-filling height using normal CSS.' }),
  rule({ id: 'layout.height', label: 'Height', sourcePath: 'layout.height.value', legacySourceKeys: ['height'], valueType: 'length', unit: '%', min: 4, max: 140, step: 1, writes: [css('height')], slot: 'H', expectedResult: 'Changes height when height mode consumes an explicit value.' }),
  rule({ id: 'layout.nudgeX', label: 'Nudge X', sourcePath: 'layout.transform.translateX', legacySourceKeys: ['nudgeX'], valueType: 'number', unit: 'px', min: -80, max: 80, step: 1, writes: [compiler('layout-transform-x')], slot: 'H', expectedResult: 'Moves the part visually without changing sibling flow.' }),
  rule({ id: 'layout.nudgeY', label: 'Nudge Y', sourcePath: 'layout.transform.translateY', legacySourceKeys: ['nudgeY'], valueType: 'number', unit: 'px', min: -80, max: 80, step: 1, writes: [compiler('layout-transform-y')], slot: 'H', expectedResult: 'Moves the part visually without changing sibling flow.' }),
  rule({ id: 'layout.padding', label: 'Padding', sourcePath: 'layout.padding', legacySourceKeys: ['padding'], valueType: 'length', unit: 'px', min: 0, max: 40, step: 1, writes: [css('padding'), variable('--feed-node-padding')], slot: 'H', expectedResult: 'Insets content while the outer border-box and every decorative slot stay aligned; the feed adapter emits its compatibility variable until it is retired.' }),
  rule({ id: 'layout.gap', label: 'Gap', sourcePath: 'layout.gap', legacySourceKeys: ['gap'], valueType: 'length', unit: 'px', min: 0, max: 40, step: 1, writes: [css('gap'), variable('--feed-node-gap')], slot: 'C', expectedResult: 'Changes spacing between in-flow children only; the feed adapter also publishes its compatibility variable.' }),
  rule({ id: 'layout.direction', label: 'Direction', sourcePath: 'layout.flex.direction', legacySourceKeys: ['direction'], valueType: 'enum', allowedValues: ['row', 'column'], writes: [css('flex-direction')], slot: 'C', expectedResult: 'Changes the child main axis.' }),
  rule({ id: 'layout.reverse', label: 'Reverse', sourcePath: 'layout.flex.reverse', legacySourceKeys: ['reverse'], valueType: 'boolean', writes: [css('flex-direction')], slot: 'C', expectedResult: 'Reverses the visual flex direction without rewriting source order.' }),
  rule({ id: 'layout.wrap', label: 'Wrap', sourcePath: 'layout.flex.wrap', legacySourceKeys: ['wrap'], valueType: 'boolean', writes: [css('flex-wrap')], slot: 'C', expectedResult: 'Allows children to wrap on the cross axis.' }),
  rule({ id: 'layout.justify', label: 'Justify', sourcePath: 'layout.flex.justifyContent', legacySourceKeys: ['justify', 'distribute'], valueType: 'enum', allowedValues: ['start', 'center', 'end', 'between', 'around', 'evenly'], writes: [css('justify-content')], slot: 'C', expectedResult: 'Changes child distribution along the main axis.' }),
  rule({ id: 'layout.align', label: 'Align', sourcePath: 'layout.flex.alignItems', legacySourceKeys: ['align', 'crossAlign'], valueType: 'enum', allowedValues: ['start', 'center', 'end', 'stretch', 'baseline'], writes: [css('align-items')], slot: 'C', expectedResult: 'Changes child alignment on the cross axis.' }),
  rule({ id: 'layout.pushToEnd', label: 'Push To End', sourcePath: 'layout.flex.pushToEnd', legacySourceKeys: ['pushToEnd'], valueType: 'boolean', writes: [css('margin-top'), css('margin-left')], slot: 'H', expectedResult: 'Uses an auto main-axis margin to push the selected child to the end.' }),
] as const satisfies readonly AuthoringControlRule[];

export const typographyControlRules = [
  rule({ id: 'type.inherit', label: 'Inherit', sourcePath: 'typography.inherit', legacySourceKeys: ['inherit'], valueType: 'boolean', writes: [compiler('style-inheritance')], slot: 'compiler', expectedResult: 'Exposes the next value in the ordered style stack.' }),
  rule({ id: 'type.fontFamily', label: 'Font Family', sourcePath: 'typography.fontFamily', legacySourceKeys: ['textFontFamily', 'overrideFont'], valueType: 'enum', writes: [css('font-family')], slot: 'C', expectedResult: 'Changes the pinned font family or inherits when absent.' }),
  rule({ id: 'type.fontSize', label: 'Font Size', sourcePath: 'typography.fontSize', legacySourceKeys: ['textSizeRem', 'overrideSize'], valueType: 'number', unit: 'cqw', min: 0.4, max: 16, step: 0.1, writes: [css('font-size')], slot: 'C', expectedResult: 'Changes font size without changing the containing box.' }),
  rule({ id: 'type.lineHeight', label: 'Line Height', sourcePath: 'typography.lineHeight', legacySourceKeys: ['lineHeight', 'overrideLineHeight'], valueType: 'number', unit: 'ratio', min: 0.5, max: 3, step: 0.02, writes: [css('line-height')], slot: 'C', expectedResult: 'Changes line box height using a unitless ratio.' }),
  rule({ id: 'type.paragraphGap', label: 'Paragraph Gap', sourcePath: 'typography.paragraphGap', legacySourceKeys: ['paragraphGap', 'overrideParagraphGap'], valueType: 'number', unit: 'px', min: -24, max: 48, step: 1, writes: [css('margin-block-start')], slot: 'C', expectedResult: 'Changes spacing between paragraph tokens, not wrapped lines.' }),
  rule({ id: 'type.color', label: 'Color', sourcePath: 'typography.color', legacySourceKeys: ['contentTone', 'overrideColor'], valueType: 'color', writes: [css('color')], slot: 'C', expectedResult: 'Changes text color without changing host opacity.' }),
  rule({ id: 'type.opacity', label: 'Opacity', sourcePath: 'typography.opacity', legacySourceKeys: ['textOpacity', 'overrideOpacity'], valueType: 'number', unit: 'ratio', min: 0, max: 1, step: 0.01, writes: [css('color')], slot: 'C', expectedResult: 'Changes text alpha through its color.' }),
  rule({ id: 'type.weight', label: 'Weight', sourcePath: 'typography.weight', legacySourceKeys: ['fontWeight', 'overrideWeight'], valueType: 'number', min: 100, max: 900, step: 100, writes: [css('font-weight')], slot: 'C', expectedResult: 'Changes text weight using an available font face.' }),
  rule({ id: 'type.style', label: 'Style', sourcePath: 'typography.style', legacySourceKeys: ['fontStyle', 'overrideStyle'], valueType: 'enum', allowedValues: ['normal', 'italic'], writes: [css('font-style')], slot: 'C', expectedResult: 'Changes normal or italic text style.' }),
  rule({ id: 'type.transform', label: 'Case', sourcePath: 'typography.transform', legacySourceKeys: ['textTransform', 'overrideCase'], valueType: 'enum', allowedValues: ['none', 'uppercase', 'lowercase', 'capitalize'], writes: [css('text-transform')], slot: 'C', expectedResult: 'Changes displayed case while preserving source text.' }),
  rule({ id: 'type.letterSpacing', label: 'Tracking', sourcePath: 'typography.letterSpacing', legacySourceKeys: ['letterSpacing', 'overrideLetterSpacing'], valueType: 'number', unit: 'em', min: -0.2, max: 0.5, step: 0.005, writes: [css('letter-spacing')], slot: 'C', expectedResult: 'Changes text tracking in em.' }),
  rule({ id: 'type.align', label: 'Text Align', sourcePath: 'typography.textAlign', legacySourceKeys: ['textAlign', 'overrideAlign'], valueType: 'enum', allowedValues: ['left', 'center', 'right', 'start', 'end'], writes: [css('text-align')], slot: 'C', expectedResult: 'Changes inline text alignment.' }),
  rule({ id: 'type.embossMode', label: 'Emboss', sourcePath: 'typography.emboss.mode', legacySourceKeys: ['textEmbossMode', 'overrideEmboss'], valueType: 'enum', allowedValues: ['none', 'dark', 'light', 'shadow'], writes: [css('text-shadow')], slot: 'C', cost: 1, expectedResult: 'Selects the compiled emboss or shadow recipe.' }),
  rule({ id: 'type.embossStrength', label: 'Emboss Strength', sourcePath: 'typography.emboss.strength', legacySourceKeys: ['textEmbossStrength'], valueType: 'number', min: 0, max: 100, step: 1, writes: [css('text-shadow')], slot: 'C', cost: 1, expectedResult: 'Changes emboss contrast in the shared text-shadow list.' }),
  rule({ id: 'type.embossOffset', label: 'Emboss Offset', sourcePath: 'typography.emboss.offset', legacySourceKeys: ['textEmbossOffset'], valueType: 'number', min: 0, max: 100, step: 1, writes: [css('text-shadow')], slot: 'C', cost: 1, expectedResult: 'Changes emboss offset in the shared text-shadow list.' }),
  rule({ id: 'type.embossBlur', label: 'Emboss Blur', sourcePath: 'typography.emboss.blur', legacySourceKeys: ['textEmbossBlur'], valueType: 'number', min: 0, max: 100, step: 1, writes: [css('text-shadow')], slot: 'C', cost: 1, expectedResult: 'Changes emboss softness in the shared text-shadow list.' }),
  rule({ id: 'type.positionX', label: 'Text X', sourcePath: 'typography.transform.translateX', legacySourceKeys: ['textX', 'overridePosition'], valueType: 'number', unit: 'px', writes: [compiler('content-transform-x')], slot: 'C', expectedResult: 'Offsets text through the single content transform owner.' }),
  rule({ id: 'type.positionY', label: 'Text Y', sourcePath: 'typography.transform.translateY', legacySourceKeys: ['textY'], valueType: 'number', unit: 'px', writes: [compiler('content-transform-y')], slot: 'C', expectedResult: 'Offsets text through the single content transform owner.' }),
] as const satisfies readonly AuthoringControlRule[];

export const missionPaintControlRules = [
  rule({ id: 'paint.enabled', label: 'Enabled', sourcePath: 'appearance.layers.*.enabled', legacySourceKeys: [], valueType: 'boolean', writes: [compiler('paint-operation-enable')], slot: 'compiler', expectedResult: 'Includes or omits one typed paint operation without erasing its parameters.' }),
  rule({ id: 'paint.order', label: 'Layer Order', sourcePath: 'appearance.layers', legacySourceKeys: [], valueType: 'number', writes: [compiler('paint-operation-order')], slot: 'compiler', expectedResult: 'Changes authored paint order and produces an inspectable Paint IR delta.' }),
  rule({ id: 'paint.geometry.radiusPx', label: 'Round Radius', sourcePath: 'appearance.geometry.radiusPx', legacySourceKeys: [], valueType: 'number', unit: 'px', min: 0, max: 64, step: 1, writes: [css('border-radius')], slot: 'H', expectedResult: 'Changes host radius inherited by bounded helpers.' }),
  rule({ id: 'paint.geometry.chamferPx', label: 'Slant Size', sourcePath: 'appearance.geometry.chamferPx', legacySourceKeys: [], valueType: 'number', unit: 'px', min: 0, max: 64, step: 1, writes: [css('corner-shape'), css('clip-path')], slot: 'H', expectedResult: 'Changes selected chamfer depth.' }),
  rule({ id: 'paint.glass.blurPx', label: 'Blur', sourcePath: 'appearance.layers.backdropGlass.blurPx', legacySourceKeys: [], valueType: 'number', unit: 'px', min: 0, max: 64, step: 0.25, writes: [css('backdrop-filter')], slot: 'U', cost: 2, expectedResult: 'Changes backdrop blur without blurring content.' }),
  rule({ id: 'paint.layer.opacity', label: 'Opacity', sourcePath: 'appearance.layers.*.opacity', legacySourceKeys: [], valueType: 'number', unit: 'ratio', min: 0, max: 1, step: 0.01, writes: [compiler('paint-operation-opacity')], slot: 'compiler', expectedResult: 'Changes the selected paint operation alpha only.' }),
  rule({ id: 'paint.texture.scalePx', label: 'Texture Scale', sourcePath: 'appearance.layers.texture.scalePx', legacySourceKeys: [], valueType: 'number', unit: 'px', min: 4, max: 512, step: 2, writes: [css('background-size')], slot: 'H', cost: 1, expectedResult: 'Changes selected texture frequency.' }),
  rule({ id: 'paint.edgeWear.widthPx', label: 'Wear Width', sourcePath: 'appearance.layers.edgeWear.widthPx', legacySourceKeys: [], valueType: 'number', unit: 'px', min: 0.5, max: 16, step: 0.1, writes: [css('border-width')], slot: 'H::after', cost: 1, expectedResult: 'Changes inward wear width while preserving the host outline.' }),
  rule({ id: 'paint.edgeWear.scalePx', label: 'Wear Scale', sourcePath: 'appearance.layers.edgeWear.scalePx', legacySourceKeys: [], valueType: 'number', unit: 'px', min: 2, max: 96, step: 1, writes: [css('mask-size')], slot: 'H::after', cost: 1, expectedResult: 'Changes edge-wear texture frequency.' }),
  rule({ id: 'paint.metallicReflection', label: 'Metal', sourcePath: 'appearance.material', legacySourceKeys: [], valueType: 'enum', allowedValues: ['gold', 'silver', 'bronze'], writes: [paint('metallicReflection'), modeClass('has-metal-reflection')], slot: 'H', cost: 1, expectedResult: 'Selects one locked metallic material whose cached reflection film follows the global pointer or tilt vector.' }),
] as const satisfies readonly AuthoringControlRule[];

export const authoringControlRules = [
  ...legacySurfaceControlRules,
  ...layoutControlRules,
  ...typographyControlRules,
  ...missionPaintControlRules,
] as const satisfies readonly AuthoringControlRule[];

export const authoringControlRuleById = new Map(
  authoringControlRules.map((control) => [control.id, control]),
);

export const authoringControlRule = (id: string): AuthoringControlRule => {
  const found = authoringControlRuleById.get(id);
  if (!found) throw new Error(`Unknown authoring control rule: ${id}`);
  return found;
};

export const authoringControlCssProperty = (
  id: string,
  expectedProperty: string,
) => {
  const control = authoringControlRule(id);
  const declared = control.writes.some(
    (write) => write.kind === 'css-property' && write.name === expectedProperty,
  );
  if (!declared) {
    throw new Error(
      `Authoring control ${id} does not declare CSS property ${expectedProperty}.`,
    );
  }
  return expectedProperty;
};

export const controlRange = (id: string) => {
  const control = authoringControlRule(id);
  if (control.min === undefined || control.max === undefined) {
    throw new Error(`Authoring control ${id} does not define a numeric range.`);
  }
  return {
    min: control.min,
    max: control.max,
    step: control.step ?? 1,
  };
};

export interface AuthoringControlEvaluation {
  enabled: boolean;
  unmetDependencies: string[];
  activeConflicts: string[];
}

const dependencyMatches = (
  condition: string,
  values: Readonly<Record<string, unknown>>,
) => {
  const operator = condition.includes('!=') ? '!=' : '=';
  const splitAt = condition.indexOf(operator);
  if (splitAt < 1) return false;
  const key = condition.slice(0, splitAt);
  const expected = condition.slice(splitAt + operator.length);
  const actual = values[key];
  const matches = String(actual).toLowerCase() === expected.toLowerCase();
  return operator === '!=' ? !matches : matches;
};

export const evaluateAuthoringControl = (
  id: string,
  values: Readonly<Record<string, unknown>>,
  activeConflictTokens: readonly string[] = [],
): AuthoringControlEvaluation => {
  const control = authoringControlRule(id);
  const unmetDependencies = control.dependencies.filter(
    (condition) => !dependencyMatches(condition, values),
  );
  const conflictSet = new Set(activeConflictTokens);
  const activeConflicts = control.conflicts.filter((conflict) => conflictSet.has(conflict));
  return {
    enabled: unmetDependencies.length === 0 && activeConflicts.length === 0,
    unmetDependencies,
    activeConflicts,
  };
};
