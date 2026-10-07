import { createNominatimProvider } from './nominatim';
import type { GeocodingProvider } from './types';

/** The geocoder used by the app. Replace this to switch providers. */
export const geocoder: GeocodingProvider = createNominatimProvider({
  baseUrl: import.meta.env.VITE_NOMINATIM_URL || undefined,
  email: import.meta.env.VITE_NOMINATIM_EMAIL || undefined,
  language: typeof navigator !== 'undefined' ? navigator.language : undefined,
});
