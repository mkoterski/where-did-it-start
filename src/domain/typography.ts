import type { TitleFont } from './types';

export interface FontFace {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
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

export const NAMES_FONT: FontFace = { family: 'Jost', weight: 400, style: 'normal' };
export const DETAIL_FONT: FontFace = { family: 'Jost', weight: 300, style: 'normal' };

export function getTitleFont(id: TitleFont): TitleFontDefinition {
  return TITLE_FONTS.find((font) => font.id === id) ?? TITLE_FONTS[0];
}

export function cssFont(face: FontFace, size: number): string {
  return `${face.style} ${face.weight} ${size}px "${face.family}"`;
}

/** SVG/CSS font-family value with sensible fallbacks. */
export function fontStack(face: FontFace): string {
  const fallback = face.family === 'Jost' ? 'sans-serif' : 'cursive';
  return `'${face.family}', ${fallback}`;
}
