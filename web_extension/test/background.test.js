import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// The real service worker, bundled with the two build-time addresses filled in, run against a fake `chrome`.
const EXT = 'chrome-extension://ext-id/';
const popup = { id: 'ext-id', url: `${EXT}popup.html` };                                   // an extension page, no tab
const pageAt = (url, extra = {}) => ({ id: 'ext-id', tab: { id: 7 }, frameId: 0, url, ...extra }); // the page script
const github = pageAt('https://github.com/login');
const otherExtension = { id: 'someone-else', tab: { id: 7 }, frameId: 0, url: 'https://github.com/login' };

const VAULT = [
  { _id: 'gh', title: 'GitHub', url: 'https://github.com', username: 'octo', password: 'gh-secret' },
  { _id: 'gh2', url: 'github.com', username: 'work', password: 'gh2-secret' },
  { _id: 'bank', title: 'Bank', url: 'bank.example', username: 'me', password: 'bank-secret' },
  { _id: 'nourl', url: '', username: 'x', password: 'nourl-secret' }
];

let listener;

const area = (data) => ({
  get: async (key) => (key in data ? { [key]: data[key] } : {}),
  set: async (values) => Object.assign(data, values),
  remove: async (key) => { delete data[key]; }
});

before(async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/background.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', logLevel: 'silent',
    define: { 'import.meta.env.VITE_BACKEND': '"http://api.test"', 'import.meta.env.VITE_WEB_APP_URL': '"http://app.test"' }
  });

  globalThis.chrome = {
    runtime: { id: 'ext-id', getURL: (path = '') => `${EXT}${path}`, onMessage: { addListener: (fn) => { listener = fn; } } },
    storage: { local: area((globalThis.localData = {})), session: area((globalThis.sessionData = {})) },
    alarms: { get: async () => ({}), create() {}, onAlarm: { addListener() {} } }
  };
  const code = bundle.outputFiles[0].text;
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
});

beforeEach(() => {
  for (const key of Object.keys(globalThis.localData)) delete globalThis.localData[key];
  Object.assign(globalThis.localData, { session: { token: 't', expiresAt: Date.now() + 1e6, email: 'me@x.com' } });
  Object.assign(globalThis.sessionData, { vault: { items: VAULT, syncedAt: Date.now() } });
});

const ask = (message, sender) => new Promise((resolve) => listener(message, sender, resolve));

test('the page is told which logins are saved for it, with no passwords', async () => {
  const reply = await ask({ type: 'logins' }, github);
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.logins, [
    { id: 'gh', title: 'GitHub', username: 'octo' },
    { id: 'gh2', title: 'github.com', username: 'work' }
  ]);
  assert.ok(!JSON.stringify(reply).includes('secret'));
});

test('a page with no saved login gets an empty list', async () => {
  assert.deepEqual((await ask({ type: 'logins' }, pageAt('https://news.example/'))).logins, []);
});

test('one chosen login is handed over, and only that one', async () => {
  assert.deepEqual(await ask({ type: 'credentials', id: 'gh' }, github), { ok: true, username: 'octo', password: 'gh-secret' });
});

test('the address comes from the browser, not from anything the page says', async () => {
  const evil = pageAt('https://evil.example/');
  assert.deepEqual((await ask({ type: 'logins', url: 'https://github.com/login' }, evil)).logins, []);
  const reply = await ask({ type: 'credentials', id: 'gh', url: 'https://github.com/login', host: 'github.com' }, evil);
  assert.equal(reply.ok, false);
  assert.ok(!JSON.stringify(reply).includes('secret'));
});

test('a login for another site is refused even when its id is known', async () => {
  const reply = await ask({ type: 'credentials', id: 'bank' }, github);
  assert.equal(reply.ok, false);
  assert.ok(!JSON.stringify(reply).includes('secret'));
});

test('a subdomain of the saved site gets nothing', async () => {
  const sub = pageAt('https://evil.github.com/login');
  assert.deepEqual((await ask({ type: 'logins' }, sub)).logins, []);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, sub)).ok, false);
});

test('plain http gets nothing, except on this computer', async () => {
  const http = pageAt('http://github.com/login');
  assert.deepEqual((await ask({ type: 'logins' }, http)).logins, []);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, http)).ok, false);
  globalThis.sessionData.vault.items = [{ _id: 'dev', url: 'localhost', username: 'u', password: 'p' }];
  assert.equal((await ask({ type: 'credentials', id: 'dev' }, pageAt('http://localhost:5173/login'))).ok, true);
});

test('an unknown login, or one with no address, is never handed over', async () => {
  assert.equal((await ask({ type: 'credentials', id: 'nope' }, github)).ok, false);
  assert.equal((await ask({ type: 'credentials', id: 'nourl' }, github)).ok, false);
});

test('a frame inside the page cannot ask', async () => {
  const frame = pageAt('https://github.com/login', { frameId: 3 });
  assert.equal((await ask({ type: 'logins' }, frame)).ok, false);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, frame)).ok, false);
});

test('another extension cannot ask', async () => {
  assert.equal((await ask({ type: 'logins' }, otherExtension)).ok, false);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, otherExtension)).ok, false);
});

test('the popup is not a page: it gets the vault, not the page requests', async () => {
  assert.equal((await ask({ type: 'logins' }, popup)).ok, false);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, popup)).ok, false);
  assert.equal((await ask({ type: 'vault' }, popup)).ok, true);
});

test('a web page cannot ask for the vault, the session, a sync or a sign-in', async () => {
  for (const message of [{ type: 'vault' }, { type: 'sync' }, { type: 'session' }, { type: 'logout' },
    { type: 'login', email: 'a@b.c', password: 'x' }]) {
    const reply = await ask(message, github);
    assert.equal(reply.ok, false, message.type);
    assert.ok(!JSON.stringify(reply).includes('secret'), message.type);
  }
});

test('the old requests are gone', async () => {
  for (const type of ['matches', 'fill']) {
    const reply = await ask({ type, id: 'gh', tabId: 7 }, github);
    assert.equal(reply.ok, false, type);
    assert.equal(reply.entries, undefined);
  }
});

test('signed out: the page is told to sign in, and gets nothing else', async () => {
  delete globalThis.localData.session;
  const reply = await ask({ type: 'logins' }, github);
  assert.equal(reply.ok, false);
  assert.equal(reply.code, 'auth');
});
