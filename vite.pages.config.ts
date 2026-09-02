import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const projectRoot = process.cwd();

export default defineConfig({
  root: resolve(projectRoot, 'pages'),
  base: '/klinikschema/',
  publicDir: resolve(projectRoot, 'public'),
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, 'pages-dist'),
    emptyOutDir: true,
  },
});
