import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // Cada hash scrypt (N=2^17) leva ~0,3 s; testes de login fazem vários em sequência.
    testTimeout: 30_000,
    // Fase 5 introduz uma linha única (`settings`) compartilhada entre arquivos de teste
    // (settings.e2e-spec.ts e sales-channels.e2e-spec.ts); arquivos em paralelo correriam
    // sobre a mesma linha ao mesmo tempo.
    fileParallelism: false,
  },
});
