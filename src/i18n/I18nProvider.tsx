import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { setGeocoderLanguage } from '../geocoding/provider';
import { detectLanguage, I18nContext, LANGUAGE_KEY, translator } from './i18n';
import type { Language } from './messages';

export function I18nProvider({
  children,
  initialLanguage,
}: {
  children: ReactNode;
  initialLanguage?: Language;
}) {
  const [lang, setLang] = useState<Language>(() => initialLanguage ?? detectLanguage());

  useEffect(() => {
    document.documentElement.lang = lang;
    setGeocoderLanguage(lang);
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      t: translator(lang),
      setLang: (next: Language) => {
        setLang(next);
        try {
          window.localStorage.setItem(LANGUAGE_KEY, next);
        } catch {
          // Without storage the choice lasts for this visit only.
        }
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
