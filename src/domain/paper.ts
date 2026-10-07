import type { Orientation, PaperSize } from './types';

export interface PaperDefinition {
  id: PaperSize;
  label: string;
  /** Portrait dimensions in millimetres. */
  widthMm: number;
  heightMm: number;
}

export const PAPER_SIZES: PaperDefinition[] = [
  { id: 'a4', label: 'A4 · 21 × 29.7 cm', widthMm: 210, heightMm: 297 },
  { id: 'a3', label: 'A3 · 29.7 × 42 cm', widthMm: 297, heightMm: 420 },
  { id: '30x40', label: '30 × 40 cm', widthMm: 300, heightMm: 400 },
  { id: '50x70', label: '50 × 70 cm', widthMm: 500, heightMm: 700 },
  { id: 'square', label: 'Square · 30 × 30 cm', widthMm: 300, heightMm: 300 },
];

export function getPaper(id: PaperSize): PaperDefinition {
  return PAPER_SIZES.find((paper) => paper.id === id) ?? PAPER_SIZES[0];
}

/** Paper dimensions in millimetres, taking the orientation into account. */
export function paperDimensionsMm(
  id: PaperSize,
  orientation: Orientation,
): { widthMm: number; heightMm: number } {
  const paper = getPaper(id);
  if (orientation === 'landscape') return { widthMm: paper.heightMm, heightMm: paper.widthMm };
  return { widthMm: paper.widthMm, heightMm: paper.heightMm };
}

export const EXPORT_QUALITIES = {
  standard: { label: 'Standard · 150 dpi', dpi: 150 },
  print: { label: 'Print · 300 dpi', dpi: 300 },
} as const;

export type ExportQuality = keyof typeof EXPORT_QUALITIES;

/** Keeps exports below ~36 megapixels so they work on most devices and GPUs. */
export const MAX_EXPORT_PIXELS = 36_000_000;

export function exportPixelSize(
  id: PaperSize,
  orientation: Orientation,
  quality: ExportQuality,
): { width: number; height: number; dpi: number } {
  const { widthMm, heightMm } = paperDimensionsMm(id, orientation);
  let dpi: number = EXPORT_QUALITIES[quality].dpi;
  const pixelsAt = (d: number) => (widthMm / 25.4) * d * ((heightMm / 25.4) * d);
  if (pixelsAt(dpi) > MAX_EXPORT_PIXELS) {
    dpi = Math.floor(dpi * Math.sqrt(MAX_EXPORT_PIXELS / pixelsAt(dpi)));
  }
  return {
    width: Math.round((widthMm / 25.4) * dpi),
    height: Math.round((heightMm / 25.4) * dpi),
    dpi,
  };
}
