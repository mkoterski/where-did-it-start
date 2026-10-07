import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './defaults';
import { computeLayout, editorKeyholePixels, posterDimensions } from './layout';
import { FRAME_SHAPES, getShape, MARKER_SHAPES, markerAnchor } from './shapes';
import type { PosterConfig } from './types';

const config = (patch: Partial<PosterConfig> = {}): PosterConfig => ({
  ...DEFAULT_CONFIG,
  ...patch,
});

describe('posterDimensions', () => {
  it('uses 1000 units for the shorter side', () => {
    expect(posterDimensions(config())).toEqual({ width: 1000, height: 1414.3 });
    expect(posterDimensions(config({ orientation: 'landscape' }))).toEqual({
      width: 1414.3,
      height: 1000,
    });
    expect(posterDimensions(config({ paperSize: 'square' }))).toEqual({
      width: 1000,
      height: 1000,
    });
  });
});

describe('computeLayout', () => {
  it.each(FRAME_SHAPES)(
    'centres the map on the %s anchor and covers the map area',
    (frameShape) => {
      const layout = computeLayout(config({ frameShape }));
      const { mapView, mapArea, anchor, frame } = layout;
      const shape = getShape(frameShape);

      // The anchor (selected location) is where the shape's anchor point is drawn…
      expect(anchor.x).toBeCloseTo(frame.x + shape.anchor.x * frame.scale);
      expect(anchor.y).toBeCloseTo(frame.y + shape.anchor.y * frame.scale);
      // …and exactly in the middle of the rendered map.
      expect(mapView.x + mapView.width / 2).toBeCloseTo(anchor.x);
      expect(mapView.y + mapView.height / 2).toBeCloseTo(anchor.y);
      // The rendered map covers the whole visible map window.
      expect(mapView.x).toBeLessThanOrEqual(mapArea.x);
      expect(mapView.y).toBeLessThanOrEqual(mapArea.y);
      expect(mapView.x + mapView.width).toBeGreaterThanOrEqual(mapArea.x + mapArea.width);
      expect(mapView.y + mapView.height).toBeGreaterThanOrEqual(mapArea.y + mapArea.height);
      // The keyhole stays inside the map window.
      expect(frame.x + shape.bbox.x * frame.scale).toBeGreaterThanOrEqual(mapArea.x - 0.01);
      expect(frame.y + (shape.bbox.y + shape.bbox.height) * frame.scale).toBeLessThanOrEqual(
        mapArea.y + mapArea.height + 0.01,
      );
    },
  );

  it.each(MARKER_SHAPES.filter((shape) => shape !== 'none'))(
    'places the %s marker on the selected location',
    (markerShape) => {
      const layout = computeLayout(config({ markerShape, markerSize: 60 }));
      const point = markerAnchor(markerShape);
      expect(layout.marker).not.toBeNull();
      expect(layout.marker!.x + point.x * layout.marker!.scale).toBeCloseTo(layout.anchor.x);
      expect(layout.marker!.y + point.y * layout.marker!.scale).toBeCloseTo(layout.anchor.y);
    },
  );

  it('omits the marker when none is chosen', () => {
    expect(computeLayout(config({ markerShape: 'none' })).marker).toBeNull();
  });

  it('puts the text below the map in portrait and beside it in landscape', () => {
    const portrait = computeLayout(config());
    expect(portrait.text.titleY).toBeGreaterThan(portrait.mapArea.y + portrait.mapArea.height);
    expect(portrait.text.anchor).toBe('middle');

    const landscape = computeLayout(config({ orientation: 'landscape', textAlignment: 'left' }));
    expect(landscape.text.x).toBeGreaterThan(landscape.mapArea.x + landscape.mapArea.width);
    expect(landscape.text.anchor).toBe('start');
  });

  it('scales the keyhole with the shape size', () => {
    const small = computeLayout(config({ frameSize: 0.5 }));
    const large = computeLayout(config({ frameSize: 1 }));
    expect(large.frameExtent).toBeCloseTo(small.frameExtent * 2);
  });
});

describe('editorKeyholePixels', () => {
  it('sizes the keyhole relative to the smaller side, within limits', () => {
    expect(editorKeyholePixels(400, 340)).toBeCloseTo(231.2);
    expect(editorKeyholePixels(100, 80)).toBe(120);
    expect(editorKeyholePixels(2000, 2000)).toBe(560);
  });
});
