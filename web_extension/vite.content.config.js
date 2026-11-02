import { defineConfig } from 'vite';

// The content script is built on its own, as a single self-contained file: Chrome loads content
// scripts as classic scripts, so they cannot import shared chunks the way the popup can.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false, // keep what the main build wrote
    lib: {
      entry: 'src/content.js',
      formats: ['iife'],
      name: 'PassDropContent',
      fileName: () => 'content.js'
    }
  }
});
