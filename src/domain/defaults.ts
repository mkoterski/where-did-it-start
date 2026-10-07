import type { PosterConfig, WaterStyle } from './types';

export const TEXT_LIMITS = {
  title: 40,
  names: 50,
  locationLabel: 40,
} as const;

export const ZOOM_RANGE = { min: 3, max: 18 } as const;

export const DEFAULT_CONFIG: PosterConfig = {
  location: null,
  zoom: 13.2,

  frameShape: 'heart',
  frameSize: 0.92,
  outside: 'hidden',
  frameOutline: false,
  frameOutlineWidth: 2,

  markerShape: 'heart',
  markerStyle: 'brush-fill',
  markerColor: '#d7263d',
  markerOpacity: 1,
  markerSize: 46,
  markerOutline: false,
  markerOutlineWidth: 3,
  markerOutlineColor: '#ffffff',
  markerShadow: false,

  title: 'Where it all began...',
  names: 'Anita & Matthias',
  locationLabel: '',
  locationLabelCustom: false,
  showCoordinates: true,
  coordinateFormat: 'decimal',
  coordinatePrecision: 5,
  showAttribution: true,
  titleFont: 'sacramento',
  bodyFont: 'jost',
  titleScale: 1,
  textAlignment: 'center',

  posterBackground: '#fdfcf9',
  textColor: '#1b1b1b',
  mapInk: '#111111',
  waterStyle: 'color',
  waterColor: '#a6cde6',
  showBuildings: false,
  lineWeight: 1,
  mapContrast: 0.8,

  paperSize: 'a4',
  orientation: 'portrait',
  previewFrame: 'black',
};

export interface ThemePreset {
  id: string;
  label: string;
  posterBackground: string;
  textColor: string;
  mapInk: string;
  waterStyle: WaterStyle;
  waterColor: string;
  markerColor: string;
}

/** Colour presets. Each one only touches colours, never text or layout. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'classic',
    label: 'Classic ink',
    posterBackground: '#fdfcf9',
    textColor: '#1b1b1b',
    mapInk: '#111111',
    waterStyle: 'color',
    waterColor: '#a6cde6',
    markerColor: '#d7263d',
  },
  {
    id: 'soft',
    label: 'Soft grey',
    posterBackground: '#ffffff',
    textColor: '#2a2a2a',
    mapInk: '#3a3a3a',
    waterStyle: 'color',
    waterColor: '#bcdcee',
    markerColor: '#d7263d',
  },
  {
    id: 'linen',
    label: 'Linen',
    posterBackground: '#f5efe4',
    textColor: '#3b2f28',
    mapInk: '#3b2f28',
    waterStyle: 'color',
    waterColor: '#a9c4cc',
    markerColor: '#b4432f',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    posterBackground: '#151515',
    textColor: '#f3f0ea',
    mapInk: '#f3f0ea',
    waterStyle: 'color',
    waterColor: '#3d6580',
    markerColor: '#ff4d5e',
  },
];

export interface ExampleLocation {
  label: string;
  location: {
    latitude: number;
    longitude: number;
    displayName: string;
    name: string;
    city: string;
    country: string;
  };
}

/** Starting points offered in the empty state. Users can pick any other place. */
export const EXAMPLE_LOCATIONS: ExampleLocation[] = [
  {
    label: 'Paris, Pont Alexandre III',
    location: {
      latitude: 48.86385,
      longitude: 2.31353,
      displayName: 'Pont Alexandre III, Paris, France',
      name: 'Pont Alexandre III',
      city: 'Paris',
      country: 'France',
    },
  },
  {
    label: 'Berlin, Potsdamer Platz',
    location: {
      latitude: 52.509711,
      longitude: 13.376046,
      displayName: 'Potsdamer Platz, Berlin, Germany',
      name: 'Potsdamer Platz',
      city: 'Berlin',
      country: 'Germany',
    },
  },
  {
    label: 'München, Schloss Nymphenburg',
    location: {
      latitude: 48.15838,
      longitude: 11.50194,
      displayName: 'Schloss Nymphenburg, München, Germany',
      name: 'Schloss Nymphenburg',
      city: 'München',
      country: 'Germany',
    },
  },
];
