const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('../test-helpers/testApp');

describe('the server', () => {
    test('answers on the root address', async () => {
        const res = await request().get('/');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { message: 'PassDrop API is running' });
    });

    test('does not say which framework it runs on', async () => {
        const res = await request().get('/');
        assert.equal(res.headers['x-powered-by'], undefined);
    });

    test('a malformed JSON body gets a plain 400 with no stack trace or internals', async () => {
        const res = await request().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
        assert.equal(res.status, 400);
        assert.deepEqual(res.body, { success: false, error: 'Bad request' });
    });

    test('an oversized body is refused with a 413 and the same plain answer', async () => {
        const res = await request().post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(200_000) });
        assert.equal(res.status, 413); // "payload too large"
        assert.deepEqual(res.body, { success: false, error: 'Bad request' });
    });
});

describe('the server holds no vault key', () => {
    // (a developer's backend/.env may still define ENCRYPTION_KEY from before; what matters is that nothing reads it)
    test('no code reads ENCRYPTION_KEY and the server-side encryption module is gone', () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const sources = [];
        const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
            if (e.name === 'node_modules' || e.name === 'test' || e.name === 'bruno') return;
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) sources.push(p);
        });
        walk(path.join(__dirname, '..'));
        for (const file of sources) assert.ok(!/ENCRYPTION_KEY/.test(fs.readFileSync(file, 'utf8')), `${file} still mentions ENCRYPTION_KEY`);
        assert.equal(fs.existsSync(path.join(__dirname, '..', 'utils', 'encryption.js')), false);
    });
});
