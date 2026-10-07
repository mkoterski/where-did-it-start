import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from '@maplibre/maplibre-gl-style-spec';
import { mixColors } from './colors';
import type { PosterConfig, WaterStyle } from './types';

/**
 * Map data provider. OpenFreeMap serves OpenMapTiles-schema vector tiles without an API key.
 * Any other OpenMapTiles-compatible TileJSON endpoint can be configured at build time.
 */
export const TILEJSON_URL: string =
  import.meta.env.VITE_MAP_TILEJSON_URL || 'https://tiles.openfreemap.org/planet';
export const GLYPHS_URL: string =
  import.meta.env.VITE_MAP_GLYPHS_URL ||
  'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

export const MAP_ATTRIBUTION_HTML =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

/** Short attribution printed on the poster itself. */
export const MAP_ATTRIBUTION_TEXT = '© OpenStreetMap contributors · © OpenMapTiles · OpenFreeMap';

export interface MapStyleOptions {
  paper: string;
  ink: string;
  water: WaterStyle;
  waterColor: string;
  lineWeight: number;
  contrast: number;
  buildings: boolean;
  /** Street and place labels – helpful in the editor, never printed on the poster. */
  labels: boolean;
}

export function mapStyleOptions(config: PosterConfig, labels: boolean): MapStyleOptions {
  return {
    paper: config.posterBackground,
    ink: config.mapInk,
    water: config.waterStyle,
    waterColor: config.waterColor,
    lineWeight: config.lineWeight,
    contrast: config.mapContrast,
    buildings: config.showBuildings,
    labels,
  };
}

type Stops = Array<[number, number]>;

/** Exponential zoom interpolation of a line width, multiplied by the user's line weight. */
function width(stops: Stops, weight: number): ExpressionSpecification {
  return [
    'interpolate',
    ['exponential', 1.6],
    ['zoom'],
    ...stops.flatMap(([zoom, value]) => [zoom, value * weight]),
  ] as ExpressionSpecification;
}

const NOT_TUNNEL: ExpressionSpecification = ['!=', ['get', 'brunnel'], 'tunnel'];

function roadLayer(
  id: string,
  classes: string[],
  color: string,
  stops: Stops,
  weight: number,
  opacity = 1,
  minzoom = 0,
): LayerSpecification {
  return {
    id,
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom,
    filter: ['all', ['match', ['get', 'class'], classes, true, false], NOT_TUNNEL],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': width(stops, weight), 'line-opacity': opacity },
  };
}

export function buildMapStyle(options: MapStyleOptions): StyleSpecification {
  const { paper, ink, lineWeight: w } = options;
  const contrast = Math.min(1, Math.max(0, options.contrast));
  // Minor streets fade towards the paper colour as contrast drops.
  const minor = mixColors(ink, paper, (1 - contrast) * 0.75);
  const faint = mixColors(ink, paper, 0.35 + (1 - contrast) * 0.45);
  const waterFill =
    options.water === 'color'
      ? options.waterColor
      : options.water === 'ink'
        ? ink
        : options.water === 'tint'
          ? mixColors(ink, paper, 0.78)
          : paper;

  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': paper } },
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      filter: ['!=', ['get', 'brunnel'], 'tunnel'],
      paint: { 'fill-color': waterFill, 'fill-antialias': true },
    },
  ];

  if (options.water === 'outline') {
    layers.push({
      id: 'water-outline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'line-color': ink, 'line-width': 0.8 * w },
    });
  }

  layers.push({
    id: 'waterway',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    minzoom: 8,
    filter: ['!=', ['get', 'brunnel'], 'tunnel'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      // Narrow rivers and canals are lines; they match the water areas.
      'line-color': options.water === 'ink' || options.water === 'outline' ? ink : waterFill,
      // Zoom must be the outermost expression, so the class switch sits inside each stop.
      'line-width': [
        'interpolate',
        ['exponential', 1.6],
        ['zoom'],
        ...(
          [
            [10, 0.8, 0.15],
            [13, 2.4, 0.5],
            [16, 7, 1.6],
          ] as const
        ).flatMap(([zoom, river, stream]) => [
          zoom,
          ['match', ['get', 'class'], ['river', 'canal'], river * w, stream * w],
        ]),
      ] as ExpressionSpecification,
    },
  });

  if (options.buildings) {
    layers.push({
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': mixColors(ink, paper, 0.86) },
    });
  }

  layers.push(
    roadLayer(
      'road-path',
      ['path', 'track'],
      faint,
      [
        [13, 0.3],
        [16, 1.1],
      ],
      w,
      0.6 + 0.4 * contrast,
      13,
    ),
    roadLayer(
      'road-service',
      ['service'],
      minor,
      [
        [12, 0.25],
        [13, 0.45],
        [16, 1.8],
      ],
      w,
      1,
      12,
    ),
    roadLayer(
      'road-minor',
      ['minor'],
      minor,
      [
        [10, 0.15],
        [13, 0.85],
        [16, 3.4],
      ],
      w,
    ),
    roadLayer(
      'road-tertiary',
      ['tertiary'],
      ink,
      [
        [9, 0.25],
        [13, 1.6],
        [16, 5],
      ],
      w,
    ),
    roadLayer(
      'road-secondary',
      ['secondary'],
      ink,
      [
        [8, 0.3],
        [13, 2.1],
        [16, 6.2],
      ],
      w,
    ),
    roadLayer(
      'road-primary',
      ['primary'],
      ink,
      [
        [7, 0.35],
        [13, 2.7],
        [16, 7.6],
      ],
      w,
    ),
    roadLayer(
      'road-major',
      ['motorway', 'trunk'],
      ink,
      [
        [5, 0.4],
        [13, 3.4],
        [16, 9],
      ],
      w,
    ),
    roadLayer(
      'railway',
      ['rail'],
      ink,
      [
        [10, 0.35],
        [13, 0.9],
        [16, 1.6],
      ],
      w,
      0.85,
      10,
    ),
  );

  if (options.labels) {
    const labelColor = mixColors(ink, paper, 0.3);
    layers.push(
      {
        id: 'label-road',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'transportation_name',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
        },
        paint: { 'text-color': labelColor, 'text-halo-color': paper, 'text-halo-width': 1.5 },
      },
      {
        id: 'label-place',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: [
          'match',
          ['get', 'class'],
          ['city', 'town', 'village', 'suburb', 'country'],
          true,
          false,
        ],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'class'], ['city', 'country'], 14, 11],
          'text-letter-spacing': 0.04,
          'text-max-width': 8,
        },
        paint: {
          'text-color': labelColor,
          'text-halo-color': paper,
          'text-halo-width': 2,
          'text-opacity': 0.85,
        },
      },
    );
  }

  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      openmaptiles: { type: 'vector', url: TILEJSON_URL, attribution: MAP_ATTRIBUTION_HTML },
    },
    layers,
  };
}
