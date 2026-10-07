import rough from 'roughjs';
import { mixColors } from './colors';
import { getShape } from './shapes';
import type { MarkerShape, MarkerStyle } from './types';

/** One SVG path of a marker, in the shape's 100 × 100 box. */
export interface MarkerPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}

const generator = rough.generator();

/**
 * Fixed seed: the hand-drawn wobble must look exactly the same in the editor, the preview
 * and every export, so it is "random" only once.
 */
const SEED = 7;

const cache = new Map<string, MarkerPath[]>();

function isHex(color: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(color);
}

/**
 * The paths that draw a marker symbol. "clean" is the plain vector shape; "drawn" looks
 * like it was coloured in with a felt-tip pen; "sketch" like a pencil drawing with hatching.
 * Hand-drawn styles consist of strokes only (fills are drawn as overlapping pen strokes).
 * `color` may also be `currentColor` (used for the picker icons).
 */
export function markerPaths(shape: MarkerShape, style: MarkerStyle, color: string): MarkerPath[] {
  const path = getShape(shape).path;
  if (!path) return [];
  if (style === 'clean') return [{ d: path, fill: color }];

  const key = `${shape}|${style}|${color}`;
  const cached = cache.get(key);
  if (cached) return cached;

  // A slightly darker outline reads as ink on top of the colour.
  const ink = isHex(color) ? mixColors(color, '#000000', 0.18) : color;
  const drawable =
    style === 'drawn'
      ? // Overlapping thick strokes look like colouring in with a felt-tip pen.
        generator.path(path, {
          seed: SEED,
          roughness: 2.2,
          bowing: 1.8,
          fill: color,
          fillStyle: 'hachure',
          hachureAngle: -35,
          hachureGap: 5,
          fillWeight: 6,
          stroke: ink,
          strokeWidth: 5,
        })
      : generator.path(path, {
          seed: SEED,
          roughness: 1.4,
          bowing: 1,
          fill: color,
          fillStyle: 'hachure',
          hachureAngle: -41,
          hachureGap: 6,
          fillWeight: 2.6,
          stroke: color,
          strokeWidth: 3.4,
        });

  const paths = generator.toPaths(drawable).map((info) => ({
    d: info.d,
    fill: info.fill && info.fill !== 'none' ? info.fill : undefined,
    stroke: info.stroke && info.stroke !== 'none' ? info.stroke : undefined,
    strokeWidth: info.stroke && info.stroke !== 'none' ? info.strokeWidth : undefined,
  }));
  if (cache.size > 200) cache.clear();
  cache.set(key, paths);
  return paths;
}

/** Plain SVG markup for the paths, for places that build SVG strings (editor marker). */
export function markerPathsMarkup(paths: MarkerPath[], fillRule = 'nonzero'): string {
  return paths
    .map(
      (p) =>
        `<path d="${p.d}" fill="${p.fill ?? 'none'}" fill-rule="${fillRule}"` +
        (p.stroke
          ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`
          : '') +
        '/>',
    )
    .join('');
}
