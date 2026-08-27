import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'


export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      'server-only': resolve(__dirname, 'node_modules/next/dist/compiled/server-only/empty.js'),
    },
  },

  esbuild: { jsx: 'automatic' },
  test: {
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.unit.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'int',
          environment: 'node',
          setupFiles: ['./vitest.setup.ts'],
          include: ['**/*.int.test.ts'],
        },
      },
    ],
  },
})
