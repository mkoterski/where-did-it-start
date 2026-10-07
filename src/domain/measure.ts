import { cssFont, type FontFace } from './typography';

export type TextMeasurer = (
  text: string,
  face: FontFace,
  size: number,
  letterSpacing: number,
) => number;

let context: CanvasRenderingContext2D | null | undefined;

function getContext(): CanvasRenderingContext2D | null {
  if (context !== undefined) return context;
  context =
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  return context;
}

/** Measures text with the real font when available, otherwise estimates. */
export const measureText: TextMeasurer = (text, face, size, letterSpacing) => {
  const ctx = getContext();
  const spacing = letterSpacing * Math.max(0, text.length - 1);
  if (!ctx) return text.length * size * 0.5 + spacing;
  ctx.font = cssFont(face, size);
  return ctx.measureText(text).width + spacing;
};

/** Returns the largest size ≤ `preferred` at which `text` fits into `maxWidth`. */
export function fitFontSize(
  text: string,
  face: FontFace,
  preferred: number,
  maxWidth: number,
  letterSpacing = 0,
  measure: TextMeasurer = measureText,
): number {
  if (!text) return preferred;
  const width = measure(text, face, preferred, letterSpacing);
  if (width <= maxWidth) return preferred;
  return Math.max(8, Math.floor(preferred * (maxWidth / width) * 100) / 100);
}
