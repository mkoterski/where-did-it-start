import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/defaults';
import { computeLayout } from '../domain/layout';
import type { PosterConfig } from '../domain/types';
import { PosterOverlay } from './PosterOverlay';

const config: PosterConfig = {
  ...DEFAULT_CONFIG,
  markerShadow: true,
  location: { latitude: 52.5, longitude: 13.4, displayName: 'Berlin', city: 'Berlin' },
};

function markup(patch: Partial<PosterConfig>, maskFree: boolean) {
  const value = { ...config, ...patch };
  return renderToStaticMarkup(
    <PosterOverlay
      config={value}
      layout={computeLayout(value)}
      idPrefix="t"
      mode="export"
      maskFree={maskFree}
    />,
  );
}

describe('PosterOverlay', () => {
  it('uses a mask and a filter for the preview and image exports', () => {
    const svg = markup({ outside: 'hidden' }, false);
    expect(svg).toContain('mask="url(#t-outside)"');
    expect(svg).toContain('filter="url(#t-shadow)"');
  });

  it('avoids masks and filters for vector exports', () => {
    const svg = markup({ outside: 'faded' }, true);
    expect(svg).not.toContain('mask="url(');
    expect(svg).not.toContain('filter="url(');
    expect(svg).toMatch(
      /<path d="M70 70 H930 V[^"]+ Z M[^"]+" fill-rule="evenodd" fill="#fdfcf9" fill-opacity="0.8"/,
    );
    // The shadow becomes a soft offset copy.
    expect(svg).toContain('<g transform="translate(0 3)" opacity="0.22">');
  });

  it('uses the chosen fade strength', () => {
    expect(markup({ outside: 'faded', outsideFade: 0.45 }, true)).toContain(
      'fill="#fdfcf9" fill-opacity="0.45"',
    );
    expect(markup({ outside: 'faded', outsideFade: 0.45 }, false)).toContain(
      'fill-opacity="0.45" mask="url(#t-outside)"',
    );
  });

  it('draws nothing over the map when the outside is visible', () => {
    expect(markup({ outside: 'visible' }, true)).not.toContain(
      'fill-rule="evenodd" fill="#fdfcf9"',
    );
  });
});
