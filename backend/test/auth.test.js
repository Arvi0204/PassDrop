const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, all, collection, request, seedUser, login, signedInUser } = require('../test-helpers/testApp');
const { LOCKED_MESSAGE } = require('../utils/passwordGuard');

beforeEach(reset);

const messages = (body) => (body.errors || []).map((e) => e.msg);

describe('register', () => {
    test('creates an account, stores only a hash of the password, and returns a token', async () => {
        const res = await request().post('/api/auth/register').send({ username: 'Ada', email: 'Ada@Example.com', password: 'a-long-password' });
        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.ok(res.body.authToken);
        assert.ok(res.body.expiresAt > Date.now());

        const [stored] = await all('users');
        assert.equal(stored.email, 'ada@example.com'); // stored in lower case
        assert.notEqual(stored.password, 'a-long-password');
        assert.match(stored.password, /^\$2[aby]\$12\$/); // bcrypt at cost 12
    });

    test('ignores spaces around the email and the username, and checks the username length without them', async () => {
        const res = await request().post('/api/auth/register').send({ username: '  Ada  ', email: '  Ada@Example.com  ', password: 'a-long-password' });
        assert.equal(res.status, 201);
        const [stored] = await all('users');
        assert.equal(stored.email, 'ada@example.com');
        assert.equal(stored.username, 'Ada');

        const tooShort = await request().post('/api/auth/register').send({ username: '  ab ', email: 'other@example.com', password: 'a-long-password' });
        assert.equal(tooShort.status, 400, 'two letters and some spaces is still two letters');
    });

    test('rejects a short username, a bad email and a short password', async () => {
        const res = await request().post('/api/auth/register').send({ username: 'ab', email: 'nope', password: 'short' });
        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.equal(res.body.errors.length, 3);
        assert.equal((await all('users')).length, 0);
    });

    test('refuses a second account on the same email, whatever its case', async () => {
        await seedUser({ email: 'dup@example.com' });
        const res = await request().post('/api/auth/register').send({ username: 'other', email: 'DUP@example.com', password: 'a-long-password' });
        assert.equal(res.status, 400);
        assert.deepEqual(messages(res.body), ['Sorry, another account exists with this email!']);
        assert.equal((await all('users')).length, 1);
    });
});

describe('login', () => {
    test('signs in with the right password, whatever the email case', async () => {
        const user = await seedUser();
        const res = await request().post('/api/auth/login').send({ email: 'USER@example.com', password: user.password });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.authToken);
    });

    test('a wrong password and an unknown email get the same answer, so emails cannot be probed', async () => {
        const user = await seedUser();
        const wrong = await request().post('/api/auth/login').send({ email: user.email, password: 'not-the-password' });
        const unknown = await request().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever-it-is' });
        assert.equal(wrong.status, 400);
        assert.equal(unknown.status, 400);
        assert.deepEqual(wrong.body, unknown.body);
        assert.deepEqual(messages(wrong.body), ['Please login with valid credentials']);
    });

    test('ignores spaces around the email, but never around the password', async () => {
        const user = await seedUser({ password: ' spaced password ' });
        const padded = await request().post('/api/auth/login').send({ email: '  user@example.com ', password: ' spaced password ' });
        assert.equal(padded.status, 200, 'the email may have spaces');
        const trimmed = await request().post('/api/auth/login').send({ email: user.email, password: 'spaced password' });
        assert.equal(trimmed.status, 400, 'the password is exactly what was typed, spaces included');
    });

    test('needs a valid email and a password', async () => {
        const res = await request().post('/api/auth/login').send({ email: 'nope' });
        assert.equal(res.status, 400);
        assert.equal(res.body.errors.length, 2);
    });
});

describe('lockout', () => {
    const attempt = (user, password) => request().post('/api/auth/login').send({ email: user.email, password });

    test('ten wrong passwords lock the account, even for the right password', async () => {
        const user = await seedUser();
        for (let i = 0; i < 10; i++) assert.equal((await attempt(user, 'wrong-password')).status, 400);
        const locked = await attempt(user, user.password);
        assert.equal(locked.status, 429);
        assert.deepEqual(messages(locked.body), [LOCKED_MESSAGE]);
    });

    test('nine wrong passwords do not lock, and a right one resets the count', async () => {
        const user = await seedUser();
        for (let i = 0; i < 9; i++) await attempt(user, 'wrong-password');
        assert.equal((await attempt(user, user.password)).status, 200);
        for (let i = 0; i < 9; i++) await attempt(user, 'wrong-password'); // nine more would lock only if the count had not reset
        assert.equal((await attempt(user, user.password)).status, 200);
    });

    test('the lock ends after 15 minutes', async () => {
        const user = await seedUser();
        for (let i = 0; i < 10; i++) await attempt(user, 'wrong-password');
        const [stored] = await all('users');
        const minutes = (stored.lockUntil.getTime() - Date.now()) / 60000;
        assert.ok(minutes > 14 && minutes <= 15, `locked for ${minutes} minutes`);

        await (await collection('users')).updateOne({ _id: stored._id }, { $set: { lockUntil: new Date(Date.now() - 1000) } }); // time passes
        assert.equal((await attempt(user, user.password)).status, 200);
        assert.equal((await all('users'))[0].lockUntil, undefined);
    });

    test('wrong master passwords on a re-authentication count toward the same lock', async () => {
        const user = await signedInUser();
        for (let i = 0; i < 10; i++) {
            const res = await request().delete('/api/passwords').set('auth-token', user.token).send({ currentPassword: 'wrong-password' });
            assert.equal(res.status, 403);
        }
        const locked = await request().delete('/api/passwords').set('auth-token', user.token).send({ currentPassword: user.password });
        assert.equal(locked.status, 429);
        assert.equal((await attempt(user, user.password)).status, 429); // sign-in is locked too
    });
});

describe('the signed-in user', () => {
    test('GET /me needs a token', async () => {
        assert.equal((await request().get('/api/auth/me')).status, 401);
        assert.equal((await request().get('/api/auth/me').set('auth-token', 'not-a-token')).status, 401);
    });

    test('GET /me returns the user and never the password hash', async () => {
        const user = await signedInUser({ email: 'me@example.com', username: 'Me' });
        const res = await request().get('/api/auth/me').set('auth-token', user.token);
        assert.equal(res.status, 200);
        assert.equal(res.body.email, 'me@example.com');
        assert.equal(res.body.username, 'Me');
        assert.equal(res.body.password, undefined);
    });

    test('a token for a deleted account stops working', async () => {
        const user = await signedInUser();
        await reset();
        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 401);
    });
});

describe('change master password', () => {
    const change = (user, body) => request().post('/api/auth/change-password').set('auth-token', user.token).send(body);

    test('needs the token', async () => {
        const res = await request().post('/api/auth/change-password').send({ currentPassword: 'x', newPassword: 'a-new-password' });
        assert.equal(res.status, 401);
    });

    test('needs the current master password', async () => {
        const user = await signedInUser();
        const res = await change(user, { newPassword: 'a-new-password' });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, 'Enter your current master password');
    });

    test('refuses a wrong current password, without changing anything', async () => {
        const user = await signedInUser();
        const res = await change(user, { currentPassword: 'wrong-password', newPassword: 'a-new-password' });
        assert.equal(res.status, 403);
        assert.equal(res.body.error, 'Current master password is incorrect');
        assert.equal((await login({ email: user.email, password: user.password })) !== undefined, true); // the old password still works
    });

    test('refuses a short new password and a new password equal to the old one', async () => {
        const user = await signedInUser();
        const short = await change(user, { currentPassword: user.password, newPassword: 'short' });
        assert.equal(short.status, 400);
        assert.deepEqual(messages(short.body), ['Password must be at least 8 characters']);
        const same = await change(user, { currentPassword: user.password, newPassword: user.password });
        assert.equal(same.status, 400);
        assert.match(same.body.error, /must be different/);
    });

    test('changes the password, signs out every other session, and keeps this one signed in', async () => {
        const user = await signedInUser();
        const otherSession = await login(user); // a second device, or a stolen token
        const res = await change(user, { currentPassword: user.password, newPassword: 'a-brand-new-password' });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.authToken);

        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 401, 'the old token');
        assert.equal((await request().get('/api/auth/me').set('auth-token', otherSession)).status, 401, 'the other session');
        assert.equal((await request().get('/api/auth/me').set('auth-token', res.body.authToken)).status, 200, 'the new token');

        const oldLogin = await request().post('/api/auth/login').send({ email: user.email, password: user.password });
        assert.equal(oldLogin.status, 400);
        const newLogin = await request().post('/api/auth/login').send({ email: user.email, password: 'a-brand-new-password' });
        assert.equal(newLogin.status, 200);
    });
});

describe('delete account', () => {
    test('needs the token and the current master password', async () => {
        const user = await signedInUser();
        assert.equal((await request().delete('/api/auth/me').send({ currentPassword: user.password })).status, 401);
        assert.equal((await request().delete('/api/auth/me').set('auth-token', user.token).send({})).status, 400);
        const wrong = await request().delete('/api/auth/me').set('auth-token', user.token).send({ currentPassword: 'wrong-password' });
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

        const res = await request().delete('/api/auth/me').set('auth-token', user.token).send({ currentPassword: user.password });
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal((await all('users')).length, 1);
        assert.equal((await all('passwords')).length, 1);
        assert.equal(String((await all('passwords'))[0].user), String(other.id));
        assert.equal((await request().get('/api/auth/me').set('auth-token', user.token)).status, 401);
        assert.equal((await request().get('/api/auth/me').set('auth-token', other.token)).status, 200);
    });
});
