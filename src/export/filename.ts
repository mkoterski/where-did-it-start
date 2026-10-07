import type { PosterConfig } from '../domain/types';

export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** e.g. "where-it-all-began-berlin.png" */
export function exportFilename(
  config: PosterConfig,
  extension: string,
  prefix = 'where-it-all-began',
): string {
  const place = slugify(
    config.locationLabel || config.location?.city || config.location?.name || '',
  );
  return `${prefix}${place ? `-${place}` : ''}.${extension}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser time to start the download before releasing the blob.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
