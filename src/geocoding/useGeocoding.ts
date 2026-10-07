import { useCallback, useEffect, useRef, useState } from 'react';
import type { LocationSelection } from '../domain/types';
import { geocoder as defaultGeocoder } from './provider';
import {
  GeocodingError,
  isAbortError,
  type GeocodingErrorKind,
  type GeocodingProvider,
} from './types';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'success'; query: string; results: LocationSelection[] }
  /** `kind` picks the (translated) message shown to the user. */
  | { status: 'error'; query: string; kind: GeocodingErrorKind | 'unknown'; message: string };

function kindOf(error: unknown): GeocodingErrorKind | 'unknown' {
  return error instanceof GeocodingError ? error.kind : 'unknown';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong while searching.';
}

/** Search on submit. A new search cancels the previous one. */
export function useGeocodingSearch(provider: GeocodingProvider = defaultGeocoder) {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const search = useCallback(
    async (query: string) => {
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setState({ status: 'loading', query });
      try {
        const results = await provider.search(query, current.signal);
        if (!current.signal.aborted) setState({ status: 'success', query, results });
      } catch (error) {
        if (isAbortError(error) || current.signal.aborted) return;
        setState({ status: 'error', query, kind: kindOf(error), message: messageOf(error) });
      }
    },
    [provider],
  );

  const clear = useCallback(() => {
    controller.current?.abort();
    setState({ status: 'idle' });
  }, []);

  return { state, search, clear };
}

export type ReverseState =
  { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string };

/**
 * Looks up place details for a point. Only the most recent request counts, and requests
 * are debounced so dragging the marker around does not flood the provider.
 */
export function useReverseGeocoding(
  onResolved: (location: LocationSelection) => void,
  provider: GeocodingProvider = defaultGeocoder,
  debounceMs = 450,
) {
  const [state, setState] = useState<ReverseState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const callback = useRef(onResolved);
  useEffect(() => {
    callback.current = onResolved;
  });

  useEffect(
    () => () => {
      controller.current?.abort();
      window.clearTimeout(timer.current);
    },
    [],
  );

  const resolve = useCallback(
    (latitude: number, longitude: number) => {
      controller.current?.abort();
      window.clearTimeout(timer.current);
      const current = new AbortController();
      controller.current = current;
      setState({ status: 'loading' });
      timer.current = window.setTimeout(async () => {
        try {
          const location = await provider.reverse(latitude, longitude, current.signal);
          if (current.signal.aborted) return;
          if (location) callback.current(location);
          setState({ status: 'idle' });
        } catch (error) {
          if (isAbortError(error) || current.signal.aborted) return;
          setState({ status: 'error', message: messageOf(error) });
        }
      }, debounceMs);
    },
    [provider, debounceMs],
  );

  return { state, resolve };
}
