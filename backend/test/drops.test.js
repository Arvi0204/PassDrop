const { test, beforeEach, describe } = require('node:test');
const assert = require('node:assert/strict');
const { reset, all, collection, request, signedInUser, blob } = require('../test-helpers/testApp');

beforeEach(reset);

// a link is made from one of the sender's logins: one is stored for the user the first time it is needed
const loginOf = async (user) => {
    user.login ??= (await request().post('/api/passwords').set('auth-token', user.token).send({ blob: blob() })).body._id;
    return user.login;
};
const as = (user) => ({
    create: async (body) => request().post('/api/drops').set('auth-token', user.token).send({ ...body, login: 'login' in body ? body.login : await loginOf(user) }),
    list: () => request().get('/api/drops').set('auth-token', user.token),
    history: () => request().get('/api/drops/history').set('auth-token', user.token),
    revoke: (id) => request().delete(`/api/drops/${id}`).set('auth-token', user.token),
    deleteLogin: (id) => request().delete(`/api/passwords/${id}`).set('auth-token', user.token),
    deleteAllLogins: () => request().delete('/api/passwords').set('auth-token', user.token).send({ currentAuthKey: user.authKey })
});
const open = (id) => request().post(`/api/drops/${id}/open`);
const views = (n = 1) => ({ blob: blob(), label: blob(), mode: 'views', views: n });
const timer = (ttl = 3600) => ({ blob: blob(), label: blob(), mode: 'timer', ttl });
const expire = async (id) => (await collection('drops')).updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

describe('the owner routes need a token', () => {
    for (const [method, path] of [['post', '/api/drops'], ['get', '/api/drops'], ['delete', '/api/drops/abcdefghijklmnopqrstuv']]) {
        test(`${method.toUpperCase()} ${path}`, async () => {
            const res = await request()[method](path).send({});
            assert.equal(res.status, 401);
        });
    }
});

describe('create', () => {
    test('a views drop stores the two blobs, the owner and the rule, and returns an unguessable id', async () => {
        const user = await signedInUser();
        const body = views(3);
        const res = await as(user).create(body);
        assert.equal(res.status, 201);
        assert.match(res.body.id, /^[A-Za-z0-9_-]{22}$/);
        assert.equal(res.body.viewsLeft, 3);

        const [stored] = await all('drops');
        assert.deepEqual(Object.keys(stored).sort(), ['_id', 'blob', 'createdAt', 'expiresAt', 'label', 'login', 'mode', 'owner', 'viewsLeft']);
        assert.equal(stored.blob, body.blob);
        assert.equal(String(stored.owner), String(user.id));
        assert.equal(String(stored.login), user.login); // which login it was made from: an opaque id, nothing readable
        // a views drop nobody opens still ends: after the 7-day backstop
        const days = (stored.expiresAt - stored.createdAt) / 86400000;
        assert.ok(Math.abs(days - 7) < 0.01);
    });

    test('a timer drop ends after the chosen time and has no view count', async () => {
        const user = await signedInUser();
        const res = await as(user).create(timer(600));
        assert.equal(res.status, 201);
        const [stored] = await all('drops');
        assert.equal(stored.viewsLeft, undefined);
        assert.ok(Math.abs((stored.expiresAt - stored.createdAt) / 1000 - 600) < 1);
    });

    test('refuses a rule that is not one view count or one of the timers', async () => {
        const user = await signedInUser();
        const bad = [
            { ...views(), views: 0 }, { ...views(), views: 11 }, { ...views(), views: 1.5 }, { ...views(), views: '2' },
            { ...timer(), ttl: 123 }, { ...timer(), ttl: undefined }, { ...views(), mode: 'both' }, { ...views(), mode: undefined }
        ];
        for (const body of bad) assert.equal((await as(user).create(body)).status, 400, JSON.stringify(body));
        assert.equal((await all('drops')).length, 0);
    });

    test('refuses a blob or label that is not an encrypted item', async () => {
        const user = await signedInUser();
        assert.equal((await as(user).create({ ...views(), blob: 'my password is hunter2' })).status, 400);
        assert.equal((await as(user).create({ ...views(), label: 'GitHub' })).status, 400);
        assert.equal((await all('drops')).length, 0);
    });

    test('refuses a login that is missing, malformed, someone else\'s, or not there', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const bobsLogin = await loginOf(bob);
        for (const login of [undefined, 'abc', 123, 'z'.repeat(24), bobsLogin, '0'.repeat(24)]) {
            assert.equal((await as(ann).create({ ...views(), login })).status, 400, String(login));
        }
        assert.equal((await all('drops')).length, 0);
    });

    test('ignores any other field the client sends', async () => {
        const user = await signedInUser();
        await as(user).create({ ...views(), password: 'hunter2', title: 'GitHub' });
        const [stored] = await all('drops');
        assert.equal(stored.password, undefined);
        assert.equal(stored.title, undefined);
    });

    test('stops at 25 live drops, and an ended one does not count', async () => {
        const user = await signedInUser();
        for (let i = 0; i < 25; i += 1) assert.equal((await as(user).create(views())).status, 201);
        assert.equal((await as(user).create(views())).status, 400);
        const [first] = await all('drops');
        await expire(first._id);
        assert.equal((await as(user).create(views())).status, 201);
    });
});

describe('list', () => {
    test('shows only the sender\'s live drops, newest first, and never a blob', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const a1 = (await as(ann).create(views(2))).body.id;
        const a2 = (await as(ann).create(timer())).body.id;
        await as(bob).create(views());
        const ended = (await as(ann).create(timer())).body.id;
        await expire(ended);

        const res = await as(ann).list();
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.map((d) => d.id), [a2, a1]);
        assert.deepEqual(Object.keys(res.body[1]).sort(), ['createdAt', 'expiresAt', 'id', 'label', 'login', 'mode', 'viewsLeft']);
        assert.equal(res.body[1].login, ann.login);
        assert.equal(JSON.stringify(res.body).includes((await all('drops'))[0].blob), false);
    });
});

describe('open (no sign-in)', () => {
    test('takes one view each time, and the last view deletes the drop', async () => {
        const user = await signedInUser();
        const body = views(2);
        const { id } = (await as(user).create(body)).body;

        const first = await open(id);
        assert.equal(first.status, 200);
        assert.equal(first.body.blob, body.blob);
        assert.equal(first.body.viewsLeft, 1);
        assert.equal(first.headers['cache-control'], 'no-store');

        const second = await open(id);
        assert.equal(second.status, 200);
        assert.equal(second.body.viewsLeft, 0);
        assert.equal((await all('drops')).length, 0); // gone at once, not at the next database sweep

        assert.equal((await open(id)).status, 404);
        assert.equal((await as(user).list()).body.length, 0);
    });

    test('two people cannot both take the last view: 6 opens at once on a 2-view drop give exactly 2', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(views(2))).body;
        const results = await Promise.all(Array.from({ length: 6 }, () => open(id)));
        assert.equal(results.filter((r) => r.status === 200).length, 2);
        assert.equal(results.filter((r) => r.status === 404).length, 4);
    });

    test('a timer drop opens as often as you like until it ends, then is refused and not listed', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(timer())).body;
        for (let i = 0; i < 4; i += 1) assert.equal((await open(id)).status, 200);
        assert.equal((await as(user).list()).body.length, 1);

        await expire(id); // before the database's own sweep has run
        assert.equal((await open(id)).status, 404);
        assert.equal((await as(user).list()).body.length, 0);
    });

    test('a views drop past its 7-day backstop is refused even with views left', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(views(5))).body;
        await expire(id);
        assert.equal((await open(id)).status, 404);
    });

    test('missing, malformed, revoked and used-up all answer the identical 404', async () => {
        const user = await signedInUser();
        const used = (await as(user).create(views(1))).body.id;
        await open(used);
        const revoked = (await as(user).create(views(1))).body.id;
        await as(user).revoke(revoked);

        const answers = [];
        for (const id of ['AAAAAAAAAAAAAAAAAAAAAA', 'short', 'AAAAAAAAAAAAAAAAAAAA!!', used, revoked]) {
            const res = await open(id);
            answers.push([res.status, JSON.stringify(res.body)]);
        }
        assert.equal(new Set(answers.map((a) => a.join())).size, 1);
        assert.equal(answers[0][0], 404);
    });
});

describe('revoke', () => {
    test('the sender revokes at once: the link then says gone', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(timer(86400))).body;
        assert.equal((await open(id)).status, 200);
        const res = await as(user).revoke(id);
        assert.equal(res.status, 200);
        assert.equal((await all('drops')).length, 0);
        assert.equal((await open(id)).status, 404);
    });

    test('nobody else can revoke it, and it stays open', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const { id } = (await as(ann).create(timer())).body;
        assert.equal((await as(bob).revoke(id)).status, 404);
        assert.equal((await open(id)).status, 200);
    });

    test('revoking something that is not there is a 404', async () => {
        const user = await signedInUser();
        assert.equal((await as(user).revoke('AAAAAAAAAAAAAAAAAAAAAA')).status, 404);
        assert.equal((await as(user).revoke('nope')).status, 404);
    });
});

describe('history of ended links', () => {
    const DAY = 86400000;
    const endLog = async (id) => (await collection('droplog')).updateOne({ _id: id }, { $set: { endsAt: new Date(Date.now() - 1000) } }); // as if its time ran out

    test('a new link has a history row with no blob, and is not in the history while it is live', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(timer())).body;
        const [row] = await all('droplog');
        assert.deepEqual(Object.keys(row).sort(), ['_id', 'createdAt', 'endsAt', 'label', 'login', 'mode', 'opens', 'owner', 'purgeAt']);
        assert.equal(row._id, id);
        assert.equal(row.opens, 0);
        assert.deepEqual((await as(user).history()).body, []);
    });

    test('a link that is used up is listed with how often it was opened', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(views(2))).body;
        await open(id);
        assert.deepEqual((await as(user).history()).body, []); // still has a view left
        await open(id);
        await open(id); // refused: it does not count
        const [entry] = (await as(user).history()).body;
        assert.equal(entry.id, id);
        assert.equal(entry.reason, 'used');
        assert.equal(entry.opens, 2);
        assert.equal(entry.login, user.login);
        assert.deepEqual(Object.keys(entry).sort(), ['createdAt', 'endedAt', 'id', 'label', 'login', 'mode', 'opens', 'reason']);
        assert.equal(JSON.stringify(entry).includes('blob'), false);
    });

    test('a revoked timer link is listed as revoked, with the opens it had', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(timer())).body;
        for (let i = 0; i < 3; i += 1) await open(id);
        await as(user).revoke(id);
        const [entry] = (await as(user).history()).body;
        assert.deepEqual([entry.reason, entry.opens], ['revoked', 3]);
    });

    test('a link whose time ran out is listed as expired, ended at its planned end', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(timer())).body;
        await expire(id);
        await endLog(id);
        const [entry] = (await as(user).history()).body;
        assert.deepEqual([entry.id, entry.reason, entry.opens], [id, 'expired', 0]);
        assert.ok(new Date(entry.endedAt) < new Date());
    });

    test('is the sender\'s own, newest first', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const a1 = (await as(ann).create(views(1))).body.id;
        const a2 = (await as(ann).create(views(1))).body.id;
        const b1 = (await as(bob).create(views(1))).body.id;
        for (const id of [a1, a2, b1]) await open(id);
        assert.deepEqual((await as(ann).history()).body.map((e) => e.id), [a2, a1]);
        assert.deepEqual((await as(bob).history()).body.map((e) => e.id), [b1]);
        assert.equal((await request().get('/api/drops/history')).status, 401);
    });

    test('is kept for 30 days after the link ended, and no longer', async () => {
        const user = await signedInUser();
        const { id } = (await as(user).create(timer(600))).body;
        const [made] = await all('droplog');
        assert.ok(Math.abs((made.purgeAt - made.endsAt) / DAY - 30) < 0.01); // if it just runs out: 30 days after its end

        await as(user).revoke(id); // ended early: 30 days from now
        const [revoked] = await all('droplog');
        assert.ok(Math.abs((revoked.purgeAt - revoked.endedAt) / DAY - 30) < 0.01);
        assert.ok(Math.abs((revoked.purgeAt - Date.now()) / DAY - 30) < 0.01);

        const used = (await as(user).create(views(1))).body.id;
        await open(used);
        const row = (await all('droplog')).find((r) => r._id === used);
        assert.ok(Math.abs((row.purgeAt - row.endedAt) / DAY - 30) < 0.01);
    });

    test('goes with its login, with Delete All, and with the account', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const second = (await request().post('/api/passwords').set('auth-token', ann.token).send({ blob: blob() })).body._id;
        const used = async (user, login) => { const { id } = (await as(user).create({ ...views(1), login })).body; await open(id); return id; };
        await used(ann, await loginOf(ann));
        const kept = await used(ann, second);
        await used(bob, await loginOf(bob));

        await as(ann).deleteLogin(ann.login);
        assert.deepEqual((await as(ann).history()).body.map((e) => e.id), [kept]); // only that login's history went

        await as(ann).deleteAllLogins();
        assert.equal((await as(ann).history()).body.length, 0);
        assert.equal((await all('droplog')).length, 1); // bob's

        await request().delete('/api/auth/me').set('auth-token', bob.token).send({ currentAuthKey: bob.authKey });
        assert.equal((await all('droplog')).length, 0);
    });
});

describe('a link never outlives its login', () => {
    const newLogin = async (user) => (await request().post('/api/passwords').set('auth-token', user.token).send({ blob: blob() })).body._id;

    test('deleting a login ends its links, and only its links', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const other = await newLogin(ann);
        const a1 = (await as(ann).create(timer())).body.id;
        const a2 = (await as(ann).create(views(3))).body.id;
        const kept = (await as(ann).create({ ...timer(), login: other })).body.id; // another login of the same user
        const bobs = (await as(bob).create(timer())).body.id;

        assert.equal((await as(ann).deleteLogin(await loginOf(ann))).status, 200);
        assert.equal((await open(a1)).status, 404);
        assert.equal((await open(a2)).status, 404);
        assert.equal((await open(kept)).status, 200);
        assert.equal((await open(bobs)).status, 200);
        assert.deepEqual((await as(ann).list()).body.map((d) => d.id), [kept]);
    });

    test('Delete All Passwords ends every one of the user\'s links, and nobody else\'s', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const second = await newLogin(ann);
        const ids = [(await as(ann).create(timer())).body.id, (await as(ann).create({ ...views(2), login: second })).body.id];
        const bobs = (await as(bob).create(timer())).body.id;

        assert.equal((await as(ann).deleteAllLogins()).status, 200);
        for (const id of ids) assert.equal((await open(id)).status, 404);
        assert.equal((await as(ann).list()).body.length, 0);
        assert.equal((await open(bobs)).status, 200);
        assert.equal((await all('drops')).length, 1);
    });

    test('a link made before logins were recorded still lists, and can be revoked on its own', async () => {
        const user = await signedInUser();
        const now = new Date();
        await (await collection('drops')).insertOne({ _id: 'L'.repeat(22), owner: user.id, blob: blob(), label: blob(), mode: 'timer', createdAt: now, expiresAt: new Date(now.getTime() + 3600000) });
        const listed = (await as(user).list()).body;
        assert.deepEqual(listed.map((d) => [d.id, d.login]), [['L'.repeat(22), undefined]]);
        assert.equal((await as(user).revoke('L'.repeat(22))).status, 200);
        assert.equal((await open('L'.repeat(22))).status, 404);
    });
});

describe('deleting the account', () => {
    test('takes the account\'s drops with it, and leaves everyone else\'s', async () => {
        const ann = await signedInUser({ email: 'ann@example.com', username: 'ann' });
        const bob = await signedInUser({ email: 'bob@example.com', username: 'bob' });
        const annsDrop = (await as(ann).create(timer())).body.id;
        const bobsDrop = (await as(bob).create(timer())).body.id;

        const res = await request().delete('/api/auth/me').set('auth-token', ann.token).send({ currentAuthKey: ann.authKey });
        assert.equal(res.status, 200);
        assert.equal((await open(annsDrop)).status, 404);
        assert.equal((await open(bobsDrop)).status, 200);
    });
});
