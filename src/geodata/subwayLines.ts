import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { PosterLayout } from '../domain/layout';
import { SUBWAY_MIN_ZOOM, SUBWAY_SOURCE, TILEJSON_URL } from '../domain/mapStyle';
import {
  lngLatToWorld,
  posterProjection,
  TILE_SIZE,
  tilesCovering,
  type TileId,
} from '../domain/projection';
import type { PosterConfig } from '../domain/types';

/**
 * Subway lines are only in the most detailed vector tiles (zoom 14), while the poster usually
 * shows zoom 12–13 tiles. MapLibre cannot mix tile zooms in one source, so the lines are read
 * from the zoom-14 tiles here and handed to the map as GeoJSON.
 */
export const SUBWAY_TILE_ZOOM = 14;
/** More tiles than this (far zoomed out) would be a heavy download; the lines are skipped. */
const MAX_TILES = 160;

type Lines = GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString>;
const EMPTY: Lines = { type: 'FeatureCollection', features: [] };

let templateRequest: Promise<string> | null = null;
const tileCache = new Map<string, Promise<Lines['features']>>();

function covering(minX: number, minY: number, maxX: number, maxY: number): TileId[] {
  const worldSize = TILE_SIZE * 2 ** SUBWAY_TILE_ZOOM;
  const tiles = tilesCovering(minX, minY, maxX, maxY, worldSize, SUBWAY_TILE_ZOOM);
  return tiles.length > MAX_TILES ? [] : tiles;
}

/** The zoom-14 tiles under a map view, or none when zoomed out too far. */
export function subwayTilesForView(
  bounds: { west: number; south: number; east: number; north: number },
  zoom: number,
): TileId[] {
  if (zoom < SUBWAY_MIN_ZOOM) return [];
  const worldSize = TILE_SIZE * 2 ** SUBWAY_TILE_ZOOM;
  const nw = lngLatToWorld(bounds.west, bounds.north, worldSize);
  const se = lngLatToWorld(bounds.east, bounds.south, worldSize);
  return covering(nw.x, nw.y, se.x, se.y);
}

/** The zoom-14 tiles under the poster's map area. */
export function subwayTilesForPoster(config: PosterConfig, layout: PosterLayout): TileId[] {
  if (!config.location || config.zoom < SUBWAY_MIN_ZOOM) return [];
  const projection = posterProjection(config, layout);
  const { x, y, width, height } = layout.mapArea;
  const [minX, minY] = projection.toWorld(x, y);
  const [maxX, maxY] = projection.toWorld(x + width, y + height);
  const scale = 2 ** (SUBWAY_TILE_ZOOM - config.zoom);
  return covering(minX * scale, minY * scale, maxX * scale, maxY * scale);
}

async function tileTemplate(fetchImpl: typeof fetch): Promise<string> {
  templateRequest ??= fetchImpl(TILEJSON_URL)
    .then((response) => response.json() as Promise<{ tiles: string[] }>)
    .then((tileJson) => tileJson.tiles[0]);
  try {
    return await templateRequest;
  } catch (error) {
    templateRequest = null;
    throw error;
  }
}

async function loadTile(tile: TileId, fetchImpl: typeof fetch): Promise<Lines['features']> {
  const [{ VectorTile }, { PbfReader }, template] = await Promise.all([
    import('@mapbox/vector-tile'),
    import('pbf'),
    tileTemplate(fetchImpl),
  ]);
  const count = 2 ** tile.z;
  const wrappedX = ((tile.x % count) + count) % count;
  const url = template
    .replace('{z}', String(tile.z))
    .replace('{x}', String(wrappedX))
    .replace('{y}', String(tile.y));
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Map tile ${tile.z}/${wrappedX}/${tile.y} failed`);
  const data = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())));
  const layer = data.layers.transportation;
  const features: Lines['features'] = [];
  for (let i = 0; layer && i < layer.length; i++) {
    const feature = layer.feature(i);
    const { class: kind, subclass } = feature.properties;
    if (feature.type !== 2 || kind !== 'transit' || subclass !== 'subway') continue;
    // The unwrapped column keeps lines next to the antimeridian on the right side.
    const { geometry } = feature.toGeoJSON(tile.x, tile.y, tile.z);
    if (geometry.type === 'LineString' || geometry.type === 'MultiLineString') {
      features.push({ type: 'Feature', properties: {}, geometry });
    }
  }
  return features;
}

/** Subway lines in the given tiles, as GeoJSON. Tiles are cached for the session. */
export async function loadSubwayLines(
  tiles: TileId[],
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<Lines> {
  if (tiles.length === 0) return EMPTY;
  const lists = await Promise.all(
    tiles.map((tile) => {
      const key = `${tile.z}/${tile.x}/${tile.y}`;
      let request = tileCache.get(key);
      if (!request) {
        request = loadTile(tile, fetchImpl);
        request.catch(() => tileCache.delete(key));
        if (tileCache.size > 400) tileCache.delete(tileCache.keys().next().value as string);
        tileCache.set(key, request);
      }
      return request;
    }),
  );
  return { type: 'FeatureCollection', features: lists.flat() };
}

/**
 * Keeps an interactive map's subway source filled with the lines in view, also after style
 * changes. Missing lines are not an error: the map simply shows none. Returns a cleanup.
 */
export function keepSubwayLinesLoaded(map: MapLibreMap): () => void {
  let filled: { source: unknown; key: string } = { source: null, key: '' };
  let request = 0;

  const refresh = () => {
    const source = map.getSource<GeoJSONSource>(SUBWAY_SOURCE);
    if (!source) return;
    const bounds = map.getBounds();
    const tiles = subwayTilesForView(
      {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      },
      map.getZoom(),
    );
    const key = tiles.map((tile) => `${tile.x}/${tile.y}`).join();
    if (filled.source === source && filled.key === key) return;
    filled = { source, key };
    const id = ++request;
    loadSubwayLines(tiles)
      .then((lines) => {
        if (id === request && map.getSource(SUBWAY_SOURCE) === source) source.setData(lines);
      })
      .catch(() => {
        if (id === request) filled = { source: null, key: '' };
      });
  };

  map.on('styledata', refresh);
  map.on('moveend', refresh);
  return () => {
    request++;
    map.off('styledata', refresh);
    map.off('moveend', refresh);
  };
}
