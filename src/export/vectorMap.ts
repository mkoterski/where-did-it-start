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
import { buildMapStyle, mapStyleOptions, SUBWAY_SOURCE, TILEJSON_URL } from '../domain/mapStyle';
import { lngLatToWorld, posterProjection, tilesCovering } from '../domain/projection';
import type { PosterConfig } from '../domain/types';
import { loadSubwayLines, subwayTilesForPoster } from '../geodata/subwayLines';

/**
 * Draws the poster map as SVG vectors straight from the vector tiles, evaluating the same
 * MapLibre style the preview uses. No WebGL, no large canvas: much lighter than rendering
 * the map as a print-size image, and the result stays sharp at any size.
 */

export { lngLatToWorld, posterProjection, tilesCovering, type TileId } from '../domain/projection';

const fmt = (value: number) => Math.round(value * 10) / 10;

interface CompiledLayer {
  id: string;
  type: 'background' | 'fill' | 'line';
  source?: string;
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
      source: 'source' in layer ? layer.source : undefined,
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

/** Lines given in longitude/latitude (the subway lines), as one path in poster units. */
function geoJsonLines(
  lines: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString>,
  layer: CompiledLayer,
  projection: ReturnType<typeof posterProjection>,
): string {
  const toPoster = (longitude: number, latitude: number) => {
    const world = lngLatToWorld(longitude, latitude, projection.worldSize);
    return projection.toPoster(world.x, world.y);
  };
  let d = '';
  for (const { geometry } of lines.features) {
    const parts = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates;
    d += featurePath(
      parts.map((part) => part.map(([x, y]) => ({ x, y }))),
      false,
      toPoster,
    );
  }
  if (!d) return '';
  const paint = layer.paint({ type: 2, properties: {} } as unknown as VectorTileFeature);
  return `<path d="${d}" fill="none" ${attributes(paint)}/>`;
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
  const subwayLines = layers.some((layer) => layer.source === SUBWAY_SOURCE)
    ? await loadSubwayLines(subwayTilesForPoster(config, layout), fetchImpl)
    : null;
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
    if (layer.source === SUBWAY_SOURCE) {
      if (subwayLines) body += geoJsonLines(subwayLines, layer, projection);
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
