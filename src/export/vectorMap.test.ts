import { fromVectorTileJs } from '@maplibre/vt-pbf';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/defaults';
import { computeLayout } from '../domain/layout';
import { buildMapStyle, mapStyleOptions } from '../domain/mapStyle';
import type { PosterConfig } from '../domain/types';
import {
  compileLayers,
  featurePath,
  lngLatToWorld,
  posterProjection,
  renderVectorMap,
  tilesCovering,
} from './vectorMap';

const CONFIG: PosterConfig = {
  ...DEFAULT_CONFIG,
  zoom: 13.2,
  location: { latitude: 52.509711, longitude: 13.376046, displayName: 'Potsdamer Platz' },
};

type Geometry = Array<Array<{ x: number; y: number }>>;

/** A real, pbf-encoded vector tile with the given layers. */
function tile(
  layers: Record<
    string,
    Array<{ type: 2 | 3; properties: Record<string, string>; geometry: Geometry }>
  >,
) {
  return fromVectorTileJs({
    layers: Object.fromEntries(
      Object.entries(layers).map(([name, features]) => [
        name,
        {
          version: 2,
          name,
          extent: 4096,
          length: features.length,
          feature: (i: number) => ({
            type: features[i].type,
            properties: features[i].properties,
            id: i,
            extent: 4096,
            loadGeometry: () => features[i].geometry as never,
          }),
        },
      ]),
    ),
  });
}

describe('projection helpers', () => {
  it('maps longitude/latitude to Web Mercator world pixels', () => {
    expect(lngLatToWorld(0, 0, 512)).toEqual({ x: 256, y: 256 });
    const north = lngLatToWorld(13.4, 52.5, 512);
    expect(north.x).toBeGreaterThan(256);
    expect(north.y).toBeLessThan(256);
  });

  it('puts the selected location on the poster anchor', () => {
    const layout = computeLayout(CONFIG);
    const projection = posterProjection(CONFIG, layout);
    const centre = lngLatToWorld(13.376046, 52.509711, projection.worldSize);
    const [x, y] = projection.toPoster(centre.x, centre.y);
    expect(x).toBeCloseTo(layout.anchor.x);
    expect(y).toBeCloseTo(layout.anchor.y);
    expect(projection.toWorld(x, y)[0]).toBeCloseTo(centre.x);
  });

  it('lists the tiles covering an area', () => {
    // World of 4 tiles (zoom 1): a box in the middle touches all four.
    expect(tilesCovering(200, 200, 300, 300, 512, 1)).toEqual([
      { z: 1, x: 0, y: 0 },
      { z: 1, x: 0, y: 1 },
      { z: 1, x: 1, y: 0 },
      { z: 1, x: 1, y: 1 },
    ]);
    expect(tilesCovering(10, 10, 20, 20, 512, 1)).toEqual([{ z: 1, x: 0, y: 0 }]);
  });
});

describe('compileLayers', () => {
  const style = buildMapStyle(mapStyleOptions(CONFIG, false));
  const layers = compileLayers(style.layers, CONFIG.zoom);
  const byId = (id: string) => layers.find((layer) => layer.id === id)!;
  const feature = (properties: Record<string, string>) => ({ type: 2, properties, id: 1 }) as never;

  it('evaluates filters and zoom-dependent widths like MapLibre', () => {
    const primary = byId('road-primary');
    expect(primary.filter(feature({ class: 'primary' }))).toBe(true);
    expect(primary.filter(feature({ class: 'primary', brunnel: 'tunnel' }))).toBe(false);
    expect(primary.filter(feature({ class: 'minor' }))).toBe(false);
    expect(Number(primary.paint(feature({ class: 'primary' }))['stroke-width'])).toBeCloseTo(
      2.86,
      1,
    );
  });

  it('uses the light-blue water colour', () => {
    expect(byId('water').paint(feature({}))).toMatchObject({ fill: 'rgba(166,205,230,1)' });
    expect(byId('waterway').paint(feature({ class: 'river' }))).toMatchObject({
      stroke: 'rgba(166,205,230,1)',
    });
  });

  it('skips layers that are hidden at the poster zoom', () => {
    const atLowZoom = compileLayers(style.layers, 9).map((layer) => layer.id);
    expect(atLowZoom).not.toContain('road-path');
    expect(layers.map((layer) => layer.id)).toContain('road-path');
  });
});

describe('featurePath', () => {
  it('writes compact path data and closes polygons', () => {
    const identity = (x: number, y: number): [number, number] => [x, y];
    const square = [
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 0 },
      ],
    ];
    expect(featurePath(square, true, identity)).toBe('M0 0L10 0L10 10L0 0Z');
    // Points closer than 0.15 units to the previous one are dropped (except the last).
    const dense = [
      [
        { x: 0, y: 0 },
        { x: 0.05, y: 0 },
        { x: 5, y: 0 },
      ],
    ];
    expect(featurePath(dense, false, identity)).toBe('M0 0L5 0');
  });
});

describe('renderVectorMap', () => {
  it('draws vector tiles as clipped SVG paths with the poster style', async () => {
    const tileData = tile({
      transportation: [
        {
          type: 2,
          properties: { class: 'primary' },
          geometry: [
            [
              { x: 0, y: 2048 },
              { x: 4096, y: 2048 },
            ],
          ],
        },
        {
          type: 2,
          properties: { class: 'primary', brunnel: 'tunnel' },
          geometry: [
            [
              { x: 2048, y: 0 },
              { x: 2048, y: 4096 },
            ],
          ],
        },
      ],
      water: [
        {
          type: 3,
          properties: {},
          geometry: [
            [
              { x: 0, y: 0 },
              { x: 1000, y: 0 },
              { x: 1000, y: 1000 },
              { x: 0, y: 0 },
            ],
          ],
        },
      ],
    });
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).endsWith('/planet')) {
        return new Response(
          JSON.stringify({ tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], maxzoom: 14 }),
        );
      }
      return new Response(new Uint8Array(tileData));
    });

    const layout = computeLayout(CONFIG);
    const result = await renderVectorMap(CONFIG, layout, { fetchImpl: fetchImpl as never });

    expect(result.tileCount).toBeGreaterThan(0);
    const requested = fetchImpl.mock.calls
      .map(([url]) => String(url))
      .filter((u) => u.endsWith('.pbf'));
    expect(requested.every((u) => u.startsWith('https://tiles.test/13/'))).toBe(true);
    expect(result.defs).toContain('<clipPath id="vmap-area">');
    expect(result.body).toContain('stroke="rgba(17,17,17,1)"'); // primary road in ink
    expect(result.body).toContain('fill="rgba(166,205,230,1)"'); // light-blue water
    expect(result.body).not.toContain('<image');
    // Tunnels are filtered out: only horizontal road segments (constant y) are drawn.
    const roads =
      result.body.match(/<path d="([^"]+)" fill="none" stroke="rgba\(17,17,17,1\)"/g) ?? [];
    expect(roads.length).toBeGreaterThan(0);
    for (const road of roads) {
      const ys = Array.from(road.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g), (m) => m[2]);
      expect(new Set(ys).size).toBeLessThanOrEqual(2);
    }
  });

  it('fails clearly when a tile cannot be loaded', async () => {
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) =>
      String(url).endsWith('/planet')
        ? new Response(JSON.stringify({ tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'] }))
        : new Response('nope', { status: 503 }),
    );
    await expect(
      renderVectorMap(CONFIG, computeLayout(CONFIG), { fetchImpl: fetchImpl as never }),
    ).rejects.toThrow(/failed \(503\)/);
  });

  it('draws subway lines from the detailed tiles when they are switched on', async () => {
    const subwayTile = tile({
      transportation: [
        {
          type: 2,
          properties: { class: 'transit', subclass: 'subway', brunnel: 'tunnel' },
          geometry: [
            [
              { x: 0, y: 1000 },
              { x: 4096, y: 1000 },
            ],
          ],
        },
        {
          type: 2,
          properties: { class: 'transit', subclass: 'tram' },
          geometry: [
            [
              { x: 1000, y: 0 },
              { x: 1000, y: 4096 },
            ],
          ],
        },
      ],
    });
    const empty = tile({});
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.endsWith('/planet')) {
        return new Response(
          JSON.stringify({ tiles: ['https://tiles.test/{z}/{x}/{y}.pbf'], maxzoom: 14 }),
        );
      }
      return new Response(new Uint8Array(path.includes('/14/') ? subwayTile : empty));
    });
    const config = { ...CONFIG, showSubway: true, subwayFade: 0 };

    const result = await renderVectorMap(config, computeLayout(config), {
      fetchImpl: fetchImpl as never,
    });

    const requested = fetchImpl.mock.calls.map(([url]) => String(url));
    expect(requested.some((u) => u.startsWith('https://tiles.test/14/'))).toBe(true);
    // The subway layer is drawn last, on top of the streets.
    const subway = result.body.match(/<path d="([^"]+)" fill="none" [^>]*\/><\/g>$/);
    expect(subway).not.toBeNull();
    // Only the horizontal subway line is drawn, not the vertical tram line.
    const segments = Array.from(
      subway![1].matchAll(/M(-?[\d.]+) (-?[\d.]+)L(-?[\d.]+) (-?[\d.]+)/g),
    );
    expect(segments.length).toBeGreaterThan(0);
    for (const [, , y1, , y2] of segments) expect(y1).toBe(y2);
  });
});
