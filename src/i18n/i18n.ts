import { createContext, useContext } from 'react';
import { format, MESSAGES, type Language, type MessageKey } from './messages';

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export interface I18n {
  lang: Language;
  setLang(lang: Language): void;
  t: Translate;
}

export const LANGUAGES: Language[] = ['de', 'en'];
export const LANGUAGE_KEY = 'where-did-it-start:language';

export function translator(lang: Language): Translate {
  return (key, params) => format(MESSAGES[lang][key], params);
}

/** The saved choice, else the browser language (German for any `de-*`), else English. */
export function detectLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    // Storage may be blocked; fall back to the browser language.
  }
  const preferred = typeof navigator !== 'undefined' ? (navigator.languages ?? []) : [];
  const first = preferred[0] ?? (typeof navigator !== 'undefined' ? navigator.language : '');
  return first?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export const I18nContext = createContext<I18n>({
  lang: 'en',
  setLang: () => {},
  t: translator('en'),
});

export function useI18n(): I18n {
  return useContext(I18nContext);
}
