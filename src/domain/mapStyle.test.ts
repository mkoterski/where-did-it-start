import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './defaults';
import { buildMapStyle, mapStyleOptions } from './mapStyle';
import type { WaterStyle } from './types';

describe('buildMapStyle', () => {
  it.each<[WaterStyle, boolean, boolean]>([
    ['color', false, false],
    ['ink', false, false],
    ['tint', true, true],
    ['outline', true, false],
  ])(
    'produces a valid MapLibre style (water: %s, labels: %s, buildings: %s)',
    (water, labels, buildings) => {
      const style = buildMapStyle({
        ...mapStyleOptions(DEFAULT_CONFIG, labels),
        water,
        buildings,
      });
      expect(validateStyleMin(style)).toEqual([]);
    },
  );

  it('adds the subway lines only when asked to, in their colour faded towards the paper', () => {
    const without = buildMapStyle(mapStyleOptions(DEFAULT_CONFIG, false));
    expect(without.sources.subway).toBeUndefined();
    expect(without.layers.some((layer) => layer.id === 'subway')).toBe(false);

    const style = buildMapStyle(
      mapStyleOptions({ ...DEFAULT_CONFIG, showSubway: true, subwayFade: 0 }, false),
    );
    expect(validateStyleMin(style)).toEqual([]);
    expect(style.sources.subway).toMatchObject({ type: 'geojson' });
    const subway = style.layers.find((layer) => layer.id === 'subway');
    expect(subway?.paint).toMatchObject({ 'line-color': DEFAULT_CONFIG.subwayColor });

    const faded = buildMapStyle(
      mapStyleOptions({ ...DEFAULT_CONFIG, showSubway: true, subwayFade: 0.9 }, false),
    );
    const fadedColor = faded.layers.find((layer) => layer.id === 'subway')?.paint;
    expect(fadedColor).not.toMatchObject({ 'line-color': DEFAULT_CONFIG.subwayColor });
  });

  it('uses the poster background as map background', () => {
    const style = buildMapStyle(
      mapStyleOptions({ ...DEFAULT_CONFIG, posterBackground: '#123456' }, false),
    );
    const background = style.layers.find((layer) => layer.id === 'background');
    expect(background?.paint).toEqual({ 'background-color': '#123456' });
  });

  it('draws rivers and lakes in light blue by default', () => {
    expect(DEFAULT_CONFIG.waterStyle).toBe('color');
    const style = buildMapStyle(mapStyleOptions(DEFAULT_CONFIG, false));
    const water = style.layers.find((layer) => layer.id === 'water');
    const waterway = style.layers.find((layer) => layer.id === 'waterway');
    expect(water?.paint).toMatchObject({ 'fill-color': '#a6cde6' });
    expect(waterway?.paint).toMatchObject({ 'line-color': '#a6cde6' });
  });

  it('uses the chosen water colour, and ink for the ink style', () => {
    const custom = buildMapStyle(
      mapStyleOptions({ ...DEFAULT_CONFIG, waterColor: '#123456' }, false),
    );
    expect(custom.layers.find((layer) => layer.id === 'waterway')?.paint).toMatchObject({
      'line-color': '#123456',
    });
    const ink = buildMapStyle(mapStyleOptions({ ...DEFAULT_CONFIG, waterStyle: 'ink' }, false));
    expect(ink.layers.find((layer) => layer.id === 'water')?.paint).toMatchObject({
      'fill-color': DEFAULT_CONFIG.mapInk,
    });
  });

  it('only adds label layers when asked to', () => {
    const ids = (labels: boolean) =>
      buildMapStyle(mapStyleOptions(DEFAULT_CONFIG, labels)).layers.map((layer) => layer.id);
    expect(ids(false).some((id) => id.startsWith('label-'))).toBe(false);
    expect(ids(true)).toContain('label-place');
  });
});
