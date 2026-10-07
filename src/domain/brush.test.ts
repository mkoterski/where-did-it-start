import { describe, expect, it } from 'vitest';
import { brushFill, brushStroke, seededRandom, smoothCurve, type Point } from './brush';

function coordinates(d: string): Point[] {
  return Array.from(d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g), (m) => [Number(m[1]), Number(m[2])]);
}

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('brushStroke', () => {
  it('outlines a straight stroke that swells and tapers', () => {
    const line: Point[] = Array.from({ length: 21 }, (_, i) => [i * 5, 50]);
    const d = brushStroke(line, { width: 10, random: seededRandom(1) });
    expect(d).toMatch(/^M.* Z$/);
    const thickness = coordinates(d).map(([, y]) => Math.abs(y - 50));
    const middle = Math.max(...thickness);
    expect(middle).toBeGreaterThan(3.5);
    expect(middle).toBeLessThanOrEqual(6.5);
    // The tail end is much thinner than the middle.
    expect(thickness[20]).toBeLessThan(middle / 3);
  });

  it('makes downstrokes thicker than upstrokes when contrast is set', () => {
    const down: Point[] = Array.from({ length: 11 }, (_, i) => [50, i * 10]);
    const up = [...down].reverse();
    const width = (points: Point[]) =>
      Math.max(
        ...coordinates(
          brushStroke(points, { width: 10, contrast: 0.5, pressure: 0, random: seededRandom(3) }),
        ).map(([x]) => Math.abs(x - 50)),
      );
    expect(width(down)).toBeGreaterThan(width(up) * 1.5);
  });
});

describe('smoothCurve', () => {
  it('passes through the given points', () => {
    const curve = smoothCurve(
      [
        [0, 0],
        [10, 10],
        [20, 0],
      ],
      4,
    );
    expect(curve[0]).toEqual([0, 0]);
    expect(curve[4]).toEqual([10, 10]);
    expect(curve.at(-1)).toEqual([20, 0]);
  });
});

describe('brushFill', () => {
  const square: Point[] = [
    [0, 0],
    [100, 0],
    [100, 100],
    [0, 100],
  ];
  const hole: Point[] = [
    [40, 40],
    [60, 40],
    [60, 60],
    [40, 60],
  ];

  it('fills the shape with sweeps that stay near it', () => {
    const strokes = brushFill([square], { angle: -60, gap: 8, width: 9, random: seededRandom(5) });
    expect(strokes.length).toBeGreaterThan(10);
    for (const [x, y] of strokes.flatMap(coordinates)) {
      expect(x).toBeGreaterThan(-10);
      expect(x).toBeLessThan(110);
      expect(y).toBeGreaterThan(-10);
      expect(y).toBeLessThan(110);
    }
  });

  it('leaves holes empty (even-odd)', () => {
    const strokes = brushFill([square, hole], {
      angle: 0,
      gap: 4,
      width: 3,
      random: seededRandom(5),
    });
    // No stroke centre line crosses the middle of the hole.
    const centres = strokes.map((d) => {
      const points = coordinates(d);
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        y: ys.reduce((a, b) => a + b) / ys.length,
      };
    });
    const throughHole = centres.filter((c) => c.y > 45 && c.y < 55 && c.minX < 48 && c.maxX > 52);
    expect(throughHole).toHaveLength(0);
  });
});
