import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom has no canvas implementation; text measurement falls back to an estimate.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
