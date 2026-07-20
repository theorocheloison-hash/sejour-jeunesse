// Config vitest ISOLÉE (§4.9) — ne touche ni next.config ni le build de prod.
// Périmètre : fonctions pures de src/lib (pas de DOM, pas de composants).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Aligné sur tsconfig.json : "@/*" → "./*" (racine frontend).
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
