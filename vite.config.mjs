import { defineConfig } from 'vite';

export default defineConfig({
  root: 'browser',
  base: './',
  define: { __YMIR_READ_ONLY__: 'true' },
  build: {
    outDir: '../site',
    emptyOutDir: true,
  },
});
