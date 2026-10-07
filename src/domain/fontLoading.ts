import { cssFont, DETAIL_FONT, getTitleFont, NAMES_FONT } from './typography';
import type { TitleFont } from './types';

/** Makes sure the poster fonts are loaded so that text measurement is accurate. */
export async function loadPosterFonts(titleFont: TitleFont): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = 'Where it all began & 0123456789°';
  await Promise.all(
    [getTitleFont(titleFont), NAMES_FONT, DETAIL_FONT].map((face) =>
      document.fonts.load(cssFont(face, 40), sample).catch(() => []),
    ),
  );
}
