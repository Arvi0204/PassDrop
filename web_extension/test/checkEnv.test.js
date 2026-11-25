import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseEnvProblems } from '../scripts/checkEnv.js';

const ok = { VITE_BACKEND: 'https://pass-drop.vercel.app', VITE_WEB_APP_URL: 'https://pass-drop.vercel.app' };

test('a release build accepts public https addresses', () => {
  assert.deepEqual(releaseEnvProblems(ok), []);
});

test('a release build refuses http, localhost and junk, naming the variable', () => {
  for (const bad of ['http://pass-drop.vercel.app', 'https://localhost:3000', 'https://127.0.0.1', 'https://[::1]:3000', 'localhost:3000', '', undefined]) {
    assert.match(releaseEnvProblems({ ...ok, VITE_BACKEND: bad })[0], /VITE_BACKEND/);
    assert.match(releaseEnvProblems({ ...ok, VITE_WEB_APP_URL: bad })[0], /VITE_WEB_APP_URL/);
  }
});
