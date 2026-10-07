import type { CoordinateFormat } from './types';

export type Axis = 'latitude' | 'longitude';

const LIMITS: Record<Axis, number> = { latitude: 90, longitude: 180 };

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

function hemisphere(value: number, axis: Axis): string {
  if (axis === 'latitude') return value < 0 ? 'S' : 'N';
  return value < 0 ? 'W' : 'E';
}

/** "48.15838°N" – rounds first so that tiny negative values never print as "0.00000°S". */
export function formatDecimal(value: number, axis: Axis, precision = 5): string {
  const rounded = Number(Math.abs(value).toFixed(precision));
  const sign = rounded === 0 ? 1 : Math.sign(value);
  return `${rounded.toFixed(precision)}°${hemisphere(sign, axis)}`;
}

/** "48°09'30.2\"N" – degrees, minutes and seconds with one decimal on the seconds. */
export function formatDms(value: number, axis: Axis): string {
  // Work in tenths of an arc second so that rounding can carry into minutes and degrees.
  const tenths = Math.round(Math.abs(value) * 36000);
  const degrees = Math.floor(tenths / 36000);
  const minutes = Math.floor((tenths % 36000) / 600);
  const seconds = (tenths % 600) / 10;
  const sign = tenths === 0 ? 1 : Math.sign(value);
  return `${degrees}°${String(minutes).padStart(2, '0')}'${seconds
    .toFixed(1)
    .padStart(4, '0')}"${hemisphere(sign, axis)}`;
}

export function formatCoordinates(
  latitude: number,
  longitude: number,
  format: CoordinateFormat = 'decimal',
  precision = 5,
): string {
  if (format === 'dms') {
    return `${formatDms(latitude, 'latitude')} ${formatDms(longitude, 'longitude')}`;
  }
  return `${formatDecimal(latitude, 'latitude', precision)} ${formatDecimal(
    longitude,
    'longitude',
    precision,
  )}`;
}

/** Builds the small line at the bottom of the poster, e.g. "Paris 48.85889°N 2.32004°E". */
export function formatLocationLine(
  label: string,
  coordinates: { latitude: number; longitude: number } | null,
  options: { showCoordinates: boolean; format: CoordinateFormat; precision: number },
): string {
  const parts = [label.trim()];
  if (options.showCoordinates && coordinates) {
    parts.push(
      formatCoordinates(
        coordinates.latitude,
        coordinates.longitude,
        options.format,
        options.precision,
      ),
    );
  }
  return parts.filter(Boolean).join(' ');
}

/**
 * Parses a single coordinate typed by a person. Accepts "48.1583", "48,1583" and
 * hemisphere suffixes/prefixes such as "48.15 N" or "W 0.12". Returns null when the
 * text is not a number or is outside the valid range for the axis.
 */
export function parseCoordinate(input: string, axis: Axis): number | null {
  let text = input.trim().toUpperCase().replace('°', '');
  if (!text) return null;

  let sign = 1;
  const hemi = text.match(/^([NSEW])\s*|\s*([NSEW])$/);
  if (hemi) {
    const letter = hemi[1] ?? hemi[2];
    const allowed = axis === 'latitude' ? 'NS' : 'EW';
    if (!allowed.includes(letter)) return null;
    if (letter === 'S' || letter === 'W') sign = -1;
    text = text.replace(hemi[0], '').trim();
  }

  // A single comma is treated as a decimal separator ("48,15").
  if (/^-?\d+,\d+$/.test(text)) text = text.replace(',', '.');
  if (!/^[-+]?\d+(\.\d+)?$/.test(text)) return null;

  const value = Number(text) * sign;
  if (!Number.isFinite(value) || Math.abs(value) > LIMITS[axis]) return null;
  return value;
}

/** Parses "48.171874, 11.563764" or "48.171874 11.563764" into a coordinate pair. */
export function parseCoordinatePair(input: string): { latitude: number; longitude: number } | null {
  const parts = input
    .trim()
    .split(/\s*[,;]\s*|\s+/)
    .filter(Boolean);
  if (parts.length !== 2) return null;
  const latitude = parseCoordinate(parts[0], 'latitude');
  const longitude = parseCoordinate(parts[1], 'longitude');
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

/** Approximate ground distance covered by `units` design pixels at the given zoom. */
export function groundDistanceKm(units: number, zoom: number, latitude: number): number {
  const EARTH_CIRCUMFERENCE_M = 40075016.686;
  // MapLibre uses 512px tiles: one CSS pixel at zoom z covers C·cos(lat) / (512·2^z) metres.
  const metresPerUnit =
    (EARTH_CIRCUMFERENCE_M * Math.cos((latitude * Math.PI) / 180)) / (512 * 2 ** zoom);
  return (units * metresPerUnit) / 1000;
}
