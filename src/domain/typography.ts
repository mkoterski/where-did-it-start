import type { BodyFont, TitleFont } from './types';

export interface FontFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** Generic CSS family used until (or if) the web font is not available. */
  fallback?: 'serif' | 'sans-serif' | 'cursive' | 'monospace';
}

export interface TitleFontDefinition extends FontFace {
  id: TitleFont;
  label: string;
  /** Script faces are optically smaller than serif/sans faces at the same size. */
  sizeFactor: number;
  letterSpacing: number;
}

export const TITLE_FONTS: TitleFontDefinition[] = [
  {
    id: 'sacramento',
    label: 'Handwritten (Sacramento)',
    family: 'Sacramento',
    weight: 400,
    style: 'normal',
    sizeFactor: 1.18,
    letterSpacing: 0,
  },
  {
    id: 'great-vibes',
    label: 'Calligraphy (Great Vibes)',
    family: 'Great Vibes',
    weight: 400,
    style: 'normal',
    sizeFactor: 0.98,
    letterSpacing: 0,
  },
  {
    id: 'playfair',
    label: 'Serif italic (Playfair Display)',
    family: 'Playfair Display',
    weight: 400,
    style: 'italic',
    fallback: 'serif',
    sizeFactor: 0.66,
    letterSpacing: 0,
  },
  {
    id: 'jost',
    label: 'Modern sans (Jost)',
    family: 'Jost',
    weight: 300,
    style: 'normal',
    sizeFactor: 0.6,
    letterSpacing: 1,
  },
];

/** Default faces; the detail face is also used for the map credit line. */
export const NAMES_FONT: FontFace = { family: 'Jost', weight: 400, style: 'normal' };
export const DETAIL_FONT: FontFace = { family: 'Jost', weight: 300, style: 'normal' };

export interface BodyFontDefinition {
  id: BodyFont;
  label: string;
  /** Face for the names line. */
  names: FontFace;
  /** Face for the place and coordinates line. */
  detail: FontFace;
  /** Compensates for faces that look smaller or wider at the same size. */
  sizeFactor: number;
  namesLetterSpacing: number;
  detailLetterSpacing: number;
}

export const BODY_FONTS: BodyFontDefinition[] = [
  {
    id: 'jost',
    label: 'Modern sans (Jost)',
    names: NAMES_FONT,
    detail: DETAIL_FONT,
    sizeFactor: 1,
    namesLetterSpacing: 0.6,
    detailLetterSpacing: 1.1,
  },
  {
    id: 'cormorant',
    label: 'Elegant serif (Cormorant Garamond)',
    names: { family: 'Cormorant Garamond', weight: 500, style: 'normal', fallback: 'serif' },
    detail: { family: 'Cormorant Garamond', weight: 500, style: 'normal', fallback: 'serif' },
    sizeFactor: 1.2,
    namesLetterSpacing: 0.4,
    detailLetterSpacing: 0.9,
  },
  {
    id: 'josefin',
    label: 'Vintage sans (Josefin Sans)',
    names: { family: 'Josefin Sans', weight: 400, style: 'normal', fallback: 'sans-serif' },
    detail: { family: 'Josefin Sans', weight: 300, style: 'normal', fallback: 'sans-serif' },
    sizeFactor: 1.05,
    namesLetterSpacing: 1,
    detailLetterSpacing: 1.4,
  },
  {
    id: 'courier',
    label: 'Typewriter (Courier Prime)',
    names: { family: 'Courier Prime', weight: 400, style: 'normal', fallback: 'monospace' },
    detail: { family: 'Courier Prime', weight: 400, style: 'normal', fallback: 'monospace' },
    sizeFactor: 0.92,
    namesLetterSpacing: 0,
    detailLetterSpacing: 0.2,
  },
];

export function getBodyFont(id: BodyFont): BodyFontDefinition {
  return BODY_FONTS.find((font) => font.id === id) ?? BODY_FONTS[0];
}

export function getTitleFont(id: TitleFont): TitleFontDefinition {
  return TITLE_FONTS.find((font) => font.id === id) ?? TITLE_FONTS[0];
}

export function cssFont(face: FontFace, size: number): string {
  return `${face.style} ${face.weight} ${size}px "${face.family}"`;
}

/** SVG/CSS font-family value with sensible fallbacks. */
export function fontStack(face: FontFace): string {
  const fallback = face.fallback ?? (face.family === 'Jost' ? 'sans-serif' : 'cursive');
  return `'${face.family}', ${fallback}`;
}
