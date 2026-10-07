/**
 * The export code is loaded on demand, so most visitors never download it. The catch: every
 * deploy replaces those files, so a tab that was opened before a deploy can no longer load
 * them. Preloading them once a place is chosen keeps open tabs working across deploys.
 */
export const loadExporter = () => import('./exportPoster');
export const loadFileHelpers = () => import('./filename');

let preloading: Promise<unknown> | null = null;

export function preloadExportModules(): void {
  if (preloading) return;
  preloading = Promise.all([loadExporter(), loadFileHelpers(), import('jspdf')]).catch(() => {
    // A failed preload is retried on the next opportunity (or on the real export).
    preloading = null;
  });
}

const STALE_BUILD_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chrome, Edge
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
  'Unable to preload', // Vite's preload helper
];

/** True when a lazily loaded file is missing because the site was updated meanwhile. */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return STALE_BUILD_PATTERNS.some((pattern) => message.includes(pattern));
}
