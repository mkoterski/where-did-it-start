import { describe, expect, it } from 'vitest';
import { isStaleBuildError } from './loadExport';

describe('isStaleBuildError', () => {
  it.each([
    'Failed to fetch dynamically imported module: https://x.test/assets/exportPoster-abc.js',
    'error loading dynamically imported module: https://x.test/assets/jspdf-abc.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/index.css',
  ])('recognises %j', (message) => {
    expect(isStaleBuildError(new TypeError(message))).toBe(true);
  });

  it('ignores other errors', () => {
    expect(isStaleBuildError(new Error('Some map tiles could not be loaded.'))).toBe(false);
    expect(isStaleBuildError('nope')).toBe(false);
  });
});
