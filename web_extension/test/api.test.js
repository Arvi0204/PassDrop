import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApi, ApiError } from '../src/api.js';

// A fake server that answers the way backend/routes does. The proofs and the wrapped key are opaque strings here:
// the real cryptography is tested in background.test.js.
const jwt = (exp) =>
  `x.${Buffer.from(JSON.stringify({ user: { id: '1' }, exp })).toString('base64url')}.y`;
const FUTURE = Math.floor(Date.now() / 1000) + 7 * 86400;
const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'c2FsdA==' };
const WRAPPED = 'v1.aXY=.Y3Q=';

let server;
let api;
const seen = [];

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.push({ method: req.method, url: req.url, token: req.headers['auth-token'], body: raw && JSON.parse(raw) });
      const send = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(typeof body === 'string' ? body : JSON.stringify(body));
      };
      const body = raw ? JSON.parse(raw) : {};

      if (req.url.startsWith('/api/auth/prelogin')) {
        return new URL(req.url, 'http://x').searchParams.get('email') === 'none'
          ? send(200, { success: true })
          : send(200, { success: true, kdf: KDF });
      }
      if (req.url === '/api/auth/login') {
        if (body.authKey === 'wrong') {
          return send(400, { success: false, errors: [{ msg: 'Please login with valid credentials' }] });
        }
        if (body.authKey === 'old-server') return send(200, { success: true, authToken: jwt(FUTURE), userId: 'u1', wrappedVaultKey: WRAPPED });
        if (body.authKey === 'broken') return send(200, { success: true });
        if (body.authKey === 'no-key') return send(200, { success: true, authToken: jwt(FUTURE), userId: 'u1' });
        return send(200, { success: true, authToken: jwt(FUTURE), expiresAt: FUTURE * 1000, userId: 'u1', kdf: KDF, wrappedVaultKey: WRAPPED });
      }
      if (req.url === '/api/auth/me') {
        return req.headers['auth-token'] === 'good'
          ? send(200, { username: 'u', email: 'u@x.com' })
          : send(401, { success: false, error: 'Please authenticate using a valid token' });
      }
      if (req.url === '/api/passwords') {
        if (req.headers['auth-token'] === 'good') return send(200, [{ _id: '1', url: 'a.com', username: 'u', password: 'p' }]);
        if (req.headers['auth-token'] === 'shape') return send(200, { not: 'an array' });
        if (req.headers['auth-token'] === 'boom') return send(500, { success: false, error: 'Internal Server Error' });
        if (req.headers['auth-token'] === 'html') return send(502, '<html>bad gateway</html>');
        // the pre-tidy-up 401 had no success flag
        return send(401, { error: 'Please authenticate using a valid token' });
      }
      send(404, { error: 'not found' });
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  api = createApi(`http://localhost:${server.address().port}`);
});

after(() => server.close());

test('prelogin asks for the key settings of an email', async () => {
  assert.deepEqual(await api.prelogin('a+b@x.com'), KDF);
  assert.equal(seen.at(-1).url, '/api/auth/prelogin?email=a%2Bb%40x.com');
  await assert.rejects(api.prelogin('none'), (e) => e.kind === 'server');
});

test('login sends only the derived proof, and returns the token, expiry, user id and wrapped key', async () => {
  const result = await api.login('a@x.com', 'right');
  assert.equal(result.expiresAt, FUTURE * 1000);
  assert.ok(result.token);
  assert.equal(result.userId, 'u1');
  assert.equal(result.wrappedVaultKey, WRAPPED);
  assert.deepEqual(seen.at(-1).body, { email: 'a@x.com', authKey: 'right' });
});

test('login falls back to the expiry inside the token for older servers', async () => {
  const result = await api.login('a@x.com', 'old-server');
  assert.equal(result.expiresAt, FUTURE * 1000);
});

test('wrong credentials surface the server message from errors[]', async () => {
  await assert.rejects(api.login('a@x.com', 'wrong'), (e) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.kind, 'server');
    assert.equal(e.message, 'Please login with valid credentials');
    return true;
  });
});

test('a success reply with no token, or no wrapped vault key, is rejected', async () => {
  await assert.rejects(api.login('a@x.com', 'broken'), (e) => e.kind === 'server');
  await assert.rejects(api.login('a@x.com', 'no-key'), (e) => e.kind === 'server');
});

test('vault is fetched with the auth-token header and returned as an array', async () => {
  const vault = await api.getVault('good');
  assert.equal(vault.length, 1);
  assert.equal(seen.at(-1).token, 'good');
  assert.equal(seen.at(-1).url, '/api/passwords');
});

test('401 is reported as an auth failure, with or without a success flag', async () => {
  await assert.rejects(api.getVault('bad'), (e) => e.kind === 'auth' && e.status === 401);
  await assert.rejects(api.getMe('bad'), (e) => e.kind === 'auth');
});

test('server errors and non-JSON replies become readable errors', async () => {
  await assert.rejects(api.getVault('boom'), (e) => e.kind === 'server' && e.message === 'Internal Server Error');
  await assert.rejects(api.getVault('html'), (e) => e.kind === 'server' && /502/.test(e.message));
});

test('a vault that is not an array is rejected', async () => {
  await assert.rejects(api.getVault('shape'), (e) => e.kind === 'server');
});

test('an unreachable server is a network error', async () => {
  const dead = createApi('http://localhost:1');
  await assert.rejects(dead.getVault('good'), (e) => e.kind === 'network');
});
