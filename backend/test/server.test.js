const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('../test-helpers/testApp');
const { encrypt, decrypt } = require('../utils/encryption');

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

describe('encryption of stored passwords', () => {
    test('round-trips text, including unicode', () => {
        for (const text of ['secret', 'pässwörd-日本語-🔑', 'x'.repeat(1024), ' spaces ']) {
            assert.equal(decrypt(encrypt(text)), text);
        }
    });

    test('uses a fresh random IV each time, so the same password never looks the same twice', () => {
        const a = encrypt('same');
        const b = encrypt('same');
        assert.notEqual(a.iv, b.iv);
        assert.notEqual(a.encryptedData, b.encryptedData);
    });

    test('does not decrypt with the wrong IV or damaged data into the original', () => {
        const { iv, encryptedData } = encrypt('secret');
        const other = encrypt('other').iv;
        let result;
        try { result = decrypt({ iv: other, encryptedData }); } catch { result = null; }
        assert.notEqual(result, 'secret');
        assert.throws(() => decrypt({ iv, encryptedData: 'zz' }));
    });
});
