/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { parse } from 'opentype.js';
import { describe, expect, it } from 'vitest';
import { faceKey, outlineText, primaryFamily } from './outlineText';

function font(file: string) {
  const buffer = readFileSync(`node_modules/@fontsource/jost/files/${file}`);
  return parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}
const latin = font('jost-latin-400-normal.woff');
const latinExt = font('jost-latin-ext-400-normal.woff');

function xRange(d: string): [number, number] {
  const xs = Array.from(d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g), (m) => Number(m[1]));
  return [Math.min(...xs), Math.max(...xs)];
}

describe('outlineText', () => {
  const base = { x: 500, y: 100, fontSize: 30, letterSpacing: 0 };

  it('outlines text as path data around the baseline', () => {
    const d = outlineText([latin], 'Anita & Matthias', { ...base, anchor: 'start' });
    expect(d).toMatch(/^M/);
    const [min, max] = xRange(d);
    expect(min).toBeGreaterThanOrEqual(499);
    expect(max - min).toBeGreaterThan(150);
  });

  it('honours the text anchor like SVG', () => {
    const start = xRange(outlineText([latin], 'Berlin', { ...base, anchor: 'start' }));
    const middle = xRange(outlineText([latin], 'Berlin', { ...base, anchor: 'middle' }));
    const end = xRange(outlineText([latin], 'Berlin', { ...base, anchor: 'end' }));
    expect((middle[0] + middle[1]) / 2).toBeCloseTo(500, -1);
    expect(end[1]).toBeLessThanOrEqual(501);
    expect(start[0]).toBeGreaterThanOrEqual(499);
  });

  it('adds letter spacing', () => {
    const tight = xRange(outlineText([latin], 'Berlin', { ...base, anchor: 'start' }));
    const wide = xRange(
      outlineText([latin], 'Berlin', { ...base, letterSpacing: 5, anchor: 'start' }),
    );
    expect(wide[1] - wide[0]).toBeCloseTo(tight[1] - tight[0] + 25, 0);
  });

  it('falls back to the latin-ext font for other characters', () => {
    const withoutExt = outlineText([latin], 'Łódź', { ...base, anchor: 'start' });
    const withExt = outlineText([latin, latinExt], 'Łódź', { ...base, anchor: 'start' });
    expect(withExt.length).toBeGreaterThan(withoutExt.length);
  });
});

describe('font helpers', () => {
  it('reads the primary family and builds face keys', () => {
    expect(primaryFamily("'Great Vibes', cursive")).toBe('Great Vibes');
    expect(primaryFamily('Jost')).toBe('Jost');
    expect(faceKey('Jost', '300', 'normal')).toBe('Jost|300|normal');
  });
});
