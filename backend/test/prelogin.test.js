const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, request, seedUser } = require('../test-helpers/testApp');
const { isKdf } = require('../utils/vaultFields');

beforeEach(reset);

const prelogin = (email) => request().get('/api/auth/prelogin').query({ email });

describe('prelogin', () => {
    test('returns the account\'s key settings for a known email', async () => {
        const user = await seedUser({ email: 'known@example.com' });
        const res = await prelogin('Known@Example.com');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.deepEqual(res.body.kdf, user.kdf);
    });

    test('answers an unknown email with a same-shaped, stable fake that differs per email', async () => {
        const a1 = await prelogin('nobody@example.com');
        const a2 = await prelogin('NOBODY@example.com ');
        const b = await prelogin('someone-else@example.com');
        assert.equal(a1.status, 200);
        assert.ok(isKdf(a1.body.kdf), 'it looks exactly like a real account\'s settings');
        assert.deepEqual(a1.body.kdf, a2.body.kdf, 'asking twice gives the same answer, as for a real account');
        assert.notEqual(a1.body.kdf.salt, b.body.kdf.salt);
        const real = await seedUser({ email: 'real@example.com' });
        assert.deepEqual(Object.keys((await prelogin(real.email)).body).sort(), Object.keys(a1.body).sort());
    });

    test('says 400 for a missing or malformed email', async () => {
        assert.equal((await request().get('/api/auth/prelogin')).status, 400);
        assert.equal((await prelogin('not-an-email')).status, 400);
    });
});
