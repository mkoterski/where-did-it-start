import { describe, expect, it } from 'vitest';
import {
  decodeShareState,
  deriveLocationLabel,
  diffFromDefaults,
  encodeShareState,
  readShareHash,
  sanitizeConfig,
} from './config';
import { DEFAULT_CONFIG, TEXT_LIMITS } from './defaults';

const BERLIN = {
  latitude: 52.509652,
  longitude: 13.37603,
  displayName: 'Potsdamer Platz, Berlin, Deutschland',
  name: 'Potsdamer Platz',
  city: 'Berlin',
  country: 'Deutschland',
};

describe('default poster configuration', () => {
  it('matches the reference design', () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      location: null,
      title: 'Where it all began...',
      names: 'Anita & Matthias',
      frameShape: 'heart',
      markerShape: 'heart',
      markerColor: '#d7263d',
      showCoordinates: true,
      textAlignment: 'center',
    });
  });

  it('is already sanitized', () => {
    expect(sanitizeConfig(DEFAULT_CONFIG)).toEqual(DEFAULT_CONFIG);
  });
});

describe('sanitizeConfig', () => {
  it('returns the defaults for garbage', () => {
    expect(sanitizeConfig(null)).toEqual(DEFAULT_CONFIG);
    expect(sanitizeConfig('nope')).toEqual(DEFAULT_CONFIG);
  });

  it('drops invalid values and keeps valid ones', () => {
    const config = sanitizeConfig({
      frameShape: 'banana',
      markerShape: 'pin',
      markerColor: 'red',
      posterBackground: '#ABCDEF',
      zoom: 99,
      frameSize: -1,
      title: 'x'.repeat(200),
      unknownKey: true,
    });
    expect(config.frameShape).toBe('heart');
    expect(config.markerShape).toBe('pin');
    expect(config.markerColor).toBe(DEFAULT_CONFIG.markerColor);
    expect(config.posterBackground).toBe('#abcdef');
    expect(config.zoom).toBe(18);
    expect(config.frameSize).toBe(0.4);
    expect(config.title).toHaveLength(TEXT_LIMITS.title);
    expect(config).not.toHaveProperty('unknownKey');
  });

  it('keeps a known text font and falls back for unknown ones', () => {
    expect(sanitizeConfig({ bodyFont: 'courier' }).bodyFont).toBe('courier');
    expect(sanitizeConfig({ bodyFont: 'comic-sans' }).bodyFont).toBe('jost');
  });

  it('rejects invalid locations', () => {
    expect(sanitizeConfig({ location: { latitude: 120, longitude: 0 } }).location).toBeNull();
    expect(sanitizeConfig({ location: { latitude: 'x', longitude: 0 } }).location).toBeNull();
    expect(sanitizeConfig({ location: BERLIN }).location).toEqual(BERLIN);
  });
});

describe('deriveLocationLabel', () => {
  it('prefers the city, then the name, then the first part of the display name', () => {
    expect(deriveLocationLabel(BERLIN)).toBe('Berlin');
    expect(deriveLocationLabel({ ...BERLIN, city: undefined })).toBe('Potsdamer Platz');
    expect(
      deriveLocationLabel({ latitude: 0, longitude: 0, displayName: 'Null Island, Atlantic' }),
    ).toBe('Null Island');
    expect(deriveLocationLabel(null)).toBe('');
  });
});

describe('share links', () => {
  it('only encodes values that differ from the defaults', () => {
    expect(diffFromDefaults(DEFAULT_CONFIG)).toEqual({});
    expect(diffFromDefaults({ ...DEFAULT_CONFIG, names: 'A & B' })).toEqual({ names: 'A & B' });
  });

  it('round-trips a design, including non-ASCII text', () => {
    const config = sanitizeConfig({
      ...DEFAULT_CONFIG,
      location: BERLIN,
      names: 'Zoë & Jürgen ♥',
      locationLabel: 'München',
      frameShape: 'circle',
    });
    const encoded = encodeShareState(config);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShareState(encoded)).toEqual(config);
    expect(readShareHash(`#poster=${encoded}`)).toEqual(config);
  });

  it('ignores broken links', () => {
    expect(decodeShareState('%%%')).toBeNull();
    expect(readShareHash('#something=else')).toBeNull();
  });
});
