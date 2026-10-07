import {
  expression,
  featureFilter,
  latest,
  type LayerSpecification,
  type StylePropertyExpression,
} from '@maplibre/maplibre-gl-style-spec';
import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import type { PosterLayout, Rect } from '../domain/layout';
import { buildMapStyle, mapStyleOptions, TILEJSON_URL } from '../domain/mapStyle';
import type { PosterConfig } from '../domain/types';

/**
 * Draws the poster map as SVG vectors straight from the vector tiles, evaluating the same
 * MapLibre style the preview uses. No WebGL, no large canvas: much lighter than rendering
 * the map as a print-size image, and the result stays sharp at any size.
 */

/** MapLibre's vector tiles are 512 CSS px wide at their own zoom level. */
const TILE_SIZE = 512;

export interface TileId {
  z: number;
  /** Unwrapped column (may be outside 0…2^z near the antimeridian), used for positioning. */
  x: number;
  y: number;
}

export function lngLatToWorld(longitude: number, latitude: number, worldSize: number) {
  const lat = Math.max(-85.0511, Math.min(85.0511, latitude));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
  };
}

/** Converts between poster design units and world pixels at the poster zoom. */
export function posterProjection(config: PosterConfig, layout: PosterLayout) {
  const location = config.location!;
  const worldSize = TILE_SIZE * 2 ** config.zoom;
  const centre = lngLatToWorld(location.longitude, location.latitude, worldSize);
  return {
    worldSize,
    toPoster: (wx: number, wy: number): [number, number] => [
      wx - centre.x + layout.anchor.x,
      wy - centre.y + layout.anchor.y,
    ],
    toWorld: (px: number, py: number): [number, number] => [
      px - layout.anchor.x + centre.x,
      py - layout.anchor.y + centre.y,
    ],
  };
}

/** The tiles at zoom `tileZoom` that cover a rectangle given in world pixels. */
export function tilesCovering(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  worldSize: number,
  tileZoom: number,
): TileId[] {
  const tileUnits = worldSize / 2 ** tileZoom;
  const count = 2 ** tileZoom;
  const tiles: TileId[] = [];
  const y0 = Math.max(0, Math.floor(minY / tileUnits));
  const y1 = Math.min(count - 1, Math.floor(maxY / tileUnits));
  for (let x = Math.floor(minX / tileUnits); x <= Math.floor(maxX / tileUnits); x++) {
    for (let y = y0; y <= y1; y++) tiles.push({ z: tileZoom, x, y });
  }
  return tiles;
}

const fmt = (value: number) => Math.round(value * 10) / 10;

interface CompiledLayer {
  id: string;
  type: 'background' | 'fill' | 'line';
  sourceLayer?: string;
  filter: (feature: VectorTileFeature) => boolean;
  paint: (feature: VectorTileFeature) => Record<string, string>;
}

/** Turns style layers into functions that decide what to draw and how, at the poster zoom. */
export function compileLayers(layers: LayerSpecification[], zoom: number): CompiledLayer[] {
  const globals = { zoom };
  const compiled: CompiledLayer[] = [];

  for (const layer of layers) {
    if (layer.type !== 'background' && layer.type !== 'fill' && layer.type !== 'line') continue;
    if ('minzoom' in layer && layer.minzoom !== undefined && zoom < layer.minzoom) continue;
    if ('maxzoom' in layer && layer.maxzoom !== undefined && zoom >= layer.maxzoom) continue;

    const paintSpec = (latest as unknown as Record<string, Record<string, unknown>>)[
      `paint_${layer.type}`
    ];
    const paint = (layer.paint ?? {}) as Record<string, unknown>;
    const evaluators = Object.fromEntries(
      Object.entries(paint).map(([key, value]) => [
        key,
        expression.normalizePropertyExpression(
          value as never,
          key,
          paintSpec[key] as never,
        ) as StylePropertyExpression,
      ]),
    );
    const read = (key: string, feature: VectorTileFeature) =>
      evaluators[key]?.evaluate(globals, feature as never);

    const filter =
      'filter' in layer && layer.filter
        ? featureFilter(layer.filter, 'filter')
        : { filter: () => true };
    const layoutProps = ('layout' in layer ? layer.layout : undefined) as
      Record<string, unknown> | undefined;

    compiled.push({
      id: layer.id,
      type: layer.type,
      sourceLayer: 'source-layer' in layer ? layer['source-layer'] : undefined,
      filter: (feature) => filter.filter(globals, feature as never),
      paint: (feature): Record<string, string> => {
        if (layer.type === 'line') {
          return {
            stroke: String(read('line-color', feature) ?? '#000'),
            'stroke-width': String(
              Math.round(Number(read('line-width', feature) ?? 1) * 100) / 100,
            ),
            'stroke-opacity': String(read('line-opacity', feature) ?? 1),
            'stroke-linecap': String(layoutProps?.['line-cap'] ?? 'butt'),
            'stroke-linejoin': String(layoutProps?.['line-join'] ?? 'miter'),
          };
        }
        if (layer.type === 'fill') {
          return {
            fill: String(read('fill-color', feature) ?? '#000'),
            'fill-opacity': String(read('fill-opacity', feature) ?? 1),
          };
        }
        return { fill: String(read('background-color', feature) ?? '#fff') };
      },
    });
  }
  return compiled;
}

/** SVG path data for one feature, in poster units. Drops points closer than ~0.15 units. */
export function featurePath(
  rings: Array<Array<{ x: number; y: number }>>,
  close: boolean,
  transform: (x: number, y: number) => [number, number],
): string {
  let d = '';
  for (const ring of rings) {
    if (ring.length < 2) continue;
    let last: [number, number] | null = null;
    let part = '';
    ring.forEach((point, index) => {
      const [x, y] = transform(point.x, point.y);
      const isLast = index === ring.length - 1;
      if (last && !isLast && Math.abs(x - last[0]) < 0.15 && Math.abs(y - last[1]) < 0.15) return;
      part += `${last ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`;
      last = [x, y];
    });
    d += part + (close ? 'Z' : '');
  }
  return d;
}

const attributes = (values: Record<string, string>) =>
  Object.entries(values)
    .map(([key, value]) => `${key}="${value.replace(/"/g, '&quot;')}"`)
    .join(' ');

interface TileJson {
  tiles: string[];
  maxzoom?: number;
}

export interface VectorMapResult {
  /** `<clipPath>` definitions to place inside `<defs>`. */
  defs: string;
  /** The map, clipped to the poster's map area, in poster units. */
  body: string;
  tileCount: number;
}

export async function renderVectorMap(
  config: PosterConfig,
  layout: PosterLayout,
  options: { fetchImpl?: typeof fetch; idPrefix?: string } = {},
): Promise<VectorMapResult> {
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const prefix = options.idPrefix ?? 'vmap';
  const style = buildMapStyle(mapStyleOptions(config, false));
  const tileJson = (await (await fetchImpl(TILEJSON_URL)).json()) as TileJson;
  const template = tileJson.tiles[0];
  const tileZoom = Math.max(0, Math.min(tileJson.maxzoom ?? 14, Math.floor(config.zoom)));

  const projection = posterProjection(config, layout);
  const area: Rect = layout.mapArea;
  const [minX, minY] = projection.toWorld(area.x, area.y);
  const [maxX, maxY] = projection.toWorld(area.x + area.width, area.y + area.height);
  const tiles = tilesCovering(minX, minY, maxX, maxY, projection.worldSize, tileZoom);
  const tileUnits = projection.worldSize / 2 ** tileZoom;
  const count = 2 ** tileZoom;

  const decoded = await Promise.all(
    tiles.map(async (tile) => {
      const wrappedX = ((tile.x % count) + count) % count;
      const url = template
        .replace('{z}', String(tile.z))
        .replace('{x}', String(wrappedX))
        .replace('{y}', String(tile.y));
      const response = await fetchImpl(url);
      if (!response.ok)
        throw new Error(`Map tile ${tile.z}/${wrappedX}/${tile.y} failed (${response.status})`);
      return {
        tile,
        data: new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer()))),
      };
    }),
  );

  const layers = compileLayers(style.layers, config.zoom);
  let defs = `<clipPath id="${prefix}-area"><rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}"/></clipPath>`;
  decoded.forEach(({ tile }, index) => {
    const [x, y] = projection.toPoster(tile.x * tileUnits, tile.y * tileUnits);
    defs += `<clipPath id="${prefix}-t${index}"><rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(tileUnits)}" height="${fmt(tileUnits)}"/></clipPath>`;
  });

  let body = '';
  for (const layer of layers) {
    if (layer.type === 'background') {
      body += `<rect x="${area.x}" y="${area.y}" width="${area.width}" height="${area.height}" ${attributes(layer.paint({} as VectorTileFeature))}/>`;
      continue;
    }
    decoded.forEach(({ tile, data }, index) => {
      const source = layer.sourceLayer ? data.layers[layer.sourceLayer] : undefined;
      if (!source) return;
      const scale = tileUnits / source.extent;
      const transform = (gx: number, gy: number) =>
        projection.toPoster(tile.x * tileUnits + gx * scale, tile.y * tileUnits + gy * scale);

      // Features with identical paint share one <path>, which keeps the file small.
      const groups = new Map<string, { paint: Record<string, string>; d: string }>();
      for (let i = 0; i < source.length; i++) {
        const feature = source.feature(i);
        if (feature.type === 1 || (layer.type === 'fill' && feature.type !== 3)) continue;
        if (!layer.filter(feature)) continue;
        const paint = layer.paint(feature);
        if (Number(paint['stroke-width'] ?? 1) <= 0) continue;
        const d = featurePath(feature.loadGeometry(), feature.type === 3, transform);
        if (!d) continue;
        const key = JSON.stringify(paint);
        const group = groups.get(key) ?? { paint, d: '' };
        group.d += d;
        groups.set(key, group);
      }
      if (groups.size === 0) return;
      body += `<g clip-path="url(#${prefix}-t${index})">`;
      for (const { paint, d } of groups.values()) {
        body +=
          layer.type === 'fill'
            ? `<path d="${d}" fill-rule="nonzero" ${attributes(paint)}/>`
            : `<path d="${d}" fill="none" ${attributes(paint)}/>`;
      }
      body += '</g>';
    });
  }

  return {
    defs,
    body: `<g clip-path="url(#${prefix}-area)">${body}</g>`,
    tileCount: decoded.length,
  };
}
