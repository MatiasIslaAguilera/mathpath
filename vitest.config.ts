import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  test: {
    include: ['tests/**/*.test.ts'],
    // The generator harness runs 1,000 seeds per level; give it room.
    testTimeout: 180_000,
    // `npm run test:quick`: 100 seeds per level while iterating. Run the full `npm test` before committing.
    env: mode === 'quick' ? { SEEDS: '100' } : {},
  },
}));
