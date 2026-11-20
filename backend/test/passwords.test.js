const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, all, request, signedInUser, blob, random } = require('../test-helpers/testApp');

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
    test('stores exactly the blob, the owner and the times, and no readable field', async () => {
        const user = await signedInUser();
        const b = blob();
        const res = await as(user).create({ blob: b });
        assert.equal(res.status, 201);
        assert.equal(res.body.blob, b);
        assert.equal(res.body.user, undefined);
        assert.ok(res.body._id);

        const [stored] = await all('passwords');
        assert.deepEqual(Object.keys(stored).sort(), ['_id', 'blob', 'createdAt', 'updatedAt', 'user']);
        assert.equal(String(stored.user), String(user.id));
    });

    test('ignores any other field the client sends, so a plaintext field never gets stored', async () => {
        const user = await signedInUser();
        await as(user).create({ blob: blob(), password: 'my-secret-1', title: 'GitHub', url: 'github.com' });
        const text = JSON.stringify((await all('passwords'))[0]);
        assert.ok(!text.includes('my-secret-1') && !text.includes('GitHub') && !text.includes('github.com'));
    });

    test('rejects a missing blob, a non-string, a string not in v1 format, and one over 32768 characters', async () => {
        const user = await signedInUser();
        const bad = [{}, { blob: '' }, { blob: { $gt: '' } }, { blob: 42 }, { blob: 'plain text' }, { blob: 'v2.AAAA.AAAA' }, { blob: `v1.${random(12)}.${'A'.repeat(32800)}` }];
        for (const body of bad) {
            assert.equal((await as(user).create(body)).status, 400, JSON.stringify(body).slice(0, 60));
        }
        assert.equal((await all('passwords')).length, 0);
    });

    test('accepts the largest allowed blob', async () => {
        const user = await signedInUser();
        const iv = random(12);
        const max = `v1.${iv}.${'A'.repeat(32768 - 4 - iv.length)}`;
        assert.equal(max.length, 32768);
        assert.equal((await as(user).create({ blob: max })).status, 201);
    });
});

describe('list', () => {
    test('returns only your blobs, newest first, without the owner id', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        const [first, second] = [blob(), blob()];
        await as(me).create({ blob: first });
        await new Promise((resolve) => setTimeout(resolve, 5)); // distinct creation times
        await as(me).create({ blob: second });
        await as(other).create({ blob: blob() });

        const res = await as(me).list();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.map((item) => item.blob), [second, first]);
        for (const item of res.body) assert.equal(item.user, undefined);
    });

    test('is empty for a new account', async () => {
        const res = await as(await signedInUser()).list();
        assert.deepEqual(res.body, []);
    });
});

describe('update', () => {
    test('replaces the blob and the update time', async () => {
        const user = await signedInUser();
        const { body: created } = await as(user).create({ blob: blob() });
        const next = blob();
        const res = await as(user).update(created._id, { blob: next });
        assert.equal(res.status, 200);
        assert.equal(res.body.blob, next);
        assert.equal(res.body._id, created._id);
        assert.equal((await all('passwords')).length, 1);
        assert.equal((await all('passwords'))[0].blob, next);
    });

    test('cannot change someone else\'s login', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        const theirs = blob();
        const { body: created } = await as(other).create({ blob: theirs });
        const res = await as(me).update(created._id, { blob: blob() });
        assert.equal(res.status, 403);
        assert.equal((await all('passwords'))[0].blob, theirs);
    });

    test('says 404 for a login that does not exist, 400 for a bad id, and 400 for a bad blob', async () => {
        const user = await signedInUser();
        assert.equal((await as(user).update('64b64b64b64b64b64b64b64b', { blob: blob() })).status, 404);
        assert.equal((await as(user).update('not-an-id', { blob: blob() })).status, 400);
        const { body: created } = await as(user).create({ blob: blob() });
        assert.equal((await as(user).update(created._id, { blob: 'plain' })).status, 400);
    });
});

describe('delete one', () => {
    test('deletes your login', async () => {
        const user = await signedInUser();
        const { body: created } = await as(user).create({ blob: blob() });
        const res = await as(user).remove(created._id);
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.deletedPass._id, created._id);
        assert.equal((await all('passwords')).length, 0);
    });

    test('cannot delete someone else\'s login', async () => {
        const me = await signedInUser({ email: 'me@example.com' });
        const other = await signedInUser({ email: 'other@example.com' });
        const { body: theirs } = await as(other).create({ blob: blob() });
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
    test('needs the current proof', async () => {
        const user = await signedInUser();
        await as(user).create({ blob: blob() });
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
        await as(me).create({ blob: blob() });
        await as(me).create({ blob: blob() });
        await as(other).create({ blob: blob() });
        const res = await as(me).removeAll(me.authKey);
        assert.equal(res.status, 200);
        assert.equal(res.body.deletedCount, 2);
        assert.equal((await all('passwords')).length, 1);
        assert.equal((await as(other).list()).body.length, 1);
    });
});
