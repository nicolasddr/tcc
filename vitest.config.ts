import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'


export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
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
