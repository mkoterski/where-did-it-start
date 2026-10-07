import greatVibesLatin from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url';
import greatVibesLatinExt from '@fontsource/great-vibes/files/great-vibes-latin-ext-400-normal.woff2?url';
import jost300Latin from '@fontsource/jost/files/jost-latin-300-normal.woff2?url';
import jost300LatinExt from '@fontsource/jost/files/jost-latin-ext-300-normal.woff2?url';
import jost400Latin from '@fontsource/jost/files/jost-latin-400-normal.woff2?url';
import jost400LatinExt from '@fontsource/jost/files/jost-latin-ext-400-normal.woff2?url';
import playfairLatin from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import playfairLatinExt from '@fontsource/playfair-display/files/playfair-display-latin-ext-400-italic.woff2?url';
import sacramentoLatin from '@fontsource/sacramento/files/sacramento-latin-400-normal.woff2?url';
import sacramentoLatinExt from '@fontsource/sacramento/files/sacramento-latin-ext-400-normal.woff2?url';
import { DETAIL_FONT, getTitleFont, NAMES_FONT, type FontFace } from '../domain/typography';
import type { TitleFont } from '../domain/types';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,' +
  'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,' +
  'U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

interface FontFile {
  face: FontFace;
  url: string;
  unicodeRange: string;
}

function files(face: FontFace, latin: string, latinExt: string): FontFile[] {
  return [
    { face, url: latin, unicodeRange: LATIN },
    { face, url: latinExt, unicodeRange: LATIN_EXT },
  ];
}

const TITLE_FILES: Record<TitleFont, FontFile[]> = {
  sacramento: files(getTitleFont('sacramento'), sacramentoLatin, sacramentoLatinExt),
  'great-vibes': files(getTitleFont('great-vibes'), greatVibesLatin, greatVibesLatinExt),
  playfair: files(getTitleFont('playfair'), playfairLatin, playfairLatinExt),
  jost: files(getTitleFont('jost'), jost300Latin, jost300LatinExt),
};

const BODY_FILES: FontFile[] = [
  ...files(NAMES_FONT, jost400Latin, jost400LatinExt),
  ...files(DETAIL_FONT, jost300Latin, jost300LatinExt),
];

const dataUrlCache = new Map<string, Promise<string>>();

async function toDataUrl(url: string): Promise<string> {
  let pending = dataUrlCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Font request failed (${response.status})`);
        return response.blob();
      })
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          }),
      );
    dataUrlCache.set(url, pending);
    pending.catch(() => dataUrlCache.delete(url));
  }
  return pending;
}

/**
 * SVGs drawn as images cannot see the page's web fonts, so the export embeds the fonts it
 * uses as data URLs in an SVG <style> block.
 */
export async function embeddedFontCss(titleFont: TitleFont): Promise<string> {
  const needed = [...TITLE_FILES[titleFont], ...BODY_FILES];
  const rules = await Promise.all(
    needed.map(async ({ face, url, unicodeRange }) => {
      const data = await toDataUrl(url);
      return (
        `@font-face{font-family:'${face.family}';font-style:${face.style};` +
        `font-weight:${face.weight};src:url(${data}) format('woff2');unicode-range:${unicodeRange};}`
      );
    }),
  );
  return rules.join('');
}
