import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Engine tests are pure Node — no DOM needed.
    environmentMatchGlobs: [
      ['services/playgame/engine/**', 'node'],
    ],
    // Default for everything else (UI components etc.) — jsdom.
    environment: 'jsdom',
    // Setup file patches process.exit so the custom-runner test files work
    // under vitest without crashing the worker.
    setupFiles: ['services/playgame/engine/__tests__/setup.ts'],
  },
});
