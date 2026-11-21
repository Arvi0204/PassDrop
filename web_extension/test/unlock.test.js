import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

// The unlock screen, bundled and run in jsdom with a fake service worker behind chrome.runtime.sendMessage.
let bundle;

before(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/popup/unlock.js', import.meta.url))],
    bundle: true, write: false, format: 'iife', globalName: 'unlock', logLevel: 'silent',
    loader: { '.svg': 'dataurl' }, define: { 'import.meta.env.VITE_WEB_APP_URL': '"http://app.test"' }
  });
  bundle = result.outputFiles[0].text;
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

/** Renders the screen; `replies` answers the messages in order. Returns what the screen did. */
function render(replies) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { runScripts: 'outside-only' });
  const { window } = dom;
  const sent = [];
  const did = [];
  window.chrome = { runtime: { sendMessage: async (message) => { sent.push(message); return replies.shift(); } } };
  window.eval(bundle);
  const screen = window.unlock.renderUnlock({
    session: { email: 'me@x.com' },
    onUnlocked: () => did.push('unlocked'),
    onSignedOut: () => did.push('signed out'),
    onExpired: () => did.push('expired')
  });
  window.document.getElementById('app').append(screen);
  const submit = (password) => {
    window.document.getElementById('password').value = password;
    window.document.querySelector('form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    return tick();
  };
  return { document: window.document, sent, did, submit };
}

test('it asks for the master password only, and says the passwords are encrypted', () => {
  const { document } = render([]);
  assert.deepEqual([...document.querySelectorAll('input')].map((i) => i.id), ['password']);
  assert.match(document.body.textContent, /Your passwords are encrypted. Enter your master password to unlock them\./);
  assert.match(document.body.textContent, /me@x\.com/);
});

test('the right password unlocks', async () => {
  const screen = render([{ ok: true }]);
  await screen.submit('hunter2');
  assert.equal(JSON.stringify(screen.sent), JSON.stringify([{ type: 'unlock', password: 'hunter2' }]));
  assert.equal(JSON.stringify(screen.did), JSON.stringify(['unlocked']));
});

test('a wrong password shows the message and stays on the screen', async () => {
  const screen = render([{ ok: false, code: 'auth', error: 'That is not your master password.' }, { ok: true, session: { email: 'me@x.com' }, locked: true }]);
  await screen.submit('nope');
  assert.match(screen.document.querySelector('[role=alert]').textContent, /That is not your master password\./);
  assert.equal(JSON.stringify(screen.did), JSON.stringify([]));
});

test('an empty password is not sent', async () => {
  const screen = render([]);
  await screen.submit('');
  assert.equal(JSON.stringify(screen.sent), JSON.stringify([]));
  assert.match(screen.document.querySelector('[role=alert]').textContent, /Enter your master password/);
});

test('when the sign-in itself has ended, it says so instead of a wrong password', async () => {
  const screen = render([{ ok: false, code: 'auth', error: 'Your session has ended.' }, { ok: true, session: null, locked: false }]);
  await screen.submit('hunter2');
  assert.equal(JSON.stringify(screen.did), JSON.stringify(['expired']));
});

test('sign out is offered', async () => {
  const screen = render([{ ok: true }]);
  [...screen.document.querySelectorAll('button')].find((b) => b.textContent === 'Sign out').click();
  await tick();
  assert.equal(JSON.stringify(screen.sent), JSON.stringify([{ type: 'logout' }]));
  assert.equal(JSON.stringify(screen.did), JSON.stringify(['signed out']));
});
