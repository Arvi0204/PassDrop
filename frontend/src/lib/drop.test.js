import { describe, expect, it } from 'vitest';
import { describeRule, dropLink, fingerprintOf, fromLinkKey, keyFromHash, pickShared, timeLeft, toLinkKey } from './drop';
import { exportVaultKey, importVaultKey, newVaultKey } from './vaultCrypto';

describe('the key in the link', () => {
    it('round-trips a real key through the url-safe form, with nothing that needs escaping', async () => {
        const b64 = await exportVaultKey(await newVaultKey());
        const key = toLinkKey(b64);
        expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(fromLinkKey(key)).toBe(b64);
        await expect(importVaultKey(fromLinkKey(key))).resolves.toBeTruthy();
    });

    it('is read from the #fragment only when it is a whole key', () => {
        const key = 'A'.repeat(43);
        expect(keyFromHash(`#${key}`)).toBe(key);
        expect(keyFromHash(key)).toBe(key);
        for (const bad of ['', '#', '#short', `#${key}x`, `#${'!'.repeat(43)}`, undefined]) expect(keyFromHash(bad)).toBeNull();
    });

    it('puts the key after a # so it never reaches the server', () => {
        const link = dropLink('https://pass-drop.vercel.app', 'abc', 'KEY');
        expect(link).toBe('https://pass-drop.vercel.app/drop/abc#KEY');
        expect(new URL(link).hash).toBe('#KEY');
        expect(new URL(link).pathname + new URL(link).search).not.toContain('KEY');
    });
});

describe('what is shared', () => {
    it('is the five login fields and nothing else about the login', () => {
        const item = { _id: '1', title: 'GitHub', url: 'github.com', username: 'octo', password: 'pw', notes: 'n', isFavorite: true, createdAt: 'x', updatedAt: 'y' };
        expect(pickShared(item)).toEqual({ title: 'GitHub', url: 'github.com', username: 'octo', password: 'pw', notes: 'n' });
        expect(pickShared({})).toEqual({ title: '', url: '', username: '', password: '', notes: '' });
    });
});

describe('fingerprintOf', () => {
    const login = { title: 'GitHub', url: 'github.com', username: 'octo', password: 'pw', notes: '' };

    it('is the same for the same shown details, and changes when any of them changes', async () => {
        const same = await fingerprintOf({ ...login });
        expect(same).toMatch(/^[0-9a-f]{64}$/);
        expect(await fingerprintOf({ ...login })).toBe(same);
        for (const change of [{ password: 'new' }, { username: 'me' }, { title: 'Git' }, { url: 'gitlab.com' }, { notes: 'x' }]) {
            expect(await fingerprintOf({ ...login, ...change })).not.toBe(same);
        }
    });

    it('does not change for what a link does not show (favourite, dates, id)', async () => {
        expect(await fingerprintOf({ ...login, isFavorite: true, _id: 'x', updatedAt: 'later' })).toBe(await fingerprintOf(login));
    });
});

describe('time and rule in words', () => {
    const now = Date.parse('2026-01-01T12:00:00Z');
    const after = (ms) => new Date(now + ms).toISOString();

    it('says how long is left', () => {
        expect(timeLeft(after(-1000), now)).toBe('ended');
        expect(timeLeft(after(20000), now)).toBe('under a minute');
        expect(timeLeft(after(12 * 60000), now)).toBe('12 min');
        expect(timeLeft(after(200 * 60000), now)).toBe('3 h 20 min');
        expect(timeLeft(after(120 * 60000), now)).toBe('2 h');
        expect(timeLeft(after(7 * 86400000), now)).toBe('7 days');
    });

    it('describes a views drop and a timer drop', () => {
        expect(describeRule({ mode: 'views', viewsLeft: 1 }, now)).toBe('1 view left');
        expect(describeRule({ mode: 'views', viewsLeft: 3 }, now)).toBe('3 views left');
        expect(describeRule({ mode: 'timer', expiresAt: after(90 * 60000) }, now)).toBe('ends in 1 h 30 min');
    });
});
