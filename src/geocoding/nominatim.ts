import type { LocationSelection } from '../domain/types';
import { createRateLimiter } from './rateLimiter';
import { GeocodingError, isAbortError, type GeocodingProvider } from './types';

/**
 * Nominatim (OpenStreetMap) geocoder.
 *
 * Usage policy of the public instance (https://operations.osmfoundation.org/policies/nominatim/):
 *  - at most 1 request per second → enforced by a client-side rate limiter,
 *  - no search-as-you-type → searches only run on explicit submit,
 *  - cache results and avoid repeated identical queries → in-memory cache below,
 *  - identify the application → browsers send a Referer; an optional contact e-mail can be
 *    configured with VITE_NOMINATIM_EMAIL,
 *  - attribute the data → "© OpenStreetMap contributors" is shown in the UI.
 * For heavier traffic, point VITE_NOMINATIM_URL to your own Nominatim instance.
 */

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  suburb?: string;
  county?: string;
  state?: string;
  country?: string;
}

export interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
}

export function toLocation(place: NominatimPlace): LocationSelection | null {
  const latitude = Number(place.lat);
  const longitude = Number(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = place.address ?? {};
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.hamlet ??
    address.county ??
    address.state;
  return {
    latitude,
    longitude,
    displayName: place.display_name,
    name: place.name || undefined,
    city,
    country: address.country,
  };
}

interface NominatimOptions {
  baseUrl?: string;
  email?: string;
  language?: string;
  fetchImpl?: typeof fetch;
  minIntervalMs?: number;
}

export function createNominatimProvider(options: NominatimOptions = {}): GeocodingProvider {
  const baseUrl = (options.baseUrl ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const schedule = createRateLimiter(options.minIntervalMs ?? 1100);
  const cache = new Map<string, unknown>();

  async function request<T>(path: string, params: Record<string, string>, signal?: AbortSignal) {
    const search = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', ...params });
    if (options.language) search.set('accept-language', options.language);
    if (options.email) search.set('email', options.email);
    const url = `${baseUrl}/${path}?${search.toString()}`;

    if (cache.has(url)) return cache.get(url) as T;

    let response: Response;
    try {
      response = await schedule(
        () => fetchImpl(url, { signal, headers: { Accept: 'application/json' } }),
        signal,
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      throw new GeocodingError(
        'The place search could not be reached. Check your connection and try again.',
        'network',
      );
    }
    if (response.status === 429) {
      throw new GeocodingError(
        'Too many searches in a short time. Please wait a moment.',
        'rate-limit',
      );
    }
    if (!response.ok) {
      throw new GeocodingError(`The place search failed (HTTP ${response.status}).`, 'server');
    }
    const data = (await response.json()) as T;
    if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    cache.set(url, data);
    return data;
  }

  return {
    name: 'Nominatim',
    attribution: 'Search by Nominatim · © OpenStreetMap contributors',

    async search(query, signal) {
      const q = query.trim();
      if (q.length < 2) {
        throw new GeocodingError('Type at least two characters to search.', 'invalid-query');
      }
      const places = await request<NominatimPlace[]>('search', { q, limit: '8' }, signal);
      // OSM often has several objects for one landmark (node, way, relation) with the same
      // address. Showing them all only makes the choice harder.
      const seen = new Set<string>();
      return places
        .map(toLocation)
        .filter((place): place is LocationSelection => {
          if (!place || seen.has(place.displayName)) return false;
          seen.add(place.displayName);
          return true;
        })
        .slice(0, 6);
    },

    async reverse(latitude, longitude, signal) {
      const place = await request<NominatimPlace & { error?: string }>(
        'reverse',
        { lat: latitude.toFixed(6), lon: longitude.toFixed(6), zoom: '16' },
        signal,
      );
      if (place.error) return null;
      const location = toLocation(place);
      // Keep the exact point the user chose rather than the snapped address point.
      return location ? { ...location, latitude, longitude } : null;
    },
  };
}
