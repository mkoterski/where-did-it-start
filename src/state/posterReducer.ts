import { deriveLocationLabel, sanitizeConfig } from '../domain/config';
import { DEFAULT_CONFIG, TEXT_LIMITS, type ThemePreset } from '../domain/defaults';
import type { LocationSelection, PosterConfig } from '../domain/types';

export type PosterAction =
  | { type: 'update'; patch: Partial<PosterConfig> }
  /** A deliberately chosen place (search result, example, current position). */
  | { type: 'selectLocation'; location: LocationSelection }
  /** The point was moved on the map or typed in; place details follow via `resolveLocation`. */
  | { type: 'moveLocation'; latitude: number; longitude: number }
  /** Reverse-geocoded details for the current point. Ignored if the point moved meanwhile. */
  | { type: 'resolveLocation'; location: LocationSelection }
  | { type: 'setLocationLabel'; value: string }
  | { type: 'useAutomaticLabel' }
  | { type: 'applyPreset'; preset: ThemePreset }
  | { type: 'reset' }
  | { type: 'replace'; config: PosterConfig };

const COORDINATE_EPSILON = 1e-9;

function samePoint(a: LocationSelection, b: LocationSelection): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < COORDINATE_EPSILON &&
    Math.abs(a.longitude - b.longitude) < COORDINATE_EPSILON
  );
}

function withLocation(state: PosterConfig, location: LocationSelection): PosterConfig {
  return {
    ...state,
    location,
    locationLabel: state.locationLabelCustom ? state.locationLabel : deriveLocationLabel(location),
  };
}

export function posterReducer(state: PosterConfig, action: PosterAction): PosterConfig {
  switch (action.type) {
    case 'update':
      return sanitizeConfig({ ...state, ...action.patch });

    case 'selectLocation':
      // A newly chosen place gets its own name again, even if the old label was custom.
      return withLocation({ ...state, locationLabelCustom: false }, action.location);

    case 'moveLocation': {
      const previous = state.location;
      return {
        ...state,
        location: {
          latitude: action.latitude,
          longitude: action.longitude,
          // Keep the old place names until the reverse lookup answers, to avoid flicker.
          displayName: previous?.displayName ?? 'Selected point',
          name: previous?.name,
          city: previous?.city,
          country: previous?.country,
        },
      };
    }

    case 'resolveLocation':
      if (!state.location || !samePoint(state.location, action.location)) return state;
      return withLocation(state, action.location);

    case 'setLocationLabel':
      return {
        ...state,
        locationLabel: action.value.slice(0, TEXT_LIMITS.locationLabel),
        locationLabelCustom: true,
      };

    case 'useAutomaticLabel':
      return {
        ...state,
        locationLabelCustom: false,
        locationLabel: deriveLocationLabel(state.location),
      };

    case 'applyPreset':
      return {
        ...state,
        posterBackground: action.preset.posterBackground,
        textColor: action.preset.textColor,
        mapInk: action.preset.mapInk,
        waterStyle: action.preset.waterStyle,
        markerColor: action.preset.markerColor,
      };

    case 'reset':
      // Reset the design, but keep the place the user picked.
      return {
        ...DEFAULT_CONFIG,
        location: state.location,
        locationLabel: deriveLocationLabel(state.location),
      };

    case 'replace':
      return sanitizeConfig(action.config);
  }
}
