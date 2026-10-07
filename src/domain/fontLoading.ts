import { cssFont, DETAIL_FONT, getBodyFont, getTitleFont } from './typography';
import type { BodyFont, TitleFont } from './types';

/** Makes sure the poster fonts are loaded so that text measurement is accurate. */
export async function loadPosterFonts(titleFont: TitleFont, bodyFont: BodyFont): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = 'Where it all began & 0123456789°';
  const body = getBodyFont(bodyFont);
  await Promise.all(
    [getTitleFont(titleFont), body.names, body.detail, DETAIL_FONT].map((face) =>
      document.fonts.load(cssFont(face, 40), sample).catch(() => []),
    ),
  );
}
