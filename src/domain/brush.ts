import { pointsOnPath } from 'points-on-path';

/**
 * A tiny "brush pen" engine for marker symbols. Strokes are turned into filled outlines whose
 * width swells and tapers like a real brush, so they render identically in the preview, the
 * editor and every export (no SVG stroke features or filters needed).
 */

export type Point = [number, number];

/** Deterministic pseudo-random numbers (mulberry32), so every render looks the same. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth curve through the given points (centripetal-ish Catmull-Rom). */
export function smoothCurve(points: Point[], samplesPerSegment = 12): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      result.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

const fmt = (value: number) => Math.round(value * 100) / 100;

export interface BrushOptions {
  /** Widest point of the stroke, in the units of the points. */
  width: number;
  /** Share of the length over which the stroke swells at the start / thins at the end. */
  taperStart?: number;
  taperEnd?: number;
  /** How much the brush pressure wavers along the stroke (0 – 1). */
  pressure?: number;
  /** Calligraphic contrast: downstrokes get thicker, upstrokes thinner (0 – 1). */
  contrast?: number;
  random?: () => number;
}

/** Turns a centre line into the filled outline of a brush stroke (SVG path data). */
export function brushStroke(center: Point[], options: BrushOptions): string {
  const { width, taperStart = 0.12, taperEnd = 0.25, pressure = 0.25, contrast = 0 } = options;
  const random = options.random ?? Math.random;
  if (center.length < 2) return '';

  const lengths = [0];
  for (let i = 1; i < center.length; i++) {
    const [x0, y0] = center[i - 1];
    const [x1, y1] = center[i];
    lengths.push(lengths[i - 1] + Math.hypot(x1 - x0, y1 - y0));
  }
  const total = lengths[lengths.length - 1] || 1;
  const phase = random() * Math.PI * 2;
  const wobble = 2 + random() * 3;

  const left: Point[] = [];
  const right: Point[] = [];
  center.forEach(([x, y], i) => {
    const t = lengths[i] / total;
    const start = Math.min(1, t / taperStart) ** 0.6;
    const end = Math.min(1, (1 - t) / taperEnd) ** 0.8;
    const press = 1 + pressure * 0.5 * Math.sin(phase + t * Math.PI * wobble);

    const [px, py] = center[Math.max(0, i - 1)];
    const [nx, ny] = center[Math.min(center.length - 1, i + 1)];
    const dx = nx - px;
    const dy = ny - py;
    const length = Math.hypot(dx, dy) || 1;
    // A brush pen presses harder when pulled downwards.
    const stroke = 1 + contrast * (dy / length);
    const half = (width / 2) * Math.max(0.08, start * end * press * stroke);
    const ox = (-dy / length) * half;
    const oy = (dx / length) * half;
    left.push([x + ox, y + oy]);
    right.push([x - ox, y - oy]);
  });

  const outline = [...left, ...right.reverse()];
  return `M${outline.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join(' L')} Z`;
}

/** Points along an SVG path (all sub-paths), for filling shapes with brush sweeps. */
export function pathRings(d: string): Point[][] {
  return pointsOnPath(d, 0.3, 0.5) as Point[][];
}

/**
 * Where a line crosses the shape: the inside intervals of the infinite line through `origin`
 * with direction `dir`, using the even-odd rule (so holes, like the pin's, stay empty).
 */
function insideIntervals(rings: Point[][], origin: Point, dir: Point): Array<[number, number]> {
  const hits: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const ex = b[0] - a[0];
      const ey = b[1] - a[1];
      const denom = dir[0] * ey - dir[1] * ex;
      if (Math.abs(denom) < 1e-9) continue;
      const wx = a[0] - origin[0];
      const wy = a[1] - origin[1];
      const t = (wx * ey - wy * ex) / denom;
      const u = (wx * dir[1] - wy * dir[0]) / denom;
      if (u >= 0 && u < 1) hits.push(t);
    }
  }
  hits.sort((x, y) => x - y);
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i + 1 < hits.length; i += 2) intervals.push([hits[i], hits[i + 1]]);
  return intervals;
}

export interface FillOptions {
  /** Direction of the brush sweeps in degrees (0 = left to right, -60 = steep upwards). */
  angle: number;
  /** Distance between sweeps; strokes are a bit narrower or wider, leaving dry-brush gaps. */
  gap: number;
  width: number;
  random: () => number;
}

/** Fills a shape with parallel brush sweeps that stop at its edge. */
export function brushFill(rings: Point[][], options: FillOptions): string[] {
  const { angle, gap, width, random } = options;
  const rad = (angle * Math.PI) / 180;
  const dir: Point = [Math.cos(rad), Math.sin(rad)];
  const normal: Point = [-dir[1], dir[0]];
  const all = rings.flat();
  const offsets = all.map(([x, y]) => x * normal[0] + y * normal[1]);
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);

  const strokes: string[] = [];
  for (let offset = min + gap * 0.5; offset < max; offset += gap * (0.85 + random() * 0.3)) {
    const origin: Point = [normal[0] * offset, normal[1] * offset];
    for (const [from, to] of insideIntervals(rings, origin, dir)) {
      if (to - from < width * 0.6) continue;
      // Real sweeps stop a little short or run slightly over the edge.
      const start = from + (random() * 0.9 - 0.25) * width * 0.5;
      const end = to - (random() * 0.9 - 0.25) * width * 0.5;
      const bend = (random() - 0.5) * width * 0.5;
      const mid = (start + end) / 2;
      const line: Point[] = smoothCurve(
        [start, mid, end].map((s, k) => {
          const sway = k === 1 ? bend : 0;
          return [
            origin[0] + dir[0] * s + normal[0] * sway,
            origin[1] + dir[1] * s + normal[1] * sway,
          ] as Point;
        }),
        10,
      );
      strokes.push(
        brushStroke(line, {
          width: width * (0.75 + random() * 0.5),
          taperStart: 0.08,
          taperEnd: 0.3,
          pressure: 0.35,
          random,
        }),
      );
    }
  }
  return strokes;
}
