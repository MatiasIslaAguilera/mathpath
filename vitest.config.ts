import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The generator harness runs 1,000 seeds per level; give it room.
    testTimeout: 180_000,
  },
});
