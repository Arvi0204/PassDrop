import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// The signed-in popup, bundled and run in jsdom with a fake service worker behind chrome.runtime.sendMessage.
let bundle;

before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/popup/vault.js', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: 'popup', logLevel: 'silent',
    loader: { '.svg': 'dataurl' }, define: { 'import.meta.env.VITE_BACKEND': '"http://api.test"', 'import.meta.env.VITE_WEB_APP_URL': '"http://app.test"' }
  });
  bundle = result.outputFiles[0].text;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function render() {
  const { window } = new JSDOM('<!doctype html><div id="app"></div>', { runScripts: 'outside-only' });
  const sent = [];
  const did = [];
  window.chrome = {
    runtime: { sendMessage: async (message) => { sent.push(message.type); return message.type === 'lock' || message.type === 'logout' ? { ok: true } : { ok: true, vault: [], syncedAt: Date.now() }; } },
    tabs: { query: async () => [] }
  };
  window.eval(bundle);
  const screen = window.popup.renderVault({
    session: { email: 'me@x.com' },
    onSignedOut: () => did.push('signed out'),
    onExpired: () => did.push('expired'),
    onLocked: () => did.push('locked')
  });
  window.document.getElementById('app').append(screen);
  const item = (name) => [...window.document.querySelectorAll('[role=menuitem]')].find((button) => button.textContent.trim() === name);
  return { window, sent, did, item };
}

test('the account menu offers Lock as well as Sign out', async () => {
  const { window, item } = render();
  await tick();
  assert.ok(item('Lock'), 'a Lock item');
  assert.ok(item('Sign out'), 'a Sign out item');
  window.close();
});

test('Lock asks the worker to lock, then goes to the unlock screen and does not sign out', async () => {
  const { window, sent, did, item } = render();
  await tick();
  item('Lock').click();
  await tick();
  assert.ok(sent.includes('lock'));
  assert.ok(!sent.includes('logout'));
  assert.deepEqual(did, ['locked']);
  window.close();
});

test('Sign out still signs out', async () => {
  const { window, sent, did, item } = render();
  await tick();
  item('Sign out').click();
  await tick();
  assert.ok(sent.includes('logout'));
  assert.deepEqual(did, ['signed out']);
  window.close();
});
