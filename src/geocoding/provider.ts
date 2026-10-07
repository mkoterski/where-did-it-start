import { createNominatimProvider } from './nominatim';
import type { GeocodingProvider } from './types';

let resultLanguage: string | undefined =
  typeof navigator !== 'undefined' ? navigator.language : undefined;

/** Search results and place names follow the language chosen in the app. */
export function setGeocoderLanguage(language: string) {
  resultLanguage = language;
}

/** The geocoder used by the app. Replace this to switch providers. */
export const geocoder: GeocodingProvider = createNominatimProvider({
  baseUrl: import.meta.env.VITE_NOMINATIM_URL || undefined,
  email: import.meta.env.VITE_NOMINATIM_EMAIL || undefined,
  language: () => resultLanguage,
});
