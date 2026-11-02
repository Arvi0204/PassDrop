import { defineConfig, loadEnv } from 'vite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './manifest.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REQUIRED = ['VITE_BACKEND', 'VITE_WEB_APP_URL'];

// Writes dist/manifest.json once the popup and service worker are built.
function manifestPlugin(env) {
  return {
    name: 'passhaven-manifest',
    closeBundle() {
      const { version } = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
      const backendOrigin = new URL(env.VITE_BACKEND).origin;
      mkdirSync(resolve(__dirname, 'dist'), { recursive: true });
      writeFileSync(
        resolve(__dirname, 'dist/manifest.json'),
        JSON.stringify(buildManifest({ version, backendOrigin }), null, 2)
      );
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(', ')}. Copy web_extension/.env.example to web_extension/.env and fill it in.`
    );
  }

  return {
    root: __dirname,
    base: './', // extension pages load files by relative path
    plugins: [manifestPlugin(env)],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          background: resolve(__dirname, 'src/background.js')
        },
        output: {
          // the manifest points at background.js, so it keeps a fixed name
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
