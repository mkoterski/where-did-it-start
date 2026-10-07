import type { LocationSelection } from '../domain/types';

/**
 * Anything that can turn text into places and coordinates into a place. Swap the
 * implementation in `provider.ts` to use another service (Photon, Pelias, a self-hosted
 * Nominatim, a commercial API behind your own proxy…).
 */
export interface GeocodingProvider {
  /** Human readable provider name shown in the UI attribution. */
  readonly name: string;
  readonly attribution: string;
  search(query: string, signal?: AbortSignal): Promise<LocationSelection[]>;
  reverse(
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
  ): Promise<LocationSelection | null>;
}

export type GeocodingErrorKind = 'network' | 'rate-limit' | 'server' | 'invalid-query';

export class GeocodingError extends Error {
  readonly kind: GeocodingErrorKind;

  constructor(message: string, kind: GeocodingErrorKind) {
    super(message);
    this.name = 'GeocodingError';
    this.kind = kind;
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
