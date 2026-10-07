import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../domain/defaults';
import { exportPixelSize, MAX_EXPORT_PIXELS } from '../domain/paper';
import { exportFilename, slugify } from './filename';

describe('export file names', () => {
  it('slugifies place names', () => {
    expect(slugify('München')).toBe('munchen');
    expect(slugify('Straße des 17. Juni')).toBe('strasse-des-17-juni');
    expect(slugify('  São Paulo!! ')).toBe('sao-paulo');
  });

  it('describes the place in the file name', () => {
    expect(exportFilename({ ...DEFAULT_CONFIG, locationLabel: 'Berlin' }, 'png')).toBe(
      'where-it-all-began-berlin.png',
    );
    expect(exportFilename(DEFAULT_CONFIG, 'pdf')).toBe('where-it-all-began.pdf');
  });
});

describe('exportPixelSize', () => {
  it('computes print sizes from paper and dpi', () => {
    expect(exportPixelSize('a4', 'portrait', 'print')).toEqual({
      width: 2480,
      height: 3508,
      dpi: 300,
    });
    expect(exportPixelSize('a4', 'landscape', 'standard')).toEqual({
      width: 1754,
      height: 1240,
      dpi: 150,
    });
  });

  it('caps very large posters to a safe pixel count', () => {
    const size = exportPixelSize('50x70', 'portrait', 'print');
    expect(size.dpi).toBeLessThan(300);
    expect(size.width * size.height).toBeLessThanOrEqual(MAX_EXPORT_PIXELS);
  });
});
