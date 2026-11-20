const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, all, request, seedUser, signedInUser, random, sealed } = require('../test-helpers/testApp');
const { LOCKED_MESSAGE } = require('../utils/passwordGuard');

beforeEach(reset);

const messages = (body) => (body.errors || []).map((e) => e.msg);
const unlock = (body) => request().post('/api/auth/recovery/unlock').send(body);
const reset_ = (body) => request().post('/api/auth/recovery/reset').send(body);

describe('recovery unlock', () => {
    test('returns the settings and the recovery-wrapped vault key for a right proof', async () => {
        const user = await seedUser();
        const res = await unlock({ email: 'USER@example.com', recoveryAuthKey: user.recoveryAuthKey });
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.kdf, user.kdf);
        assert.equal(res.body.recoveryWrappedKey, user.recoveryWrappedKey);
    });

    test('a wrong proof and an unknown email get the identical answer', async () => {
        const user = await seedUser();
        const wrong = await unlock({ email: user.email, recoveryAuthKey: random(32) });
        const unknown = await unlock({ email: 'nobody@example.com', recoveryAuthKey: random(32) });
        assert.equal(wrong.status, 400);
        assert.deepEqual(wrong.body, unknown.body);
        assert.deepEqual(messages(wrong.body), ['Check the email and recovery key.']);
        // the sign-in proof is not a recovery proof
        assert.equal((await unlock({ email: user.email, recoveryAuthKey: user.authKey })).status, 400);
    });

    test('ten wrong proofs lock the account (429), sharing the sign-in counter', async () => {
        const user = await seedUser();
        for (let i = 0; i < 10; i++) assert.equal((await unlock({ email: user.email, recoveryAuthKey: random(32) })).status, 400);
        const locked = await unlock({ email: user.email, recoveryAuthKey: user.recoveryAuthKey });
        assert.equal(locked.status, 429);
        assert.deepEqual(messages(locked.body), [LOCKED_MESSAGE]);
        const signIn = await request().post('/api/auth/login').send({ email: user.email, authKey: user.authKey });
        assert.equal(signIn.status, 429);
    });

    test('needs a valid email and a proof of the right shape', async () => {
        assert.equal((await unlock({ email: 'nope', recoveryAuthKey: random(32) })).status, 400);
        assert.equal((await unlock({ email: 'a@b.co', recoveryAuthKey: 'short' })).status, 400);
    });
});

describe('recovery reset', () => {
    const fresh = (user, overrides = {}) => ({
        email: user.email, recoveryAuthKey: user.recoveryAuthKey, newAuthKey: random(32), newKdf: { ...user.kdf }, newWrappedVaultKey: sealed(), ...overrides
    });

    test('with a right proof replaces the sign-in proof and wrapped key, signs out other sessions, and returns the sign-in payload', async () => {
        const user = await seedUser();
        const old = (await request().post('/api/auth/login').send({ email: user.email, authKey: user.authKey })).body.authToken;
        const body = fresh(user);
        const res = await reset_(body);
        assert.equal(res.status, 200);
        assert.ok(res.body.authToken);
        assert.equal(res.body.userId, String(user.id));
        assert.equal(res.body.wrappedVaultKey, body.newWrappedVaultKey);
        assert.deepEqual(res.body.kdf, user.kdf);

        assert.equal((await request().get('/api/auth/me').set('auth-token', old)).status, 401);
        assert.equal((await request().get('/api/auth/me').set('auth-token', res.body.authToken)).status, 200);
        assert.equal((await request().post('/api/auth/login').send({ email: user.email, authKey: user.authKey })).status, 400, 'the old proof');
        assert.equal((await request().post('/api/auth/login').send({ email: user.email, authKey: body.newAuthKey })).status, 200);
        // the recovery key still works afterwards, because the salt it is derived with did not change
        assert.equal((await unlock({ email: user.email, recoveryAuthKey: user.recoveryAuthKey })).status, 200);
        assert.equal((await all('users'))[0].recoveryWrappedKey, user.recoveryWrappedKey);
    });

    test('with a wrong proof changes nothing', async () => {
        const user = await seedUser();
        const before = (await all('users'))[0];
        const res = await reset_(fresh(user, { recoveryAuthKey: random(32) }));
        assert.equal(res.status, 400);
        const after = (await all('users'))[0];
        assert.equal(after.authHash, before.authHash);
        assert.equal(after.wrappedVaultKey, before.wrappedVaultKey);
        assert.equal(after.tokenVersion, before.tokenVersion);
    });

    test('refuses malformed new values and a different salt', async () => {
        const user = await seedUser();
        for (const overrides of [{ newAuthKey: 'x' }, { newWrappedVaultKey: 'x' }, { newKdf: { ...user.kdf, iterations: 1 } }, { newKdf: { ...user.kdf, salt: random(16) } }]) {
            assert.equal((await reset_(fresh(user, overrides))).status, 400, JSON.stringify(overrides).slice(0, 60));
        }
    });
});

describe('replacing the recovery key', () => {
    const rotate = (user, body) => request().post('/api/auth/recovery/rotate').set('auth-token', user.token).send(body);
    const fresh = (user, overrides = {}) => ({ currentAuthKey: user.authKey, recoveryAuthKey: random(32), recoveryWrappedKey: sealed(), ...overrides });

    test('needs the token and the master password proof', async () => {
        const user = await signedInUser();
        assert.equal((await request().post('/api/auth/recovery/rotate').send(fresh(user))).status, 401);
        assert.equal((await rotate(user, fresh(user, { currentAuthKey: undefined }))).status, 400);
        assert.equal((await rotate(user, fresh(user, { currentAuthKey: random(32) }))).status, 403);
        assert.equal((await all('users'))[0].recoveryAuthHash.length > 0, true);
        // nothing changed: the original recovery key still works
        assert.equal((await unlock({ email: user.email, recoveryAuthKey: user.recoveryAuthKey })).status, 200);
    });

    test('rejects malformed new values and changes nothing', async () => {
        const user = await signedInUser();
        const before = (await all('users'))[0];
        for (const overrides of [{ recoveryAuthKey: 'short' }, { recoveryAuthKey: undefined }, { recoveryWrappedKey: 'plain' }, { recoveryWrappedKey: undefined }]) {
            assert.equal((await rotate(user, fresh(user, overrides))).status, 400, JSON.stringify(overrides).slice(0, 60));
        }
        const after = (await all('users'))[0];
        assert.equal(after.recoveryAuthHash, before.recoveryAuthHash);
        assert.equal(after.recoveryWrappedKey, before.recoveryWrappedKey);
    });

    test('the new recovery key works and the old one stops working, while sign-in and the session are untouched', async () => {
        const user = await signedInUser();
        const body = fresh(user);
        const res = await rotate(user, body);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);

        const old = await unlock({ email: user.email, recoveryAuthKey: user.recoveryAuthKey });
        assert.equal(old.status, 400, 'the old recovery key');
        const next = await unlock({ email: user.email, recoveryAuthKey: body.recoveryAuthKey });
        assert.equal(next.status, 200);
        assert.equal(next.body.recoveryWrappedKey, body.recoveryWrappedKey);

        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 200, 'the session is still valid');
        assert.equal((await request().post('/api/auth/login').send({ email: user.email, authKey: user.authKey })).status, 200, 'sign-in is unchanged');
        const text = JSON.stringify((await all('users'))[0]);
        assert.ok(!text.includes(body.recoveryAuthKey), 'only a hash of the new proof is stored');
    });

    test('wrong master password proofs count toward the lockout', async () => {
        const user = await signedInUser();
        for (let i = 0; i < 10; i++) assert.equal((await rotate(user, fresh(user, { currentAuthKey: random(32) }))).status, 403);
        assert.equal((await rotate(user, fresh(user))).status, 429);
    });
});
