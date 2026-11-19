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
  },
});
