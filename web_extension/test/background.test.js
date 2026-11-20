import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  newKdf, deriveKeys, newVaultKey, exportVaultKey, wrapVaultKey, encryptItem
} from '../../frontend/src/lib/vaultCrypto.js';

// The real service worker, bundled with the build-time addresses filled in, run against a fake `chrome` and a
// fake server. The cryptography is real: the blobs below are made with the same module the web app uses, with a
// 1000-iteration kdf (the worker's minimum is lowered to match by a build-time define) so the tests are fast.
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

const USER = 'u1';
const PASSWORD = 'correct horse battery staple';

let listener;
let kdf, authKey, wrappedVaultKey, vaultKeyB64, vaultKey;
const server = {}; // what the fake server answers: { kdf, blobs, gate }
const calls = []; // every request the worker made: { method, pathname, body, token }

const area = (data) => ({
  get: async (key) => (key in data ? { [key]: data[key] } : {}),
  set: async (values) => Object.assign(data, values),
  remove: async (keys) => { for (const key of [].concat(keys)) delete data[key]; }
});

const blobFor = async (item, _id, user = USER) => ({ _id, blob: await encryptItem(vaultKey, item, user), createdAt: 'c', updatedAt: 'u' });

// answers like backend/routes/auth.js and passwords.js
const fakeFetch = async (url, init = {}) => {
  const { pathname } = new URL(url);
  const body = init.body ? JSON.parse(init.body) : {};
  const token = init.headers?.['auth-token'];
  calls.push({ method: init.method || 'GET', pathname, body, token });
  const reply = (status, json) => ({ status, ok: status < 400, json: async () => json });
  if (pathname === '/api/auth/prelogin') return reply(200, { success: true, kdf: server.kdf });
  if (pathname === '/api/auth/login') {
    return body.authKey === authKey
      ? reply(200, { success: true, authToken: 'tok', expiresAt: Date.now() + 1e6, userId: USER, kdf: server.kdf, wrappedVaultKey })
      : reply(400, { success: false, errors: [{ msg: 'Please login with valid credentials' }] });
  }
  if (token !== 'tok') return reply(401, { success: false, error: 'Please authenticate using a valid token' });
  if (pathname === '/api/auth/me') return reply(200, { _id: USER, email: 'me@x.com', kdf: server.kdf, wrappedVaultKey });
  if (pathname === '/api/passwords') {
    await server.gate;
    return reply(200, server.blobs);
  }
  return reply(404, { success: false, error: 'not found' });
};

before(async () => {
  const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/background.js', import.meta.url))],
    bundle: true, write: false, format: 'esm', logLevel: 'silent',
    define: {
      'import.meta.env.VITE_BACKEND': '"http://api.test"',
      'import.meta.env.VITE_WEB_APP_URL': '"http://app.test"',
      'import.meta.env.TEST_KDF_MIN_ITERATIONS': '"1000"'
    }
  });

  kdf = newKdf(1000);
  const keys = await deriveKeys(PASSWORD, kdf);
  authKey = keys.authKey;
  vaultKey = await newVaultKey();
  vaultKeyB64 = await exportVaultKey(vaultKey);
  wrappedVaultKey = await wrapVaultKey(vaultKey, keys.wrapKey);
  globalThis.fetch = fakeFetch;

  globalThis.chrome = {
    runtime: { id: 'ext-id', getURL: (path = '') => `${EXT}${path}`, onMessage: { addListener: (fn) => { listener = fn; } } },
    storage: { local: area((globalThis.localData = {})), session: area((globalThis.sessionData = {})) },
    alarms: { get: async () => ({}), create() {}, onAlarm: { addListener() {} } }
  };
  const code = bundle.outputFiles[0].text;
  await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
});

// signed in and unlocked, with the vault already cached
beforeEach(() => {
  for (const data of [globalThis.localData, globalThis.sessionData]) for (const key of Object.keys(data)) delete data[key];
  Object.assign(globalThis.localData, { session: { token: 'tok', expiresAt: Date.now() + 1e6, email: 'me@x.com', userId: USER } });
  Object.assign(globalThis.sessionData, { vaultKey: vaultKeyB64, vault: { items: VAULT, syncedAt: Date.now() } });
  Object.assign(server, { kdf, blobs: [], gate: null });
  calls.length = 0;
});

const ask = (message, sender) => new Promise((resolve) => listener(message, sender, resolve));

const stored = () => JSON.stringify([globalThis.localData, globalThis.sessionData]);
const nothingStored = () => assert.deepEqual([globalThis.localData, globalThis.sessionData], [{}, {}]);
const signedOut = () => { for (const data of [globalThis.localData, globalThis.sessionData]) for (const key of Object.keys(data)) delete data[key]; };
const lock = () => { delete globalThis.sessionData.vaultKey; };

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

test('a different port gets nothing', async () => {
  const other = pageAt('https://github.com:8443/login');
  assert.deepEqual((await ask({ type: 'logins' }, other)).logins, []);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, other)).ok, false);
  // the default port written out is still the same site
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, pageAt('https://github.com:443/login'))).ok, true);
});

test('plain http gets nothing, except on this computer', async () => {
  const http = pageAt('http://github.com/login');
  assert.deepEqual((await ask({ type: 'logins' }, http)).logins, []);
  assert.equal((await ask({ type: 'credentials', id: 'gh' }, http)).ok, false);
  globalThis.sessionData.vault.items = [{ _id: 'dev', url: 'localhost:5173', username: 'u', password: 'p' }];
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

test('a web page cannot ask for the vault, the session, a sync, a sign-in or an unlock', async () => {
  for (const message of [{ type: 'vault' }, { type: 'sync' }, { type: 'session' }, { type: 'logout' },
    { type: 'login', email: 'a@b.c', password: 'x' }, { type: 'unlock', password: 'x' }]) {
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

// ---------------------------------------------------------------- sign in, lock and unlock

test('login derives the keys in the worker: the token goes to storage.local, the vault key to storage.session', async () => {
  signedOut();
  const reply = await ask({ type: 'login', email: '  Me@X.com ', password: PASSWORD }, popup);
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.session, { email: 'me@x.com', expiresAt: globalThis.localData.session.expiresAt });
  assert.equal(globalThis.localData.session.token, 'tok');
  assert.equal(globalThis.localData.session.userId, USER);
  assert.equal(globalThis.sessionData.vaultKey, vaultKeyB64);
  assert.equal(globalThis.sessionData.vault, undefined);
  assert.deepEqual(calls.map((c) => c.pathname), ['/api/auth/prelogin', '/api/auth/login']);
  assert.deepEqual(calls[1].body, { email: 'me@x.com', authKey });
});

test('a sign-in replaces what an earlier account left behind', async () => {
  const reply = await ask({ type: 'login', email: 'me@x.com', password: PASSWORD }, popup);
  assert.equal(reply.ok, true);
  assert.equal(globalThis.sessionData.vault, undefined);
});

test('the master password never leaves the worker or reaches storage', async () => {
  signedOut();
  await ask({ type: 'login', email: 'me@x.com', password: PASSWORD }, popup);
  await ask({ type: 'sync' }, popup);
  assert.ok(!JSON.stringify(calls).includes(PASSWORD));
  assert.ok(!stored().includes(PASSWORD));
});

test('a wrong password signs nothing in and stores nothing', async () => {
  signedOut();
  const reply = await ask({ type: 'login', email: 'me@x.com', password: 'not it' }, popup);
  assert.equal(reply.ok, false);
  assert.equal(reply.error, 'Please login with valid credentials');
  nothingStored();
});

test('key settings with too few iterations are refused before any proof is sent', async () => {
  signedOut();
  server.kdf = { ...kdf, iterations: 999 };
  const reply = await ask({ type: 'login', email: 'me@x.com', password: PASSWORD }, popup);
  assert.equal(reply.ok, false);
  assert.deepEqual(calls.map((c) => c.pathname), ['/api/auth/prelogin']);
  nothingStored();
});

test('sync decrypts the blobs and caches plaintext; one corrupt or foreign blob is skipped', async () => {
  server.blobs = [
    await blobFor(VAULT[0], 'gh'),
    { _id: 'junk', blob: 'v1.AAAA.AAAA' },
    await blobFor(VAULT[3], 'other-user', 'someone-else'), // sealed for another account: refused by its additional data
    await blobFor(VAULT[2], 'bank')
  ];
  delete globalThis.sessionData.vault;
  const reply = await ask({ type: 'sync' }, popup);
  assert.equal(reply.ok, true);
  assert.deepEqual(reply.vault.map((e) => [e._id, e.password]), [['gh', 'gh-secret'], ['bank', 'bank-secret']]);
  assert.deepEqual(globalThis.sessionData.vault.items, reply.vault); // the cache the page lookups read
  assert.ok(!JSON.stringify(reply).includes('v1.'));
  assert.equal(calls.at(-1).token, 'tok');
  // and the page lookups work from it
  assert.deepEqual(await ask({ type: 'credentials', id: 'gh' }, github), { ok: true, username: 'octo', password: 'gh-secret' });
});

test('with no cache yet, the first vault request fetches and decrypts', async () => {
  server.blobs = [await blobFor(VAULT[0], 'gh')];
  delete globalThis.sessionData.vault;
  assert.deepEqual((await ask({ type: 'logins' }, github)).logins, [{ id: 'gh', title: 'GitHub', username: 'octo' }]);
});

test('vault, sync, logins and credentials answer "locked" when signed in without a vault key', async () => {
  lock();
  for (const [message, sender] of [[{ type: 'vault' }, popup], [{ type: 'sync' }, popup], [{ type: 'logins' }, github], [{ type: 'credentials', id: 'gh' }, github]]) {
    const reply = await ask(message, sender);
    assert.equal(reply.ok, false, message.type);
    assert.equal(reply.code, 'locked', message.type);
    assert.ok(!JSON.stringify(reply).includes('secret'), message.type); // the cached copy is not served either
  }
  assert.ok(!calls.some((c) => c.pathname === '/api/passwords'));
  assert.ok(globalThis.localData.session); // still signed in
});

test('the session message says whether the vault is locked', async () => {
  const expiresAt = globalThis.localData.session.expiresAt;
  assert.deepEqual(await ask({ type: 'session' }, popup), { ok: true, session: { email: 'me@x.com', expiresAt }, locked: false });
  lock();
  assert.deepEqual(await ask({ type: 'session' }, popup), { ok: true, session: { email: 'me@x.com', expiresAt }, locked: true });
  signedOut();
  assert.deepEqual(await ask({ type: 'session' }, popup), { ok: true, session: null, locked: false });
});

test('unlock with the right password stores the vault key again', async () => {
  lock();
  server.blobs = [await blobFor(VAULT[0], 'gh')];
  assert.deepEqual(await ask({ type: 'unlock', password: PASSWORD }, popup), { ok: true });
  assert.equal(globalThis.sessionData.vaultKey, vaultKeyB64);
  assert.equal(calls[0].token, 'tok');
  assert.ok(!JSON.stringify(calls).includes(PASSWORD));
  assert.ok(!stored().includes(PASSWORD));
  assert.equal((await ask({ type: 'sync' }, popup)).vault[0].password, 'gh-secret');
});

test('unlock with a wrong password answers "auth" and stores nothing', async () => {
  lock();
  const session = JSON.stringify(globalThis.localData.session);
  const reply = await ask({ type: 'unlock', password: 'not it' }, popup);
  assert.deepEqual(reply, { ok: false, code: 'auth', error: 'That is not your master password.' });
  assert.equal(globalThis.sessionData.vaultKey, undefined);
  assert.equal(JSON.stringify(globalThis.localData.session), session); // a typo does not sign you out
  assert.ok(!stored().includes('not it'));
});

test('unlock when the server no longer accepts the token ends the sign-in', async () => {
  lock();
  globalThis.localData.session.token = 'dead';
  assert.equal((await ask({ type: 'unlock', password: PASSWORD }, popup)).code, 'auth');
  nothingStored();
  assert.equal((await ask({ type: 'unlock', password: PASSWORD }, popup)).code, 'auth'); // and with no sign-in at all
});

test('unlock refuses key settings with too few iterations', async () => {
  lock();
  server.kdf = { ...kdf, iterations: 999 };
  assert.equal((await ask({ type: 'unlock', password: PASSWORD }, popup)).ok, false);
  assert.equal(globalThis.sessionData.vaultKey, undefined);
});

test('logout clears the token, the vault key and the cached vault', async () => {
  assert.deepEqual(await ask({ type: 'logout' }, popup), { ok: true });
  nothingStored();
});

test('a 401 clears the token, the vault key and the cached vault', async () => {
  globalThis.localData.session.token = 'dead';
  assert.equal((await ask({ type: 'sync' }, popup)).code, 'auth');
  nothingStored();
});

test('a sync that finishes after a sign-out leaves no decrypted copy behind', async () => {
  let release;
  server.gate = new Promise((resolve) => { release = resolve; });
  server.blobs = [await blobFor(VAULT[0], 'gh')];
  delete globalThis.sessionData.vault;
  const pending = ask({ type: 'sync' }, popup);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await ask({ type: 'logout' }, popup);
  release();
  assert.equal((await pending).ok, false);
  nothingStored();
});
