import { useEffect, useReducer } from 'react';
import { readShareHash, sanitizeConfig, SHARE_PARAM } from '../domain/config';
import { DEFAULT_CONFIG } from '../domain/defaults';
import type { PosterConfig } from '../domain/types';
import { posterReducer } from './posterReducer';

export const STORAGE_KEY = 'where-did-it-start:poster:v1';

/** A shared link wins over the last saved design, which wins over the defaults. */
export function loadInitialConfig(): PosterConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };

  const shared = readShareHash(window.location.hash);
  if (shared) {
    // The hash has served its purpose; edits from here on are saved locally.
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.replace(/^#/, ''));
    params.delete(SHARE_PARAM);
    url.hash = params.toString();
    window.history.replaceState(null, '', url.toString());
    return shared;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return sanitizeConfig(JSON.parse(stored));
  } catch {
    // Storage can be unavailable (private mode) or hold invalid JSON; fall back to defaults.
  }
  return { ...DEFAULT_CONFIG };
}

export function usePosterState() {
  const [config, dispatch] = useReducer(posterReducer, undefined, loadInitialConfig);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {
        // Persisting is a convenience; the editor keeps working without it.
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [config]);

  return [config, dispatch] as const;
}
