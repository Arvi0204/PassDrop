import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // `npm test`: components are tested in jsdom, a stand-in browser that needs no real one
  test: {
    environment: 'jsdom',
    setupFiles: ['./test-setup.js'],
    css: false,
    // the tests use 1000-round key settings so they run fast; real builds never see this (see accountApi.js)
    env: { TEST_KDF_MIN_ITERATIONS: '1000' },
  },
});
