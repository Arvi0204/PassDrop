import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BAD_LINK, GONE, createDrop, listDrops, listHistory, openDrop, peekDrop, revokeDrop } from './dropApi';
import { fingerprintOf, keyFromHash } from './drop';
import { newVaultKey } from './vaultCrypto';

const HOST = 'http://api.test', ORIGIN = 'https://pass-drop.vercel.app';
const item = { _id: 'p1', title: 'GitHub', url: 'github.com', username: 'octocat', password: 'S3cret-pw!', notes: 'n', isFavorite: true };
let vaultKey, sent, stored;

// a stand-in server that keeps what it was sent, like the real one
beforeEach(async () => {
    vaultKey = await newVaultKey();
    sent = null; stored = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        const reply = (status, json) => ({ ok: status < 400, status, json: async () => json });
        if (options.method === 'POST' && url.endsWith('/api/drops')) {
            sent = { url, options, body: JSON.parse(options.body) };
            stored = sent.body;
            return reply(201, { id: 'ID-1', mode: stored.mode, viewsLeft: stored.views, expiresAt: '2030-01-01T00:00:00Z' });
        }
        if (options.method === 'POST' && url.endsWith('/open')) return stored ? reply(200, { blob: stored.blob, mode: stored.mode, viewsLeft: 0, expiresAt: 'x' }) : reply(404, { success: false });
        if (options.method === 'GET' && url.endsWith('/history')) return reply(200, [{ id: 'ID-1', login: stored.login, label: stored.label, mode: 'views', createdAt: 'x', endedAt: 'y', reason: 'used', opens: 1 }]);
        if (options.method === 'GET') return reply(200, [{ id: 'ID-1', login: stored.login, label: stored.label, mode: 'views', viewsLeft: 1, expiresAt: 'x', createdAt: 'x' }]);
        if (options.method === 'DELETE') return reply(url.endsWith('/nope') ? 404 : 200, { success: true, error: 'gone' });
        return reply(500, {});
    }));
});

const make = (rule = { mode: 'views', views: 1 }, name = '') => createDrop(HOST, 'tok', { item, rule, name, vaultKey, userId: 'u1', origin: ORIGIN });

describe('createDrop', () => {
    it('sends the rule and two encrypted blobs, and nothing readable or any key', async () => {
        const result = await make({ mode: 'timer', ttl: 3600 });
        expect(result.ok).toBe(true);
        expect(sent.options.headers['auth-token']).toBe('tok');
        expect(sent.body).toMatchObject({ mode: 'timer', ttl: 3600, login: 'p1' }); // which login: its opaque record id only
        expect(sent.body.blob).toMatch(/^v1\./);
        expect(sent.body.label).toMatch(/^v1\./);
        const linkKey = keyFromHash(new URL(result.link).hash);
        expect(linkKey).toBeTruthy();
        const wire = sent.options.body;
        for (const secret of ['S3cret-pw!', 'octocat', 'github.com', 'GitHub', linkKey]) expect(wire).not.toContain(secret);
        expect(result.link.startsWith(`${ORIGIN}/drop/ID-1#`)).toBe(true);
    });

    it('returns the server\'s refusal as an error', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ errors: [{ msg: 'You have 25 live drops. Revoke one to make another.' }] }) });
        expect(await make()).toEqual({ ok: false, error: 'You have 25 live drops. Revoke one to make another.' });
    });
});

describe('openDrop', () => {
    it('opens with the key from the link and gets back exactly the shared fields', async () => {
        const { link } = await make();
        const linkKey = keyFromHash(new URL(link).hash);
        const opened = await openDrop(HOST, 'ID-1', linkKey);
        expect(opened.ok).toBe(true);
        expect(opened.item).toEqual({ title: 'GitHub', url: 'github.com', username: 'octocat', password: 'S3cret-pw!', notes: 'n' });
    });

    it('says the link is changed when the key is not the one that sealed it', async () => {
        await make();
        const firstBlob = stored.blob;
        const otherKey = keyFromHash(new URL((await make()).link).hash); // a second drop has its own key
        stored = { ...stored, blob: firstBlob };
        expect(await openDrop(HOST, 'ID-1', otherKey)).toEqual({ ok: false, error: BAD_LINK });
    });

    it('treats a 404 as gone', async () => {
        expect(await openDrop(HOST, 'ID-1', 'A'.repeat(43))).toEqual({ ok: false, gone: true, error: GONE });
    });
});

describe('peekDrop', () => {
    it('looks at what is left with a plain GET: no token, no key, nothing to open', async () => {
        fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ mode: 'views', viewsLeft: 3, now: 'x' }) });
        expect(await peekDrop(HOST, 'ID-1')).toEqual({ ok: true, mode: 'views', viewsLeft: 3, now: 'x' });
        expect(fetch).toHaveBeenCalledWith(HOST + '/api/drops/ID-1');
    });

    it('treats a 404 as gone, and any other refusal as an error', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ success: false }) });
        expect(await peekDrop(HOST, 'ID-1')).toEqual({ ok: false, gone: true, error: GONE });
        fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Internal Server Error' }) });
        expect(await peekDrop(HOST, 'ID-1')).toEqual({ ok: false, error: 'Internal Server Error' });
    });
});

describe('listDrops and revokeDrop', () => {
    it('lists the sender\'s drops with the title decrypted', async () => {
        await make();
        const { ok, drops } = await listDrops(HOST, 'tok', { vaultKey, userId: 'u1' });
        expect(ok).toBe(true);
        expect(drops[0]).toMatchObject({ id: 'ID-1', title: 'GitHub', login: 'p1', viewsLeft: 1 }); // which login it was made from
        expect(drops[0].label).toBeUndefined();
        expect(drops[0].name).toBe(''); // no name was given
        expect(drops[0].fp).toBe(await fingerprintOf(item)); // what the link shows, to spot a later edit
    });

    it('keeps the name the sender gave inside the encrypted label, never in the clear', async () => {
        await make({ mode: 'views', views: 1 }, '  For Priya  ');
        expect(sent.options.body).not.toContain('Priya');
        const { drops } = await listDrops(HOST, 'tok', { vaultKey, userId: 'u1' });
        expect(drops[0].name).toBe('For Priya');
    });

    it('lists the ended links with the title and name decrypted, and how each ended', async () => {
        await make({ mode: 'views', views: 1 }, 'For Priya');
        const { ok, history } = await listHistory(HOST, 'tok', { vaultKey, userId: 'u1' });
        expect(ok).toBe(true);
        expect(history[0]).toMatchObject({ id: 'ID-1', login: 'p1', title: 'GitHub', name: 'For Priya', reason: 'used', opens: 1 });
        expect(history[0].label).toBeUndefined();
    });

    it('returns the server\'s refusal when the history cannot be loaded', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Internal Server Error' }) });
        expect(await listHistory(HOST, 'tok', { vaultKey, userId: 'u1' })).toEqual({ ok: false, error: 'Internal Server Error' });
    });

    it('revokes by id, and passes a refusal on', async () => {
        expect(await revokeDrop(HOST, 'tok', 'ID-1')).toEqual({ ok: true });
        expect(await revokeDrop(HOST, 'tok', 'nope')).toEqual({ ok: false, error: 'gone' });
    });
});
