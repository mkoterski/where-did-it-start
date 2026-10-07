import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, THEME_PRESETS } from '../domain/defaults';
import type { LocationSelection, PosterConfig } from '../domain/types';
import { posterReducer } from './posterReducer';

const BERLIN: LocationSelection = {
  latitude: 52.509652,
  longitude: 13.37603,
  displayName: 'Potsdamer Platz, Berlin, Deutschland',
  name: 'Potsdamer Platz',
  city: 'Berlin',
};

const withBerlin = (patch: Partial<PosterConfig> = {}) =>
  posterReducer({ ...DEFAULT_CONFIG, ...patch }, { type: 'selectLocation', location: BERLIN });

describe('posterReducer', () => {
  it('selecting a search result sets the location and the automatic label', () => {
    const state = withBerlin();
    expect(state.location).toEqual(BERLIN);
    expect(state.locationLabel).toBe('Berlin');
    expect(state.locationLabelCustom).toBe(false);
  });

  it('selecting a new place replaces a custom label', () => {
    const state = withBerlin({ locationLabel: 'Our bench', locationLabelCustom: true });
    expect(state.locationLabel).toBe('Berlin');
  });

  it('moving the point keeps the old names until the lookup answers', () => {
    const moved = posterReducer(withBerlin(), {
      type: 'moveLocation',
      latitude: 52.52,
      longitude: 13.4,
    });
    expect(moved.location).toMatchObject({ latitude: 52.52, longitude: 13.4, city: 'Berlin' });

    const resolved = posterReducer(moved, {
      type: 'resolveLocation',
      location: {
        latitude: 52.52,
        longitude: 13.4,
        displayName: 'Alexanderplatz, Berlin',
        city: 'Berlin-Mitte',
      },
    });
    expect(resolved.location?.displayName).toBe('Alexanderplatz, Berlin');
    expect(resolved.locationLabel).toBe('Berlin-Mitte');
  });

  it('ignores lookups for a point that has moved on', () => {
    const moved = posterReducer(withBerlin(), {
      type: 'moveLocation',
      latitude: 52.52,
      longitude: 13.4,
    });
    const stale = posterReducer(moved, {
      type: 'resolveLocation',
      location: { latitude: 1, longitude: 1, displayName: 'Elsewhere', city: 'Elsewhere' },
    });
    expect(stale).toBe(moved);
  });

  it('keeps a custom label when the point is moved and resolved', () => {
    let state = posterReducer(withBerlin(), { type: 'setLocationLabel', value: 'Our bench' });
    state = posterReducer(state, { type: 'moveLocation', latitude: 52.52, longitude: 13.4 });
    state = posterReducer(state, {
      type: 'resolveLocation',
      location: { latitude: 52.52, longitude: 13.4, displayName: 'x', city: 'Elsewhere' },
    });
    expect(state.locationLabel).toBe('Our bench');

    state = posterReducer(state, { type: 'useAutomaticLabel' });
    expect(state.locationLabel).toBe('Elsewhere');
    expect(state.locationLabelCustom).toBe(false);
  });

  it('updates and validates design values', () => {
    const state = posterReducer(DEFAULT_CONFIG, {
      type: 'update',
      patch: { frameShape: 'circle', title: 'Hier fing alles an', zoom: 2 },
    });
    expect(state.frameShape).toBe('circle');
    expect(state.title).toBe('Hier fing alles an');
    expect(state.zoom).toBe(3);

    const invalid = posterReducer(state, {
      type: 'update',
      patch: { frameShape: 'pin' as PosterConfig['frameShape'] },
    });
    expect(invalid.frameShape).toBe('heart');
  });

  it('applies colour presets without touching text or layout', () => {
    const midnight = THEME_PRESETS.find((preset) => preset.id === 'midnight')!;
    const state = posterReducer(withBerlin({ title: 'Custom' }), {
      type: 'applyPreset',
      preset: midnight,
    });
    expect(state.posterBackground).toBe(midnight.posterBackground);
    expect(state.mapInk).toBe(midnight.mapInk);
    expect(state.title).toBe('Custom');
    expect(state.frameShape).toBe('heart');
  });

  it('reset restores the defaults but keeps the selected place', () => {
    const designed = posterReducer(withBerlin(), {
      type: 'update',
      patch: { title: 'Changed', frameShape: 'star', markerColor: '#000000' },
    });
    const reset = posterReducer(designed, { type: 'reset' });
    expect(reset).toEqual({ ...DEFAULT_CONFIG, location: BERLIN, locationLabel: 'Berlin' });
  });

  it('replace sanitizes the incoming config', () => {
    const state = posterReducer(DEFAULT_CONFIG, {
      type: 'replace',
      config: { ...DEFAULT_CONFIG, markerSize: 9999 },
    });
    expect(state.markerSize).toBe(160);
  });

  it('translates only an unedited default title', () => {
    const german = posterReducer(DEFAULT_CONFIG, {
      type: 'localizeTitle',
      title: 'Wo alles begann...',
    });
    expect(german.title).toBe('Wo alles begann...');
    expect(
      posterReducer(german, { type: 'localizeTitle', title: 'Where it all began...' }).title,
    ).toBe('Where it all began...');
    const custom = { ...DEFAULT_CONFIG, title: 'Our story' };
    expect(posterReducer(custom, { type: 'localizeTitle', title: 'Wo alles begann...' })).toBe(
      custom,
    );
  });

  it('resets to the default title of the current language', () => {
    const state = posterReducer(withBerlin({ title: 'Our story' }), {
      type: 'reset',
      title: 'Wo alles begann...',
    });
    expect(state.title).toBe('Wo alles begann...');
  });
});
