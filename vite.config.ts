import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works from any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react()],
  build: {
    // MapLibre alone is ~1 MB minified and is needed on first paint. Export-only code
    // (jsPDF, the SVG renderer) is split into lazily loaded chunks.
    chunkSizeWarningLimit: 1400,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
