import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  // Solid JSX transform so component render tests work under vitest/jsdom.
  plugins: [solidPlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
    conditions: ['development', 'browser'],
  },
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.claude/worktrees/**',
    ],
    server: { deps: { inline: [/solid-js/, /@solidjs/] } },
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
