import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      // The quality gate enforces global coverage thresholds; keep the signal focused
      // on unit-testable modules instead of wiring/entrypoints.
      exclude: [
        '**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/main.tsx',
        'src/App.tsx',
        'src/styles/**',
        'src/components/**',
      ],
    },
  },
});
