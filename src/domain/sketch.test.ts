import { describe, expect, it } from 'vitest';
import { sanitizeConfig } from './config';
import { DEFAULT_CONFIG } from './defaults';
import { MARKER_SHAPES } from './shapes';
import { markerPaths, markerPathsMarkup } from './sketch';

const SYMBOLS = MARKER_SHAPES.filter((shape) => shape !== 'none');

describe('markerPaths', () => {
  it('defaults to the hand-drawn look', () => {
    expect(DEFAULT_CONFIG.markerStyle).toBe('drawn');
    expect(sanitizeConfig({ markerStyle: 'crayon' }).markerStyle).toBe('drawn');
    expect(sanitizeConfig({ markerStyle: 'clean' }).markerStyle).toBe('clean');
  });

  it('returns the plain shape for the clean style', () => {
    const [path, ...rest] = markerPaths('heart', 'clean', '#d7263d');
    expect(rest).toHaveLength(0);
    expect(path).toEqual({ d: expect.stringMatching(/^M50 95/), fill: '#d7263d' });
  });

  it.each(SYMBOLS)('colours in a %s by hand with a darker outline', (shape) => {
    const paths = markerPaths(shape, 'drawn', '#d7263d');
    // Felt-tip colouring: thick strokes in the marker colour…
    expect(paths.some((p) => p.stroke === '#d7263d' && p.strokeWidth! >= 5)).toBe(true);
    // …and an ink outline that is darker than the colour.
    expect(paths.some((p) => p.stroke && p.stroke !== '#d7263d')).toBe(true);
  });

  it.each(SYMBOLS)('sketches a %s with pencil hatching', (shape) => {
    const paths = markerPaths(shape, 'sketch', '#d7263d');
    expect(paths.every((p) => !p.fill)).toBe(true);
    expect(paths.length).toBeGreaterThan(0);
  });

  it('is deterministic, so preview and export look identical', () => {
    const first = JSON.stringify(markerPaths('star', 'drawn', '#123456'));
    // Different colour first to make sure caching does not leak between keys.
    markerPaths('star', 'drawn', '#654321');
    expect(JSON.stringify(markerPaths('star', 'drawn', '#123456'))).toBe(first);
  });

  it('works with currentColor for the picker icons', () => {
    const paths = markerPaths('heart', 'drawn', 'currentColor');
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.stroke === 'currentColor')).toBe(true);
  });

  it('has no paths for "none"', () => {
    expect(markerPaths('none', 'drawn', '#000000')).toEqual([]);
  });

  it('serialises paths to SVG markup', () => {
    const markup = markerPathsMarkup(
      [{ d: 'M0 0 L1 1', stroke: '#000', strokeWidth: 2 }],
      'evenodd',
    );
    expect(markup).toBe(
      '<path d="M0 0 L1 1" fill="none" fill-rule="evenodd" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    );
  });
});
