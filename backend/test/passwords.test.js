const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, all, request, signedInUser, random } = require('../test-helpers/testApp');

beforeEach(reset);

const as = (user) => ({
    create: (body) => request().post('/api/passwords').set('auth-token', user.token).send(body),
    list: () => request().get('/api/passwords').set('auth-token', user.token),
    update: (id, body) => request().put(`/api/passwords/${id}`).set('auth-token', user.token).send(body),
    remove: (id) => request().delete(`/api/passwords/${id}`).set('auth-token', user.token),
    removeAll: (currentAuthKey) => request().delete('/api/passwords').set('auth-token', user.token).send({ currentAuthKey })
});

describe('every vault route needs a token', () => {
    for (const [method, path] of [['get', '/api/passwords'], ['post', '/api/passwords'], ['put', '/api/passwords/abc'], ['delete', '/api/passwords/abc'], ['delete', '/api/passwords']]) {
        test(`${method.toUpperCase()} ${path}`, async () => {
            const res = await request()[method](path).send({});
            assert.equal(res.status, 401);
        });
    }
});

describe('create', () => {
    test('stores the password encrypted and returns the plain one without internal fields', async () => {
        const user = await signedInUser();
        const res = await as(user).create({ url: 'github.com', username: 'octo', password: 'my-secret-1', title: 'GitHub', notes: 'n', isFavorite: true });
        assert.equal(res.status, 201);
        assert.equal(res.body.password, 'my-secret-1');
        assert.equal(res.body.title, 'GitHub');
        assert.equal(res.body.isFavorite, true);
        assert.equal(res.body.iv, undefined);
        assert.equal(res.body.user, undefined);

        const [stored] = await all('passwords');
        assert.notEqual(stored.password, 'my-secret-1');
        assert.ok(!JSON.stringify(stored).includes('my-secret-1'), 'the plain password is nowhere in the stored record');
        assert.match(stored.iv, /^[0-9a-f]{32}$/);
        assert.equal(String(stored.user), String(user.id));
    });

    test('needs a password, and rejects fields that are not text or are too long', async () => {
        const user = await signedInUser();
        const bad = [
            {}, { password: '' }, { password: 'x'.repeat(1025) }, { password: { $gt: '' } }, { password: 'ok', title: { a: 1 } },
            { password: 'ok', url: 'x'.repeat(2049) }, { password: 'ok', notes: 'x'.repeat(10001) }, { password: 'ok', isFavorite: 'maybe' }
        ];
        for (const body of bad) {
            const res = await as(user).create(body);
            assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
        }
        assert.equal((await all('passwords')).length, 0);
    });

    test('accepts the largest allowed values', async () => {
        const user = await signedInUser();
        const res = await as(user).create({ password: 'p'.repeat(1024), title: 't'.repeat(2048), notes: 'n'.repeat(10000) });
        assert.equal(res.status, 201);
    });
});

describe('list', () => {
    test('returns only your logins, decrypted, newest first, without internal fields', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        await as(me).create({ password: 'first-secret', title: 'first' });
        await new Promise((resolve) => setTimeout(resolve, 5)); // distinct creation times
        await as(me).create({ password: 'second-secret', title: 'second' });
        await as(other).create({ password: 'not-mine', title: 'theirs' });

        const res = await as(me).list();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.map((item) => [item.title, item.password]), [['second', 'second-secret'], ['first', 'first-secret']]);
        for (const item of res.body) {
            assert.equal(item.iv, undefined);
            assert.equal(item.user, undefined);
        }
    });

    test('is empty for a new account', async () => {
        const res = await as(await signedInUser()).list();
        assert.deepEqual(res.body, []);
    });
});

describe('update', () => {
    test('changes the given fields and re-encrypts a new password', async () => {
        const user = await signedInUser();
        const { body: created } = await as(user).create({ password: 'old-secret', title: 'before', username: 'u' });
        const before = (await all('passwords'))[0];
        const oldCipher = before.password;
        const oldIv = before.iv;

        const res = await as(user).update(created._id, { title: 'after', password: 'new-secret', isFavorite: true });
        assert.equal(res.status, 200);
        assert.equal(res.body.title, 'after');
        assert.equal(res.body.username, 'u', 'fields that were not sent are kept');
        assert.equal(res.body.password, 'new-secret');
        assert.equal(res.body.isFavorite, true);
        const stored = (await all('passwords'))[0];
        assert.notEqual(stored.password, oldCipher);
        assert.notEqual(stored.iv, oldIv);
        assert.ok(!JSON.stringify(stored).includes('new-secret'));
    });

    test('keeps the stored password when none is sent', async () => {
        const user = await signedInUser();
        const { body: created } = await as(user).create({ password: 'keep-me', title: 'x' });
        const res = await as(user).update(created._id, { title: 'y' });
        assert.equal(res.body.password, 'keep-me');
    });

    test('cannot change someone else\'s login', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        const { body: theirs } = await as(other).create({ password: 'theirs', title: 'theirs' });
        const res = await as(me).update(theirs._id, { title: 'hacked' });
        assert.equal(res.status, 403);
        assert.equal((await all('passwords'))[0].title, 'theirs');
    });

    test('says 404 for a login that does not exist and 400 for a bad id', async () => {
        const user = await signedInUser();
        assert.equal((await as(user).update('64b64b64b64b64b64b64b64b', { title: 'x' })).status, 404);
        assert.equal((await as(user).update('not-an-id', { title: 'x' })).status, 400);
    });

    test('applies the same field checks as create', async () => {
        const user = await signedInUser();
        const { body: created } = await as(user).create({ password: 'secret', title: 'x' });
        assert.equal((await as(user).update(created._id, { title: { a: 1 } })).status, 400);
        assert.equal((await as(user).update(created._id, { password: 'x'.repeat(1025) })).status, 400);
    });
});

describe('delete one', () => {
    test('deletes your login', async () => {
        const user = await signedInUser();
        const { body: created } = await as(user).create({ password: 'secret', title: 'x' });
        const res = await as(user).remove(created._id);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.deletedPass.password, undefined, 'the response does not echo the password');
        assert.equal((await all('passwords')).length, 0);
    });

    test('cannot delete someone else\'s login', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        const { body: theirs } = await as(other).create({ password: 'theirs', title: 'theirs' });
        assert.equal((await as(me).remove(theirs._id)).status, 403);
        assert.equal((await all('passwords')).length, 1);
    });

    test('says 404 for a login that does not exist and 400 for a bad id', async () => {
        const user = await signedInUser();
        assert.equal((await as(user).remove('64b64b64b64b64b64b64b64b')).status, 404);
        assert.equal((await as(user).remove('nope')).status, 400);
    });
});

describe('delete all', () => {
    test('needs the current master password', async () => {
        const user = await signedInUser();
        await as(user).create({ password: 'secret', title: 'x' });
        const missing = await as(user).removeAll(undefined);
        assert.equal(missing.status, 400);
        assert.equal(missing.body.error, 'Enter your current master password');
        const wrong = await as(user).removeAll(random(32));
        assert.equal(wrong.status, 403);
        assert.equal((await all('passwords')).length, 1, 'nothing was deleted');
    });

    test('deletes all of your logins and only yours', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        await as(me).create({ password: 'a', title: '1' });
        await as(me).create({ password: 'b', title: '2' });
        await as(other).create({ password: 'c', title: '3' });
        const res = await as(me).removeAll(me.authKey);
        assert.equal(res.status, 200);
        assert.equal(res.body.deletedCount, 2);
        assert.equal((await all('passwords')).length, 1);
        assert.equal((await as(other).list()).body.length, 1);
    });
});
