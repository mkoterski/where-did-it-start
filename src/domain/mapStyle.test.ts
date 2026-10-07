import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './defaults';
import { buildMapStyle, mapStyleOptions } from './mapStyle';
import type { WaterStyle } from './types';

describe('buildMapStyle', () => {
  it.each<[WaterStyle, boolean, boolean]>([
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

  it('uses the poster background as map background', () => {
    const style = buildMapStyle(
      mapStyleOptions({ ...DEFAULT_CONFIG, posterBackground: '#123456' }, false),
    );
    const background = style.layers.find((layer) => layer.id === 'background');
    expect(background?.paint).toEqual({ 'background-color': '#123456' });
  });

  it('only adds label layers when asked to', () => {
    const ids = (labels: boolean) =>
      buildMapStyle(mapStyleOptions(DEFAULT_CONFIG, labels)).layers.map((layer) => layer.id);
    expect(ids(false).some((id) => id.startsWith('label-'))).toBe(false);
    expect(ids(true)).toContain('label-place');
  });
});
