import type { SurfaceOptions } from './surfaceSchema';
import { edgeTextureOptions, textureOptions } from './TextureOptions';
import {
  materialRecipeBorderColors,
  materialRecipeCorners,
  materialRecipeEdges,
  materialRecipeGradients,
  materialRecipeTextureScales,
  materialRecipeTints,
} from './MaterialRecipeTypes';

export type SurfaceFieldGroup =
  | 'renderer'
  | 'base'
  | 'shape'
  | 'texture'
  | 'glass'
  | 'lighting'
  | 'border'
  | 'edgeWear'
  | 'shadow'
  | 'content'
  | 'emission'
  | 'motion'
  | 'state';

export type SurfaceFieldControl =
  | 'toggle'
  | 'multi-toggle'
  | 'slider'
  | 'select'
  | 'color'
  | 'text'
  | 'json'
  | 'none';

export type SurfaceFieldEditMode =
  | 'rest'
  | 'state'
  | 'rest-and-state'
  | 'renderer-internal';

export interface SurfaceFieldDefinition<K extends keyof SurfaceOptions = keyof SurfaceOptions> {
  key: K;
  group: SurfaceFieldGroup;
  label: string;
  control: SurfaceFieldControl;
  editMode: SurfaceFieldEditMode;
  min?: number;
  max?: number;
  step?: number;
  valueStops?: readonly number[];
  options?: readonly string[];
  optionLabels?: Partial<Record<string, string>>;
}

const field = <K extends keyof SurfaceOptions>(definition: SurfaceFieldDefinition<K>) => definition;
const optionLabels = <T extends readonly { id: string; label: string }[]>(options: T) => Object.fromEntries(
  options.map((option) => [option.id, option.label]),
) as Partial<Record<T[number]['id'], string>>;

const edgeTextureIds = edgeTextureOptions.map((option) => option.id);
const edgeTextureLabels = optionLabels(edgeTextureOptions);
const textureIds = textureOptions.map((option) => option.id);
const textureLabels = optionLabels(textureOptions);
const materialOptionLabels = {
  none: 'none',
  black: 'pure black',
  white: 'pure white',
  gray: '50% gray',
  custom: 'color',
} satisfies Partial<Record<string, string>>;
const gradientOptionLabels = {
  'top-light': 'top',
  'bottom-dark': 'bottom',
} satisfies Partial<Record<string, string>>;
const borderColorLabels = {
  inherit: 'inherit',
  black: 'pure black',
  white: 'pure white',
  gray: '50% gray',
  custom: 'color',
} satisfies Partial<Record<string, string>>;
const bevelCornerLabels = {
  'top-left': 'TL',
  'top-right': 'TR',
  'bottom-left': 'BL',
  'bottom-right': 'BR',
} satisfies Partial<Record<string, string>>;

export const surfaceFieldDefinitions = [
  field({ key: 'renderMode', group: 'renderer', label: 'Render Mode', control: 'select', editMode: 'renderer-internal', options: ['editor', 'runtime', 'export'] }),
  field({ key: 'material', group: 'base', label: 'Base', control: 'select', editMode: 'rest', options: ['none', 'black', 'white', 'gray', 'custom'], optionLabels: materialOptionLabels }),
  field({ key: 'materialColor', group: 'base', label: 'Color', control: 'color', editMode: 'rest' }),
  field({ key: 'glass', group: 'glass', label: 'Enabled', control: 'toggle', editMode: 'rest' }),
  field({ key: 'texture', group: 'texture', label: 'Texture', control: 'select', editMode: 'rest', options: textureIds, optionLabels: textureLabels }),
  field({ key: 'shape', group: 'shape', label: 'Shape', control: 'select', editMode: 'rest', options: ['rect', 'bevel'] }),
  field({ key: 'bevelCorners', group: 'shape', label: 'Bevel', control: 'multi-toggle', editMode: 'rest', options: materialRecipeCorners, optionLabels: bevelCornerLabels }),
  field({ key: 'bevelSize', group: 'shape', label: 'Bevel Size', control: 'slider', editMode: 'rest', min: 0, max: 30, step: 1 }),
  field({ key: 'corners', group: 'lighting', label: 'Glow Corners', control: 'json', editMode: 'rest-and-state' }),
  field({ key: 'edgeHighlight', group: 'lighting', label: 'Glow Edges', control: 'json', editMode: 'rest-and-state' }),
  field({ key: 'border', group: 'border', label: 'Sides', control: 'multi-toggle', editMode: 'rest', options: materialRecipeEdges }),
  field({ key: 'glow', group: 'lighting', label: 'Glow Tone', control: 'select', editMode: 'rest-and-state' }),
  field({ key: 'tint', group: 'lighting', label: 'Tint', control: 'select', editMode: 'rest-and-state', options: materialRecipeTints }),
  field({ key: 'gradient', group: 'lighting', label: 'Mode', control: 'select', editMode: 'rest', options: materialRecipeGradients, optionLabels: gradientOptionLabels }),
  field({ key: 'sheen', group: 'lighting', label: 'Side Sheen', control: 'toggle', editMode: 'rest' }),
  field({ key: 'selected', group: 'state', label: 'Selected', control: 'toggle', editMode: 'renderer-internal' }),
  field({ key: 'interactive', group: 'state', label: 'Interactive', control: 'toggle', editMode: 'renderer-internal' }),
  field({ key: 'hoverPreview', group: 'state', label: 'Hover Preview', control: 'toggle', editMode: 'renderer-internal' }),
  field({ key: 'textureStrength', group: 'texture', label: 'Tex Opacity', control: 'slider', editMode: 'rest', min: 0, max: 100, step: 1 }),
  field({ key: 'textureScale', group: 'texture', label: 'Tex Scale', control: 'slider', editMode: 'rest', valueStops: materialRecipeTextureScales }),
  field({ key: 'glowStrength', group: 'lighting', label: 'Glow Strength', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'tintStrength', group: 'lighting', label: 'Tint Power', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'glassOpacity', group: 'glass', label: 'Alpha', control: 'slider', editMode: 'rest', min: 1, max: 100, step: 1 }),
  field({ key: 'glassReflectionOpacity', group: 'glass', label: 'Reflection', control: 'slider', editMode: 'rest', min: 1, max: 100, step: 1 }),
  field({ key: 'glassBlurEnabled', group: 'glass', label: 'Glass Blur Enabled', control: 'toggle', editMode: 'rest' }),
  field({ key: 'glassBlur', group: 'glass', label: 'Glass Blur', control: 'slider', editMode: 'rest', min: 0, max: 24, step: 0.25 }),
  field({ key: 'glassShine', group: 'glass', label: 'Shine', control: 'toggle', editMode: 'rest' }),
  field({ key: 'glassHighlightWidth', group: 'glass', label: 'Shine Width', control: 'slider', editMode: 'rest', min: 0, max: 100, step: 1 }),
  field({ key: 'glassHighlightHeight', group: 'glass', label: 'Shine Height', control: 'slider', editMode: 'rest', min: 0, max: 100, step: 1 }),
  field({ key: 'glassHighlightY', group: 'glass', label: 'Shine Y', control: 'slider', editMode: 'rest', min: 0, max: 100, step: 1 }),
  field({ key: 'borderEnabled', group: 'border', label: 'Enabled', control: 'toggle', editMode: 'rest' }),
  field({ key: 'borderColor', group: 'border', label: 'Color', control: 'select', editMode: 'rest', options: materialRecipeBorderColors, optionLabels: borderColorLabels }),
  field({ key: 'borderCustomColor', group: 'border', label: 'Color Pick', control: 'color', editMode: 'rest' }),
  field({ key: 'borderLit', group: 'border', label: 'Lit', control: 'toggle', editMode: 'rest' }),
  field({ key: 'borderOpacity', group: 'border', label: 'Alpha', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'lightStrength', group: 'lighting', label: 'White', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'darkStrength', group: 'lighting', label: 'Dark', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'surfaceFilterBrightness', group: 'lighting', label: 'Host Brightness', control: 'slider', editMode: 'rest-and-state', min: 0, max: 3, step: 0.01 }),
  field({ key: 'surfaceLayerBrightness', group: 'lighting', label: 'Layer Brightness', control: 'slider', editMode: 'rest-and-state', min: 0, max: 3, step: 0.01 }),
  field({ key: 'edgeWear', group: 'edgeWear', label: 'Edge Wear', control: 'toggle', editMode: 'rest' }),
  field({ key: 'edgeWearTexture', group: 'edgeWear', label: 'Edge Wear Texture', control: 'select', editMode: 'rest', options: edgeTextureIds, optionLabels: edgeTextureLabels }),
  field({ key: 'edgeWearOpacity', group: 'edgeWear', label: 'Edge Wear Opacity', control: 'slider', editMode: 'rest', min: 0, max: 100, step: 1 }),
  field({ key: 'edgeWearWidth', group: 'edgeWear', label: 'Edge Wear Width', control: 'slider', editMode: 'rest', min: 0, max: 200, step: 1 }),
  field({ key: 'edgeWearScale', group: 'edgeWear', label: 'Edge Wear Scale', control: 'slider', editMode: 'rest', min: 1, max: 4096, step: 1 }),
  field({ key: 'edgeWearLayer', group: 'edgeWear', label: 'Edge Wear Layer', control: 'select', editMode: 'rest', options: ['below-highlights', 'above-highlights'] }),
  field({ key: 'dropShadow', group: 'shadow', label: 'Drop Shadow', control: 'toggle', editMode: 'rest' }),
  field({ key: 'shadowOpacity', group: 'shadow', label: 'Shadow Opacity', control: 'slider', editMode: 'rest', min: 0, max: 100, step: 1 }),
  field({ key: 'shadowBlur', group: 'shadow', label: 'Shadow Blur', control: 'slider', editMode: 'rest', min: 0, max: 80, step: 1 }),
  field({ key: 'shadowX', group: 'shadow', label: 'Shadow X', control: 'slider', editMode: 'rest', min: -60, max: 60, step: 1 }),
  field({ key: 'shadowY', group: 'shadow', label: 'Shadow Y', control: 'slider', editMode: 'rest', min: -20, max: 60, step: 1 }),
  field({ key: 'shadowSpread', group: 'shadow', label: 'Shadow Spread', control: 'slider', editMode: 'rest', min: -20, max: 40, step: 1 }),
  field({ key: 'cornerSize', group: 'lighting', label: 'Corner Size', control: 'slider', editMode: 'rest-and-state', min: 0, max: 200, step: 1 }),
  field({ key: 'radius', group: 'shape', label: 'Radius', control: 'slider', editMode: 'rest', min: 0, max: 30, step: 1 }),
  field({ key: 'textContent', group: 'content', label: 'Text Content', control: 'text', editMode: 'rest' }),
  field({ key: 'contentLayer', group: 'content', label: 'Content Layer', control: 'select', editMode: 'rest', options: ['over-glass', 'under-glass'] }),
  field({ key: 'textFontFamily', group: 'content', label: 'Font Family', control: 'text', editMode: 'rest-and-state' }),
  field({ key: 'textSizeRem', group: 'content', label: 'Text Size', control: 'slider', editMode: 'rest-and-state', min: 0, max: 20, step: 0.01 }),
  field({ key: 'contentOpacity', group: 'content', label: 'Content Opacity', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'contentTone', group: 'content', label: 'Content Tone', control: 'select', editMode: 'rest-and-state' }),
  field({ key: 'iconTone', group: 'content', label: 'Icon Tone', control: 'select', editMode: 'rest-and-state' }),
  field({ key: 'contentGlowStrength', group: 'content', label: 'Content Glow', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'iconGlowStrength', group: 'content', label: 'Icon Glow', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'fontWeight', group: 'content', label: 'Font Weight', control: 'select', editMode: 'rest-and-state' }),
  field({ key: 'fontStyle', group: 'content', label: 'Font Style', control: 'select', editMode: 'rest-and-state', options: ['normal', 'italic'] }),
  field({ key: 'textTransform', group: 'content', label: 'Text Transform', control: 'select', editMode: 'rest-and-state', options: ['none', 'uppercase', 'lowercase', 'capitalize'] }),
  field({ key: 'letterSpacing', group: 'content', label: 'Letter Spacing', control: 'slider', editMode: 'rest-and-state', min: -5, max: 5, step: 0.01 }),
  field({ key: 'textEmboss', group: 'content', label: 'Text Emboss', control: 'toggle', editMode: 'rest-and-state' }),
  field({ key: 'textAlign', group: 'content', label: 'Text Align', control: 'select', editMode: 'rest', options: ['left', 'center', 'right'] }),
  field({ key: 'textX', group: 'content', label: 'Text X', control: 'slider', editMode: 'rest-and-state', min: -1000, max: 1000, step: 1 }),
  field({ key: 'textY', group: 'content', label: 'Text Y', control: 'slider', editMode: 'rest-and-state', min: -1000, max: 1000, step: 1 }),
  field({ key: 'emission', group: 'emission', label: 'Emission', control: 'select', editMode: 'rest-and-state', options: ['none', 'line', 'center-blip', 'rail-and-blip'] }),
  field({ key: 'emissionEdge', group: 'emission', label: 'Emission Edge', control: 'select', editMode: 'rest-and-state', options: ['bottom'] }),
  field({ key: 'emissionTone', group: 'emission', label: 'Emission Tone', control: 'select', editMode: 'rest-and-state' }),
  field({ key: 'emissionStrength', group: 'emission', label: 'Emission Strength', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'emissionLength', group: 'emission', label: 'Emission Length', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'emissionThickness', group: 'emission', label: 'Emission Thickness', control: 'slider', editMode: 'rest-and-state', min: 0, max: 100, step: 1 }),
  field({ key: 'emissionBlipSize', group: 'emission', label: 'Emission Blip Size', control: 'slider', editMode: 'rest-and-state', min: 0, max: 200, step: 1 }),
  field({ key: 'stateScale', group: 'motion', label: 'State Scale', control: 'slider', editMode: 'state', min: 0.94, max: 1.04, step: 0.005 }),
  field({ key: 'stateTranslateY', group: 'motion', label: 'State Translate Y', control: 'slider', editMode: 'state', min: -4, max: 4, step: 1 }),
  field({ key: 'stateful', group: 'state', label: 'Stateful', control: 'toggle', editMode: 'renderer-internal' }),
  field({ key: 'stateVars', group: 'state', label: 'State Vars', control: 'json', editMode: 'renderer-internal' }),
  field({ key: 'visualState', group: 'state', label: 'Visual State', control: 'select', editMode: 'renderer-internal', options: ['rest', 'active', 'pressed'] }),
] as const satisfies readonly SurfaceFieldDefinition[];

export const surfaceFieldDefinitionByKey = Object.fromEntries(
  surfaceFieldDefinitions.map((definition) => [definition.key, definition]),
) as Record<keyof SurfaceOptions, SurfaceFieldDefinition>;
