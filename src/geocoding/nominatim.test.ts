import { describe, expect, it, vi } from 'vitest';
import { createNominatimProvider, toLocation, type NominatimPlace } from './nominatim';
import { createRateLimiter } from './rateLimiter';
import { GeocodingError } from './types';

const PLACE: NominatimPlace = {
  lat: '52.5098014',
  lon: '13.3755898',
  display_name: 'Potsdamer Platz, Tiergarten, Mitte, Berlin, 10785, Deutschland',
  name: 'Potsdamer Platz',
  address: { suburb: 'Tiergarten', city: 'Berlin', country: 'Deutschland' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function provider(fetchImpl: typeof fetch) {
  return createNominatimProvider({ fetchImpl, minIntervalMs: 0, baseUrl: 'https://geo.test/' });
}

describe('toLocation', () => {
  it('maps a Nominatim result', () => {
    expect(toLocation(PLACE)).toEqual({
      latitude: 52.5098014,
      longitude: 13.3755898,
      displayName: PLACE.display_name,
      name: 'Potsdamer Platz',
      city: 'Berlin',
      country: 'Deutschland',
    });
  });

  it('falls back to town or village for the city', () => {
    expect(toLocation({ ...PLACE, address: { village: 'Kleinkleckersdorf' } })?.city).toBe(
      'Kleinkleckersdorf',
    );
  });

  it('rejects results without numeric coordinates', () => {
    expect(toLocation({ ...PLACE, lat: 'n/a' })).toBeNull();
  });
});

describe('createNominatimProvider', () => {
  it('searches, de-duplicates and builds a policy-friendly URL', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([PLACE, { ...PLACE, lat: '52.51' }]));
    const results = await provider(fetchImpl as unknown as typeof fetch).search(
      ' Potsdamer Platz ',
    );
    expect(results).toHaveLength(1);
    expect(results[0].city).toBe('Berlin');

    const url = new URL(String((fetchImpl.mock.calls[0] as unknown[])[0]));
    expect(url.origin + url.pathname).toBe('https://geo.test/search');
    expect(url.searchParams.get('q')).toBe('Potsdamer Platz');
    expect(url.searchParams.get('format')).toBe('jsonv2');
  });

  it('caches identical queries', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([PLACE]));
    const geocoder = provider(fetchImpl as unknown as typeof fetch);
    await geocoder.search('Berlin');
    await geocoder.search('Berlin');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('refuses queries that are too short', async () => {
    const fetchImpl = vi.fn();
    await expect(provider(fetchImpl).search('a')).rejects.toMatchObject({ kind: 'invalid-query' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports rate limiting, server and network errors', async () => {
    await expect(
      provider(vi.fn(async () => jsonResponse({}, 429)) as unknown as typeof fetch).search(
        'Berlin',
      ),
    ).rejects.toMatchObject({ kind: 'rate-limit' });
    await expect(
      provider(vi.fn(async () => jsonResponse({}, 503)) as unknown as typeof fetch).search(
        'Berlin',
      ),
    ).rejects.toMatchObject({ kind: 'server' });
    const offline = provider(vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(offline.search('Berlin')).rejects.toBeInstanceOf(GeocodingError);
  });

  it('reverse geocodes but keeps the exact chosen point', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(PLACE));
    const result = await provider(fetchImpl as unknown as typeof fetch).reverse(52.5, 13.37);
    expect(result).toMatchObject({ latitude: 52.5, longitude: 13.37, city: 'Berlin' });
  });

  it('returns null when nothing is found at a point', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: 'Unable to geocode' }));
    expect(await provider(fetchImpl as unknown as typeof fetch).reverse(0, -30)).toBeNull();
  });
});

describe('createRateLimiter', () => {
  it('spaces tasks at least the interval apart', async () => {
    vi.useFakeTimers({ now: 0 });
    try {
      const schedule = createRateLimiter(1000);
      const starts: number[] = [];
      const task = async () => {
        starts.push(Date.now());
      };
      const all = Promise.all([schedule(task), schedule(task), schedule(task)]);
      await vi.advanceTimersByTimeAsync(3000);
      await all;
      expect(starts).toEqual([0, 1000, 2000]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops tasks that are aborted while waiting', async () => {
    const schedule = createRateLimiter(10_000);
    await schedule(async () => undefined);
    const controller = new AbortController();
    const task = vi.fn(async () => 'ran');
    const pending = schedule(task, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(task).not.toHaveBeenCalled();
  });
});
