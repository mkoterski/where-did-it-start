import sacramento400NormalLatin from '@fontsource/sacramento/files/sacramento-latin-400-normal.woff?url';
import sacramento400NormalLatinExt from '@fontsource/sacramento/files/sacramento-latin-ext-400-normal.woff?url';
import greatVibes400NormalLatin from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff?url';
import greatVibes400NormalLatinExt from '@fontsource/great-vibes/files/great-vibes-latin-ext-400-normal.woff?url';
import playfairDisplay400ItalicLatin from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff?url';
import playfairDisplay400ItalicLatinExt from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-italic.woff?url';
import jost300NormalLatin from '@fontsource/jost/files/jost-latin-300-normal.woff?url';
import jost300NormalLatinExt from '@fontsource/jost/files/jost-latin-ext-300-normal.woff?url';
import jost400NormalLatin from '@fontsource/jost/files/jost-latin-400-normal.woff?url';
import jost400NormalLatinExt from '@fontsource/jost/files/jost-latin-ext-400-normal.woff?url';
import cormorantGaramond500NormalLatin from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff?url';
import cormorantGaramond500NormalLatinExt from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-ext-500-normal.woff?url';
import josefinSans300NormalLatin from '@fontsource/josefin-sans/files/josefin-sans-latin-300-normal.woff?url';
import josefinSans300NormalLatinExt from '@fontsource/josefin-sans/files/josefin-sans-latin-ext-300-normal.woff?url';
import josefinSans400NormalLatin from '@fontsource/josefin-sans/files/josefin-sans-latin-400-normal.woff?url';
import josefinSans400NormalLatinExt from '@fontsource/josefin-sans/files/josefin-sans-latin-ext-400-normal.woff?url';
import courierPrime400NormalLatin from '@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff?url';
import courierPrime400NormalLatinExt from '@fontsource/courier-prime/files/courier-prime-latin-ext-400-normal.woff?url';
import { parse, type Font, type Glyph } from 'opentype.js';

/**
 * Converts the poster's SVG <text> into vector outlines (<path>), so vector exports look the
 * same in every viewer, editor and PDF without embedding web fonts. Uses the WOFF builds of
 * the same fonts the preview uses (latin first, then latin-ext for other characters).
 */

const FONT_FILES: Record<string, [string, string]> = {
  'Sacramento|400|normal': [sacramento400NormalLatin, sacramento400NormalLatinExt],
  'Great Vibes|400|normal': [greatVibes400NormalLatin, greatVibes400NormalLatinExt],
  'Playfair Display|400|italic': [playfairDisplay400ItalicLatin, playfairDisplay400ItalicLatinExt],
  'Jost|300|normal': [jost300NormalLatin, jost300NormalLatinExt],
  'Jost|400|normal': [jost400NormalLatin, jost400NormalLatinExt],
  'Cormorant Garamond|500|normal': [
    cormorantGaramond500NormalLatin,
    cormorantGaramond500NormalLatinExt,
  ],
  'Josefin Sans|300|normal': [josefinSans300NormalLatin, josefinSans300NormalLatinExt],
  'Josefin Sans|400|normal': [josefinSans400NormalLatin, josefinSans400NormalLatinExt],
  'Courier Prime|400|normal': [courierPrime400NormalLatin, courierPrime400NormalLatinExt],
};

const fontCache = new Map<string, Promise<Font>>();

function loadFont(url: string): Promise<Font> {
  let pending = fontCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font request failed (${response.status})`);
        return response.arrayBuffer();
      })
      .then((buffer) => parse(buffer));
    fontCache.set(url, pending);
    pending.catch(() => fontCache.delete(url));
  }
  return pending;
}

export function faceKey(family: string, weight: string | number, style: string): string {
  return `${family}|${weight}|${style}`;
}

/** First family name of a CSS font-family list: "'Jost', sans-serif" → "Jost". */
export function primaryFamily(fontFamily: string): string {
  return fontFamily
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

export interface OutlineOptions {
  x: number;
  y: number;
  fontSize: number;
  letterSpacing: number;
  anchor: 'start' | 'middle' | 'end';
}

/**
 * Lays out `text` like SVG text (baseline at y, anchored at x, kerning and letter-spacing)
 * and returns the glyph outlines as path data.
 */
export function outlineText(fonts: Font[], text: string, options: OutlineOptions): string {
  const { fontSize, letterSpacing } = options;
  const placed: Array<{ font: Font; glyph: Glyph; advance: number }> = [];
  for (const char of Array.from(text)) {
    let font = fonts[0];
    let glyph = font.charToGlyph(char);
    for (const candidate of fonts) {
      const found = candidate.charToGlyph(char);
      if (found && found.index !== 0) {
        font = candidate;
        glyph = found;
        break;
      }
    }
    const scale = fontSize / font.unitsPerEm;
    const previous = placed[placed.length - 1];
    if (previous && previous.font === font) {
      previous.advance += font.getKerningValue(previous.glyph, glyph) * scale;
    }
    placed.push({ font, glyph, advance: (glyph.advanceWidth ?? 0) * scale + letterSpacing });
  }

  const width = placed.reduce((sum, item) => sum + item.advance, 0) - letterSpacing;
  let x = options.x;
  if (options.anchor === 'middle') x -= width / 2;
  if (options.anchor === 'end') x -= width;

  let d = '';
  for (const item of placed) {
    d += item.glyph.getPath(x, options.y, fontSize).toPathData(2);
    x += item.advance;
  }
  return d;
}

/** Replaces every <text> in an SVG document with an equivalent outlined <path>. */
export async function outlineSvgText(markup: string): Promise<string> {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const texts = Array.from(doc.getElementsByTagName('text'));
  const faces = new Map<string, Font[]>();

  for (const text of texts) {
    const key = faceKey(
      primaryFamily(text.getAttribute('font-family') ?? 'Jost'),
      text.getAttribute('font-weight') ?? 400,
      text.getAttribute('font-style') ?? 'normal',
    );
    if (!faces.has(key)) {
      const files = FONT_FILES[key] ?? FONT_FILES[faceKey('Jost', 400, 'normal')];
      faces.set(key, await Promise.all(files.map(loadFont)));
    }
  }

  for (const text of texts) {
    const key = faceKey(
      primaryFamily(text.getAttribute('font-family') ?? 'Jost'),
      text.getAttribute('font-weight') ?? 400,
      text.getAttribute('font-style') ?? 'normal',
    );
    const d = outlineText(faces.get(key)!, text.textContent ?? '', {
      x: Number(text.getAttribute('x') ?? 0),
      y: Number(text.getAttribute('y') ?? 0),
      fontSize: Number(text.getAttribute('font-size') ?? 16),
      letterSpacing: Number(text.getAttribute('letter-spacing') ?? 0),
      anchor: (text.getAttribute('text-anchor') as OutlineOptions['anchor']) ?? 'start',
    });
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    for (const attribute of ['fill', 'fill-opacity']) {
      const value = text.getAttribute(attribute);
      if (value !== null) path.setAttribute(attribute, value);
    }
    text.replaceWith(path);
  }
  return new XMLSerializer().serializeToString(doc);
}
