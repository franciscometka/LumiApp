import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Os testes de data assumem um fuso a oeste de Greenwich de proposito:
    // e nele que `toISOString().slice(0, 10)` erraria o dia, entao qualquer
    // regressao para `Date` aparece imediatamente.
    env: { TZ: 'America/Sao_Paulo' },
  },
});
