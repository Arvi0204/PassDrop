const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, all, collection, request, seedUser, login, signedInUser, registrationBody, random, sealed } = require('../test-helpers/testApp');
const { LOCKED_MESSAGE } = require('../utils/passwordGuard');

beforeEach(reset);

const messages = (body) => (body.errors || []).map((e) => e.msg);
const register = (body) => request().post('/api/auth/register').send(body);

describe('register', () => {
    test('stores a hash of the proof (not the proof), the key settings, the wrapped vault key, and no password', async () => {
        const body = registrationBody({ email: 'Ada@Example.com' });
        const res = await register(body);
        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.authToken);
        assert.ok(res.body.expiresAt > Date.now());
        assert.ok(res.body.userId);

        const [stored] = await all('users');
        assert.equal(stored.email, 'ada@example.com'); // stored in lower case
        assert.equal(stored.v, 2);
        assert.match(stored.authHash, /^\$2[aby]\$12\$/); // bcrypt at cost 12
        assert.equal(stored.password, undefined, 'there is no password field at all');
        assert.deepEqual(stored.kdf, body.kdf);
        assert.equal(stored.wrappedVaultKey, body.wrappedVaultKey);
        const text = JSON.stringify(stored);
        assert.ok(!text.includes(body.authKey), 'the proof itself is not stored');
    });

    test('rejects weak or malformed input and stores nothing', async () => {
        const good = registrationBody();
        const bad = [
            { kdf: { ...good.kdf, iterations: 599999 } },
            { kdf: { ...good.kdf, iterations: 10000001 } },
            { kdf: { ...good.kdf, salt: random(15) } },
            { kdf: { ...good.kdf, name: 'MD5' } },
            { kdf: 'nope' },
            { authKey: random(32).slice(0, -1) }, // 43 characters
            { authKey: random(33) },
            { authKey: 'not base64 !!' },
            { wrappedVaultKey: undefined },
            { wrappedVaultKey: 'plain text' },
            { wrappedVaultKey: 'v1.AAAA.' + 'A'.repeat(600) },
            { username: 'ab' },
            { email: 'nope' }
        ];
        for (const override of bad) {
            const res = await register({ ...good, ...override });
            assert.equal(res.status, 400, JSON.stringify(override).slice(0, 80));
        }
        assert.equal((await all('users')).length, 0);
    });

    test('two sign-ups on one email at the same moment give one account', async () => {
        const [a, b] = await Promise.all([
            register(registrationBody({ email: 'race@example.com', username: 'first' })),
            register(registrationBody({ email: 'race@example.com', username: 'second' }))
        ]);
        assert.deepEqual([a.status, b.status].sort(), [201, 400]);
        assert.equal((await all('users')).length, 1);
    });

    test('ignores spaces around the email and the username, and checks the username length without them', async () => {
        const res = await register(registrationBody({ username: '  Ada  ', email: '  Ada@Example.com  ' }));
        assert.equal(res.status, 201);
        const [stored] = await all('users');
        assert.equal(stored.email, 'ada@example.com');
        assert.equal(stored.username, 'Ada');

        const tooShort = await register(registrationBody({ username: '  ab ', email: 'other@example.com' }));
        assert.equal(tooShort.status, 400, 'two letters and some spaces is still two letters');
    });

    test('refuses a second account on the same email, whatever its case', async () => {
        await seedUser({ email: 'dup@example.com' });
        const res = await register(registrationBody({ email: 'DUP@example.com' }));
        assert.equal(res.status, 400);
        assert.deepEqual(messages(res.body), ['Sorry, another account exists with this email!']);
        assert.equal((await all('users')).length, 1);
    });
});

describe('login', () => {
    const signIn = (body) => request().post('/api/auth/login').send(body);

    test('signs in with the right proof, whatever the email case, and returns what the browser needs to unlock', async () => {
        const user = await seedUser();
        const res = await signIn({ email: 'USER@example.com', authKey: user.authKey });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.authToken);
        assert.equal(res.body.userId, String(user.id));
        assert.deepEqual(res.body.kdf, user.kdf);
        assert.equal(res.body.wrappedVaultKey, user.wrappedVaultKey);
    });

    test('a wrong proof and an unknown email get the same answer, so emails cannot be probed', async () => {
        const user = await seedUser();
        const wrong = await signIn({ email: user.email, authKey: random(32) });
        const unknown = await signIn({ email: 'nobody@example.com', authKey: random(32) });
        assert.equal(wrong.status, 400);
        assert.equal(unknown.status, 400);
        assert.deepEqual(wrong.body, unknown.body);
        assert.deepEqual(messages(wrong.body), ['Please login with valid credentials']);
    });

    test('ignores spaces around the email', async () => {
        const user = await seedUser();
        const res = await signIn({ email: '  user@example.com ', authKey: user.authKey });
        assert.equal(res.status, 200);
    });

    test('needs a valid email and a proof', async () => {
        const res = await signIn({ email: 'nope' });
        assert.equal(res.status, 400);
        assert.equal(res.body.errors.length, 2);
    });
});

describe('lockout', () => {
    const attempt = (user, authKey) => request().post('/api/auth/login').send({ email: user.email, authKey });

    test('ten wrong proofs lock the account, even for the right one', async () => {
        const user = await seedUser();
        for (let i = 0; i < 10; i++) assert.equal((await attempt(user, random(32))).status, 400);
        const locked = await attempt(user, user.authKey);
        assert.equal(locked.status, 429);
        assert.deepEqual(messages(locked.body), [LOCKED_MESSAGE]);
    });

    test('nine wrong proofs do not lock, and a right one resets the count', async () => {
        const user = await seedUser();
        for (let i = 0; i < 9; i++) await attempt(user, random(32));
        assert.equal((await attempt(user, user.authKey)).status, 200);
        for (let i = 0; i < 9; i++) await attempt(user, random(32)); // nine more would lock only if the count had not reset
        assert.equal((await attempt(user, user.authKey)).status, 200);
    });

    test('the lock ends after 15 minutes', async () => {
        const user = await seedUser();
        for (let i = 0; i < 10; i++) await attempt(user, random(32));
        const [stored] = await all('users');
        const minutes = (stored.lockUntil.getTime() - Date.now()) / 60000;
        assert.ok(minutes > 14 && minutes <= 15, `locked for ${minutes} minutes`);

        await (await collection('users')).updateOne({ _id: stored._id }, { $set: { lockUntil: new Date(Date.now() - 1000) } }); // time passes
        assert.equal((await attempt(user, user.authKey)).status, 200);
        assert.equal((await all('users'))[0].lockUntil, undefined);
    });

    test('wrong proofs on a re-authentication count toward the same lock', async () => {
        const user = await signedInUser();
        for (let i = 0; i < 10; i++) {
            const res = await request().delete('/api/passwords').set('auth-token', user.token).send({ currentAuthKey: random(32) });
            assert.equal(res.status, 403);
        }
        const locked = await request().delete('/api/passwords').set('auth-token', user.token).send({ currentAuthKey: user.authKey });
        assert.equal(locked.status, 429);
        assert.equal((await attempt(user, user.authKey)).status, 429); // sign-in is locked too
    });
});

describe('the signed-in user', () => {
    test('GET /me needs a token', async () => {
        assert.equal((await request().get('/api/auth/me')).status, 401);
        assert.equal((await request().get('/api/auth/me').set('auth-token', 'not-a-token')).status, 401);
    });

    test('GET /me returns exactly the fields a browser needs to unlock, and nothing secret', async () => {
        const user = await signedInUser({ email: 'me@example.com', username: 'Me' });
        const res = await request().get('/api/auth/me').set('auth-token', user.token);
        assert.equal(res.status, 200);
        assert.deepEqual(Object.keys(res.body).sort(), ['_id', 'createdAt', 'email', 'kdf', 'lastLogin', 'username', 'wrappedVaultKey']);
        assert.equal(res.body.email, 'me@example.com');
        assert.deepEqual(res.body.kdf, user.kdf);
        assert.equal(res.body.wrappedVaultKey, user.wrappedVaultKey);
    });

    test('a token for a deleted account stops working', async () => {
        const user = await signedInUser();
        await reset();
        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 401);
    });
});

describe('change master password', () => {
    const change = (user, body) => request().post('/api/auth/change-password').set('auth-token', user.token).send(body);
    const fresh = (user, overrides = {}) => ({
        currentAuthKey: user.authKey, newAuthKey: random(32), newKdf: { ...user.kdf }, newWrappedVaultKey: sealed(), ...overrides
    });

    test('needs the token', async () => {
        const user = await seedUser();
        const res = await request().post('/api/auth/change-password').send(fresh(user));
        assert.equal(res.status, 401);
    });

    test('needs the current proof, and refuses a wrong one without changing anything', async () => {
        const user = await signedInUser();
        const missing = await change(user, fresh(user, { currentAuthKey: undefined }));
        assert.equal(missing.status, 400);
        assert.equal(missing.body.error, 'Enter your current master password');
        const wrong = await change(user, fresh(user, { currentAuthKey: random(32) }));
        assert.equal(wrong.status, 403);
        assert.equal(wrong.body.error, 'Current master password is incorrect');
        assert.ok(await login(user), 'the old proof still works');
    });

    test('validates the new fields and refuses a new proof equal to the old one', async () => {
        const user = await signedInUser();
        for (const overrides of [
            { newAuthKey: 'short' }, { newKdf: { ...user.kdf, iterations: 1000 } }, { newWrappedVaultKey: 'nope' }, { newKdf: undefined }
        ]) {
            assert.equal((await change(user, fresh(user, overrides))).status, 400, JSON.stringify(overrides).slice(0, 60));
        }
        const same = await change(user, fresh(user, { newAuthKey: user.authKey }));
        assert.equal(same.status, 400);
        assert.match(same.body.error, /must be different/);
    });

    test('refuses new settings with a different salt', async () => {
        const user = await signedInUser();
        const res = await change(user, fresh(user, { newKdf: { ...user.kdf, salt: random(16) } }));
        assert.equal(res.status, 400);
        assert.equal((await all('users'))[0].authHash.length > 0, true);
        assert.deepEqual((await all('users'))[0].kdf, user.kdf);
    });

    test('swaps the proof, settings and wrapped key, signs out every other session, keeps this one', async () => {
        const user = await signedInUser();
        const otherSession = await login(user); // a second device, or a stolen token
        const body = fresh(user, { newKdf: { ...user.kdf, iterations: 700000 } });
        const res = await change(user, body);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.authToken);
        assert.equal(res.body.wrappedVaultKey, body.newWrappedVaultKey);
        assert.equal(res.body.kdf.iterations, 700000);

        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 401, 'the old token');
        assert.equal((await request().get('/api/auth/me').set('auth-token', otherSession)).status, 401, 'the other session');
        assert.equal((await request().get('/api/auth/me').set('auth-token', res.body.authToken)).status, 200, 'the new token');

        assert.equal((await request().post('/api/auth/login').send({ email: user.email, authKey: user.authKey })).status, 400, 'the old proof');
        const newLogin = await request().post('/api/auth/login').send({ email: user.email, authKey: body.newAuthKey });
        assert.equal(newLogin.status, 200);
        assert.equal(newLogin.body.wrappedVaultKey, body.newWrappedVaultKey);
    });
});

describe('delete account', () => {
    test('needs the token and the current proof', async () => {
        const user = await signedInUser();
        assert.equal((await request().delete('/api/auth/me').send({ currentAuthKey: user.authKey })).status, 401);
        assert.equal((await request().delete('/api/auth/me').set('auth-token', user.token).send({})).status, 400);
        const wrong = await request().delete('/api/auth/me').set('auth-token', user.token).send({ currentAuthKey: random(32) });
        assert.equal(wrong.status, 403);
        assert.equal((await all('users')).length, 1, 'the account is still there');
    });

    test('deletes the account and all its logins, and nobody else', async () => {
        const user = await signedInUser({ email: 'a@example.com' });
        const other = await signedInUser({ email: 'b@example.com' });
        for (const who of [user, user, other]) {
            await request().post('/api/passwords').set('auth-token', who.token).send({ password: 'secret', title: 't' });
        }
        assert.equal((await all('passwords')).length, 3);

        const res = await request().delete('/api/auth/me').set('auth-token', user.token).send({ currentAuthKey: user.authKey });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal((await all('users')).length, 1);
        assert.equal((await all('passwords')).length, 1);
        assert.equal(String((await all('passwords'))[0].user), String(other.id));
        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 401);
        assert.equal((await request().get('/api/auth/me').set('auth-token', other.token)).status, 200);
    });
});
