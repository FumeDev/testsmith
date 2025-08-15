import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node18',
  external: [
    '@playwright/test',
    '@playwright/test/reporter',
    'axios',
    'dotenv',
    'openai',
    'stagehand',
    'fs',
    'path',
    'crypto',
    'http',
    'https'
  ]
}); 