import { isHexColor } from './colors';
import { isValidLatitude, isValidLongitude } from './coordinates';
import { DEFAULT_CONFIG, TEXT_LIMITS, ZOOM_RANGE } from './defaults';
import { PAPER_SIZES } from './paper';
import { FRAME_SHAPES, MARKER_SHAPES } from './shapes';
import { TITLE_FONTS } from './typography';
import type { LocationSelection, PosterConfig } from './types';

type Raw = Record<string, unknown>;

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function pickString(value: unknown, maxLength: number, fallback: string): string {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickColor(value: unknown, fallback: string): string {
  return isHexColor(value) ? value.toLowerCase() : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.slice(0, 200) : undefined;
}

export function sanitizeLocation(raw: unknown): LocationSelection | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Raw;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  return {
    latitude,
    longitude,
    displayName: pickString(value.displayName, 300, ''),
    name: optionalString(value.name),
    city: optionalString(value.city),
    country: optionalString(value.country),
  };
}

/**
 * Turns anything (stored JSON, a shared link, an old version of the config) into a valid
 * PosterConfig. Unknown keys are dropped and invalid values fall back to the defaults.
 */
export function sanitizeConfig(raw: unknown): PosterConfig {
  const d = DEFAULT_CONFIG;
  if (!raw || typeof raw !== 'object') return { ...d };
  const v = raw as Raw;
  return {
    location: sanitizeLocation(v.location),
    zoom: pickNumber(v.zoom, ZOOM_RANGE.min, ZOOM_RANGE.max, d.zoom),

    frameShape: pickEnum(v.frameShape, FRAME_SHAPES, d.frameShape),
    frameSize: pickNumber(v.frameSize, 0.4, 1, d.frameSize),
    outside: pickEnum(v.outside, ['hidden', 'faded', 'visible'] as const, d.outside),
    frameOutline: pickBoolean(v.frameOutline, d.frameOutline),
    frameOutlineWidth: pickNumber(v.frameOutlineWidth, 0.5, 12, d.frameOutlineWidth),

    markerShape: pickEnum(v.markerShape, MARKER_SHAPES, d.markerShape),
    markerStyle: pickEnum(v.markerStyle, ['clean', 'drawn', 'sketch'] as const, d.markerStyle),
    markerColor: pickColor(v.markerColor, d.markerColor),
    markerOpacity: pickNumber(v.markerOpacity, 0.1, 1, d.markerOpacity),
    markerSize: pickNumber(v.markerSize, 16, 160, d.markerSize),
    markerOutline: pickBoolean(v.markerOutline, d.markerOutline),
    markerOutlineWidth: pickNumber(v.markerOutlineWidth, 1, 12, d.markerOutlineWidth),
    markerOutlineColor: pickColor(v.markerOutlineColor, d.markerOutlineColor),
    markerShadow: pickBoolean(v.markerShadow, d.markerShadow),

    title: pickString(v.title, TEXT_LIMITS.title, d.title),
    names: pickString(v.names, TEXT_LIMITS.names, d.names),
    locationLabel: pickString(v.locationLabel, TEXT_LIMITS.locationLabel, d.locationLabel),
    locationLabelCustom: pickBoolean(v.locationLabelCustom, d.locationLabelCustom),
    showCoordinates: pickBoolean(v.showCoordinates, d.showCoordinates),
    coordinateFormat: pickEnum(v.coordinateFormat, ['decimal', 'dms'] as const, d.coordinateFormat),
    coordinatePrecision: Math.round(pickNumber(v.coordinatePrecision, 2, 6, d.coordinatePrecision)),
    showAttribution: pickBoolean(v.showAttribution, d.showAttribution),
    titleFont: pickEnum(
      v.titleFont,
      TITLE_FONTS.map((f) => f.id),
      d.titleFont,
    ),
    titleScale: pickNumber(v.titleScale, 0.5, 1.6, d.titleScale),
    textAlignment: pickEnum(v.textAlignment, ['left', 'center', 'right'] as const, d.textAlignment),

    posterBackground: pickColor(v.posterBackground, d.posterBackground),
    textColor: pickColor(v.textColor, d.textColor),
    mapInk: pickColor(v.mapInk, d.mapInk),
    waterStyle: pickEnum(v.waterStyle, ['ink', 'tint', 'outline'] as const, d.waterStyle),
    showBuildings: pickBoolean(v.showBuildings, d.showBuildings),
    lineWeight: pickNumber(v.lineWeight, 0.4, 2.5, d.lineWeight),
    mapContrast: pickNumber(v.mapContrast, 0, 1, d.mapContrast),

    paperSize: pickEnum(
      v.paperSize,
      PAPER_SIZES.map((p) => p.id),
      d.paperSize,
    ),
    orientation: pickEnum(v.orientation, ['portrait', 'landscape'] as const, d.orientation),
    previewFrame: pickEnum(
      v.previewFrame,
      ['none', 'black', 'white', 'oak'] as const,
      d.previewFrame,
    ),
  };
}

/** The label a location gets automatically: its city, else its own name. */
export function deriveLocationLabel(location: LocationSelection | null): string {
  if (!location) return '';
  const label = location.city ?? location.name ?? location.displayName.split(',')[0]?.trim() ?? '';
  return label.slice(0, TEXT_LIMITS.locationLabel);
}

/** Only the values that differ from the defaults – keeps share links short. */
export function diffFromDefaults(config: PosterConfig): Partial<PosterConfig> {
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(config) as Array<keyof PosterConfig>) {
    if (JSON.stringify(config[key]) !== JSON.stringify(DEFAULT_CONFIG[key])) {
      diff[key] = config[key];
    }
  }
  return diff as Partial<PosterConfig>;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export const SHARE_PARAM = 'poster';

export function encodeShareState(config: PosterConfig): string {
  return toBase64Url(JSON.stringify(diffFromDefaults(config)));
}

export function decodeShareState(value: string): PosterConfig | null {
  try {
    return sanitizeConfig(JSON.parse(fromBase64Url(value)));
  } catch {
    return null;
  }
}

/** Reads `#poster=…` from a URL hash. */
export function readShareHash(hash: string): PosterConfig | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const value = params.get(SHARE_PARAM);
  return value ? decodeShareState(value) : null;
}
