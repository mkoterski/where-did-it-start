import { deriveLocationLabel, sanitizeConfig } from '../domain/config';
import { DEFAULT_CONFIG, TEXT_LIMITS, type ThemePreset } from '../domain/defaults';
import type { LocationSelection, PosterConfig } from '../domain/types';
import { MESSAGES } from '../i18n/messages';

/** The untouched default title in every language. */
const DEFAULT_TITLES = new Set(
  Object.values(MESSAGES).map((messages) => messages['defaults.title']),
);

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
  /** `title` is the default title in the current language. */
  | { type: 'reset'; title?: string }
  /** Swap an unedited default title for the one in the current language. */
  | { type: 'localizeTitle'; title: string }
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
          displayName: previous?.displayName ?? '',
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
        waterColor: action.preset.waterColor,
        markerColor: action.preset.markerColor,
      };

    case 'reset':
      // Reset the design, but keep the place the user picked.
      return {
        ...DEFAULT_CONFIG,
        title: action.title ?? DEFAULT_CONFIG.title,
        location: state.location,
        locationLabel: deriveLocationLabel(state.location),
      };

    case 'localizeTitle':
      return DEFAULT_TITLES.has(state.title) && state.title !== action.title
        ? { ...state, title: action.title }
        : state;

    case 'replace':
      return sanitizeConfig(action.config);
  }
}
