import { describe, expect, it } from 'vitest';
import {
  formatCoordinates,
  formatDecimal,
  formatDms,
  formatLocationLine,
  groundDistanceKm,
  isValidLatitude,
  isValidLongitude,
  parseCoordinate,
  parseCoordinatePair,
} from './coordinates';

describe('formatDecimal', () => {
  it('formats like the reference poster', () => {
    expect(formatDecimal(48.158381, 'latitude')).toBe('48.15838°N');
    expect(formatDecimal(11.501942, 'longitude')).toBe('11.50194°E');
  });

  it('uses S and W for negative values', () => {
    expect(formatDecimal(-33.856784, 'latitude')).toBe('33.85678°S');
    expect(formatDecimal(-73.985428, 'longitude')).toBe('73.98543°W');
  });

  it('respects the requested precision', () => {
    expect(formatDecimal(52.509652, 'latitude', 6)).toBe('52.509652°N');
    expect(formatDecimal(52.509652, 'latitude', 2)).toBe('52.51°N');
  });

  it('never prints a hemisphere for a value that rounds to zero', () => {
    expect(formatDecimal(-0.000001, 'latitude')).toBe('0.00000°N');
    expect(formatDecimal(-0.000001, 'longitude')).toBe('0.00000°E');
  });
});

describe('formatDms', () => {
  it('formats degrees, minutes and seconds', () => {
    expect(formatDms(48.158381, 'latitude')).toBe('48°09\'30.2"N');
    expect(formatDms(-0.1276, 'longitude')).toBe('0°07\'39.4"W');
  });

  it('carries rounded seconds into minutes and degrees', () => {
    expect(formatDms(10.999999, 'latitude')).toBe('11°00\'00.0"N');
  });
});

describe('formatCoordinates / formatLocationLine', () => {
  it('joins latitude and longitude', () => {
    expect(formatCoordinates(52.509652, 13.37603, 'decimal', 6)).toBe('52.509652°N 13.376030°E');
    expect(formatCoordinates(52.509652, 13.37603, 'dms')).toBe('52°30\'34.7"N 13°22\'33.7"E');
  });

  it('builds the poster line from the label and the selected point', () => {
    const options = { showCoordinates: true, format: 'decimal' as const, precision: 5 };
    expect(formatLocationLine('Paris', { latitude: 48.85889, longitude: 2.32004 }, options)).toBe(
      'Paris 48.85889°N 2.32004°E',
    );
    expect(
      formatLocationLine(
        'Paris',
        { latitude: 48.85889, longitude: 2.32004 },
        {
          ...options,
          showCoordinates: false,
        },
      ),
    ).toBe('Paris');
    expect(formatLocationLine('', { latitude: 1, longitude: 2 }, options)).toBe(
      '1.00000°N 2.00000°E',
    );
    expect(formatLocationLine('Somewhere', null, options)).toBe('Somewhere');
  });
});

describe('validation and parsing', () => {
  it('validates ranges', () => {
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(90.0001)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(-180)).toBe(true);
    expect(isValidLongitude(181)).toBe(false);
  });

  it.each([
    ['48.15838', 'latitude', 48.15838],
    ['  -33.8568 ', 'latitude', -33.8568],
    ['48,15838', 'latitude', 48.15838],
    ['48.1 N', 'latitude', 48.1],
    ['33.9S', 'latitude', -33.9],
    ['W 0.1276', 'longitude', -0.1276],
    ['13.376°', 'longitude', 13.376],
  ] as const)('parses %j as %s', (input, axis, expected) => {
    expect(parseCoordinate(input, axis)).toBeCloseTo(expected, 8);
  });

  it.each([
    ['', 'latitude'],
    ['abc', 'latitude'],
    ['91', 'latitude'],
    ['-180.5', 'longitude'],
    ['48.1 E', 'latitude'],
    ['1.2.3', 'longitude'],
  ] as const)('rejects %j as a %s', (input, axis) => {
    expect(parseCoordinate(input, axis)).toBeNull();
  });

  it('parses pasted coordinate pairs', () => {
    expect(parseCoordinatePair('48.171874, 11.563764')).toEqual({
      latitude: 48.171874,
      longitude: 11.563764,
    });
    expect(parseCoordinatePair('48.171874 11.563764')).toEqual({
      latitude: 48.171874,
      longitude: 11.563764,
    });
    expect(parseCoordinatePair('48.1')).toBeNull();
    expect(parseCoordinatePair('95, 11')).toBeNull();
  });
});

describe('groundDistanceKm', () => {
  it('halves the distance with every zoom level', () => {
    const at13 = groundDistanceKm(800, 13, 48);
    expect(groundDistanceKm(800, 14, 48)).toBeCloseTo(at13 / 2, 6);
    // ~6.4 m per CSS pixel at zoom 13 and 48° latitude.
    expect(at13).toBeGreaterThan(4.5);
    expect(at13).toBeLessThan(5.6);
  });
});
