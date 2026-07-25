import { create, type Font as FontkitFont, type FontCollection, type PathCommand } from 'fontkit';
import { FontLoader, type FontData as ThreeFontData } from 'three/examples/jsm/loaders/FontLoader.js';
import type { CardBackFont } from './cardBackTypes';
import { registerLocalCardBackFont } from './cardBackTypeface';

const number = (value: number | undefined) => Number((value ?? 0).toFixed(3));

const outlineCommand = ({ command, args }: PathCommand) => {
  switch (command) {
    case 'moveTo': return `m ${number(args[0])} ${number(args[1])}`;
    case 'lineTo': return `l ${number(args[0])} ${number(args[1])}`;
    case 'quadraticCurveTo': return `q ${number(args[2])} ${number(args[3])} ${number(args[0])} ${number(args[1])}`;
    case 'bezierCurveTo': return `b ${number(args[4])} ${number(args[5])} ${number(args[0])} ${number(args[1])} ${number(args[2])} ${number(args[3])}`;
    case 'closePath': return '';
  }
};

const isFontCollection = (font: FontkitFont | FontCollection): font is FontCollection =>
  font.type === 'TTC' || font.type === 'DFont';

const requestedPostscriptName = (id: CardBackFont) =>
  id.startsWith('local:file:') ? undefined : id.slice('local:'.length);

const parseFont = (id: CardBackFont, buffer: ArrayBuffer) => {
  const parsed = create(new Uint8Array(buffer) as unknown as Parameters<typeof create>[0]);
  if (!isFontCollection(parsed)) return parsed;
  const requested = requestedPostscriptName(id);
  const selected = requested ? parsed.getFont(requested) : parsed.fonts[0];
  if (!selected) throw new Error('The font collection did not contain a usable face.');
  return selected;
};

const glyphData = (font: FontkitFont, codePoint: number) => {
  const glyph = font.glyphForCodePoint(codePoint);
  return {
    ha: number(glyph.advanceWidth ?? font.unitsPerEm * 0.5),
    x_min: number(glyph.bbox.minX),
    x_max: number(glyph.bbox.maxX),
    o: glyph.path.commands.map(outlineCommand).filter(Boolean).join(' '),
  };
};

const toThreeFontData = (font: FontkitFont): ThreeFontData => {
  const glyphs: ThreeFontData['glyphs'] = {};
  const glyphCache = new Map<number, ReturnType<typeof glyphData>>();

  for (const codePoint of font.characterSet) {
    const glyph = font.glyphForCodePoint(codePoint);
    let data = glyphCache.get(glyph.id);
    if (!data) {
      data = glyphData(font, codePoint);
      glyphCache.set(glyph.id, data);
    }
    glyphs[String.fromCodePoint(codePoint)] = data;
  }

  glyphs['?'] ??= glyphData(font, font.hasGlyphForCodePoint(63) ? 63 : 0);

  return {
    glyphs,
    familyName: font.familyName || 'Local font',
    ascender: font.ascent,
    descender: font.descent,
    underlinePosition: font.underlinePosition ?? -font.unitsPerEm * 0.1,
    underlineThickness: font.underlineThickness ?? font.unitsPerEm * 0.05,
    boundingBox: {
      xMin: number(font.bbox.minX),
      xMax: number(font.bbox.maxX),
      yMin: number(font.bbox.minY),
      yMax: number(font.bbox.maxY),
    },
    resolution: font.unitsPerEm,
    original_font_information: {
      full_font_name: font.fullName || '',
      postscript_name: font.postscriptName || '',
    },
  };
};

export const loadLocalCardBackFont = (id: CardBackFont, buffer: ArrayBuffer) => {
  const font = parseFont(id, buffer);
  const threeFont = new FontLoader().parse(toThreeFontData(font));
  registerLocalCardBackFont(id, threeFont);
  return {
    family: font.familyName || 'Local font',
    style: font.subfamilyName || 'Regular',
  };
};
