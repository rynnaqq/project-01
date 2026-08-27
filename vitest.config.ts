import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/space-simulator/core/vitest.setup.ts'],
    environment: 'node',
  },
});
