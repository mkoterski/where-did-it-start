import rough from 'roughjs';
import { brushFill, brushStroke, pathRings, seededRandom, smoothCurve, type Point } from './brush';
import { mixColors } from './colors';
import { getShape } from './shapes';
import type { MarkerShape, MarkerStyle } from './types';

/** One SVG path of a marker, in the shape's 100 × 100 box. */
export interface MarkerPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Overrides the shape's own fill rule (brush strokes cross themselves). */
  fillRule?: 'nonzero' | 'evenodd';
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
 * The heart as one continuous brush stroke, the way it is drawn by hand: from a tail at the
 * lower left up through the tip, around the right lobe, into the notch, around the left lobe
 * and back down, crossing the tail at the tip.
 */
const HEART_STROKE: Point[] = [
  [10, 99],
  [30, 93],
  [49, 86],
  [68, 68],
  [86, 47],
  [95, 28],
  [90, 11],
  [75, 5],
  [60, 11],
  [51, 25],
  [45, 12],
  [30, 5],
  [13, 10],
  [5, 28],
  [11, 50],
  [28, 70],
  [47, 86],
  [62, 97],
];

/** Scales points towards the shape's centre, so brush sweeps stay inside the outline. */
function inset(rings: Point[][], factor: number, cx = 50, cy = 50): Point[][] {
  return rings.map((ring) =>
    ring.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor] as Point),
  );
}

/** A closed outline drawn as one stroke that starts at the lower left and overlaps itself. */
function closedStrokeLine(ring: Point[]): Point[] {
  const step = Math.max(1, Math.round(ring.length / 90));
  const points = ring.filter((_, index) => index % step === 0);
  let start = 0;
  points.forEach(([x, y], index) => {
    if (y - x > points[start][1] - points[start][0]) start = index;
  });
  const ordered = [...points.slice(start), ...points.slice(0, start)];
  return [...ordered, ...ordered.slice(0, Math.ceil(ordered.length * 0.12))];
}

function brushPaths(shape: MarkerShape, filled: boolean, color: string): MarkerPath[] {
  const definition = getShape(shape);
  const random = seededRandom(SEED * 31 + shape.length);
  const rings = pathRings(definition.path);
  const box = definition.bbox;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const paths: string[] = [];

  if (filled) {
    paths.push(
      ...brushFill(inset(rings, 0.88, cx, shape === 'heart' ? 47 : cy), {
        angle: -62,
        gap: 5.5,
        width: 8.5,
        random,
      }),
    );
  }

  const outlineWidth = filled ? 7 : 9;
  if (shape === 'heart') {
    paths.push(
      brushStroke(smoothCurve(HEART_STROKE, 14), {
        width: outlineWidth,
        taperStart: 0.06,
        taperEnd: 0.18,
        pressure: 0.35,
        contrast: 0.45,
        random,
      }),
    );
  } else {
    rings.forEach((ring, index) => {
      paths.push(
        brushStroke(closedStrokeLine(ring), {
          width: index === 0 ? outlineWidth : outlineWidth * 0.7,
          taperStart: 0.05,
          taperEnd: 0.12,
          pressure: 0.35,
          contrast: 0.45,
          random,
        }),
      );
    });
  }

  return paths.map((d) => ({ d, fill: color, fillRule: 'nonzero' }));
}

/**
 * The paths that draw a marker symbol. "brush-fill" and "brush" look painted with a brush pen
 * (dry-brush filled, or a single outline stroke); "clean" is the plain vector shape; "drawn"
 * looks coloured in with a felt-tip pen; "sketch" like a pencil drawing with hatching.
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

  if (style === 'brush' || style === 'brush-fill') {
    const brushed = brushPaths(shape, style === 'brush-fill', color);
    cache.set(key, brushed);
    return brushed;
  }

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
        `<path d="${p.d}" fill="${p.fill ?? 'none'}" fill-rule="${p.fillRule ?? fillRule}"` +
        (p.stroke
          ? ` stroke="${p.stroke}" stroke-width="${p.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`
          : '') +
        '/>',
    )
    .join('');
}
