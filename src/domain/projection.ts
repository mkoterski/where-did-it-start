import type { PosterLayout } from './layout';
import type { PosterConfig } from './types';

/** Web Mercator helpers shared by the vector export and the subway-line loader. */

/** MapLibre's vector tiles are 512 CSS px wide at their own zoom level. */
export const TILE_SIZE = 512;

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
