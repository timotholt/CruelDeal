import * as THREE from 'three';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import optimerBold from 'three/examples/fonts/optimer_bold.typeface.json';
import gentilisBold from 'three/examples/fonts/gentilis_bold.typeface.json';
import droidSansBold from 'three/examples/fonts/droid/droid_sans_bold.typeface.json';
import droidSansMono from 'three/examples/fonts/droid/droid_sans_mono_regular.typeface.json';
import { FontLoader, type Font, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import type { CardBackBundledFont, CardBackFont } from './cardBackTypes';

const loader = new FontLoader();
const fonts = {
  industrial: loader.parse(helvetikerBold as FontData),
  technical: loader.parse(optimerBold as FontData),
  grotesk: loader.parse(droidSansBold as FontData),
  monospace: loader.parse(droidSansMono as FontData),
  classic: loader.parse(gentilisBold as FontData),
} satisfies Record<CardBackBundledFont, Font>;

const localFonts = new Map<CardBackFont, Font>();

export const CARD_BACK_FONT_OPTIONS: ReadonlyArray<{ id: CardBackBundledFont; label: string }> = [
  { id: 'industrial', label: 'Industrial' },
  { id: 'technical', label: 'Technical' },
  { id: 'grotesk', label: 'Grotesk' },
  { id: 'monospace', label: 'Monospace' },
  { id: 'classic', label: 'Classic' },
];

export const registerLocalCardBackFont = (id: CardBackFont, font: Font) => {
  localFonts.set(id, font);
};

export const getCardBackFont = (font: CardBackFont) => {
  if (font.startsWith('local:')) {
    const local = localFonts.get(font);
    if (!local) throw new Error(`Local card-back font is not loaded: ${font}`);
    return local;
  }
  return fonts[font];
};

export type CardBackTextAlign = 'left' | 'center' | 'right';
const textGeometryCache = new Map<string, { pathData: string; minX: number; maxX: number }>();
const MAX_TEXT_GEOMETRY_CACHE = 256;

const number = (value: number) => Number(value.toFixed(3));

const curvePath = (path: THREE.Path, offsetX = 0) => {
  if (path.curves.length === 0) return '';
  const first = path.curves[0].getPoint(0);
  let data = `M${number(first.x + offsetX)} ${number(first.y)}`;
  for (const curve of path.curves) {
    if (curve instanceof THREE.LineCurve) {
      data += `L${number(curve.v2.x + offsetX)} ${number(curve.v2.y)}`;
    } else if (curve instanceof THREE.QuadraticBezierCurve) {
      data += `Q${number(curve.v1.x + offsetX)} ${number(curve.v1.y)} ${number(curve.v2.x + offsetX)} ${number(curve.v2.y)}`;
    } else if (curve instanceof THREE.CubicBezierCurve) {
      data += `C${number(curve.v1.x + offsetX)} ${number(curve.v1.y)} ${number(curve.v2.x + offsetX)} ${number(curve.v2.y)} ${number(curve.v3.x + offsetX)} ${number(curve.v3.y)}`;
    } else {
      for (const point of curve.getPoints(12).slice(1)) {
        data += `L${number(point.x + offsetX)} ${number(point.y)}`;
      }
    }
  }
  return `${data}Z`;
};

export const getCardBackTextLayout = (
  font: CardBackFont,
  text: string,
  size: number,
  anchorX: number,
  baselineY: number,
  align: CardBackTextAlign,
  spacing = 0,
) => {
  const content = text || ' ';
  const cacheKey = [font, content, size, spacing].join('\u0000');
  let geometry = textGeometryCache.get(cacheKey);
  if (!geometry) {
    const loadedFont = getCardBackFont(font);
    const bounds = new THREE.Box2();
    const paths: string[] = [];
    let cursor = 0;
    for (const character of Array.from(content)) {
      const shapes = loadedFont.generateShapes(character, size);
      for (const shape of shapes) {
        for (const point of shape.getPoints(16)) bounds.expandByPoint(new THREE.Vector2(point.x + cursor, point.y));
        for (const hole of shape.holes) {
          for (const point of hole.getPoints(16)) bounds.expandByPoint(new THREE.Vector2(point.x + cursor, point.y));
        }
        paths.push([curvePath(shape, cursor), ...shape.holes.map(hole => curvePath(hole, cursor))].join(''));
      }
      const glyph = loadedFont.data.glyphs[character] ?? loadedFont.data.glyphs['?'];
      cursor += (glyph?.ha ?? loadedFont.data.resolution * 0.5) * size / loadedFont.data.resolution + spacing;
    }
    geometry = {
      pathData: paths.join(''),
      minX: Number.isFinite(bounds.min.x) ? bounds.min.x : 0,
      maxX: Number.isFinite(bounds.max.x) ? bounds.max.x : 0,
    };
    if (textGeometryCache.size >= MAX_TEXT_GEOMETRY_CACHE) {
      textGeometryCache.delete(textGeometryCache.keys().next().value!);
    }
    textGeometryCache.set(cacheKey, geometry);
  }
  const originX = align === 'center'
    ? anchorX - (geometry.minX + geometry.maxX) / 2
    : align === 'right'
      ? anchorX - geometry.maxX
      : anchorX - geometry.minX;
  return {
    pathData: geometry.pathData,
    transform: `translate(${number(originX)} ${number(baselineY)}) scale(1 -1)`,
  };
};
