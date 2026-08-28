import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm', 'iife'],
  globalName: 'StruktRenderer',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
});
