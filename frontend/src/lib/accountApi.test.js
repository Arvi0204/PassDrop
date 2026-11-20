import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePassword, reauthKey, signIn, signUp, unlock } from './accountApi';
import { decryptItem, deriveKeys, encryptItem, unwrapVaultKey } from './vaultCrypto';

// Test speed: the real key derivation uses 600000 rounds. signUp is the only call that makes its own kdf, so it gets a
// 1000-round one here; every other call uses whatever kdf the (fake) server hands back.
vi.mock('./vaultCrypto', async (importOriginal) => {
    const real = await importOriginal();
    return { ...real, newKdf: () => real.newKdf(1000) };
});

const HOST = 'http://api.test';
const PASSWORD = 'correct horse battery staple';

// A small stand-in for the API that keeps what it is given, like the real one, and writes down every request body.
let users, requests;
function fakeServer() {
    users = {};
    requests = [];
    const ok = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });
    const bad = (msg, status = 400) => ok({ success: false, errors: [{ msg }] }, status);
    const find = (email) => users[email];

    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        const path = new URL(url).pathname;
        const body = options.body ? JSON.parse(options.body) : {};
        requests.push({ path, text: options.body ?? '', headers: options.headers });
        if (path === '/api/auth/prelogin') {
            const fake = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
            return ok({ success: true, kdf: find(new URL(url).searchParams.get('email'))?.kdf ?? fake });
        }
        if (path === '/api/auth/register') {
            users[body.email] = { ...body, id: 'user-1' };
            return ok({ success: true, authToken: 'tok-1', userId: 'user-1' }, 201);
        }
        if (path === '/api/auth/login') {
            const user = find(body.email);
            if (!user || user.authKey !== body.authKey) return bad('Please login with valid credentials');
            return ok({ success: true, authToken: 'tok-2', userId: user.id, kdf: user.kdf, wrappedVaultKey: user.wrappedVaultKey });
        }
        const user = Object.values(users)[0];
        if (path === '/api/auth/me') return ok({ _id: user.id, kdf: user.kdf, wrappedVaultKey: user.wrappedVaultKey });
        if (path === '/api/auth/change-password') {
            if (body.currentAuthKey !== user.authKey) return ok({ success: false, error: 'Current master password is incorrect' }, 403);
            Object.assign(user, { authKey: body.newAuthKey, kdf: body.newKdf, wrappedVaultKey: body.newWrappedVaultKey });
            return ok({ success: true, authToken: 'tok-3' });
        }
        throw new Error(`unexpected ${path}`);
    }));
}

const account = { username: 'tester', email: 't@example.com', password: PASSWORD };
const allText = () => requests.map((r) => r.text).join('\n');
beforeEach(fakeServer);

describe('signUp', () => {
    it('sends authKey, kdf and wrappedVaultKey, and never the password', async () => {
        const result = await signUp(HOST, account);
        expect(result.ok).toBe(true);
        const sent = JSON.parse(requests[0].text);
        expect(Object.keys(sent).sort()).toEqual(['authKey', 'email', 'kdf', 'username', 'wrappedVaultKey']);
        expect(sent.kdf.iterations).toBe(1000);
        expect(allText()).not.toContain(PASSWORD);
    });

    it('returns a vault key that the password unwraps from what was sent, and that decrypts what it encrypts', async () => {
        const result = await signUp(HOST, account);
        const stored = users['t@example.com'];
        const { wrapKey } = await deriveKeys(PASSWORD, stored.kdf);
        const viaPassword = await unwrapVaultKey(stored.wrappedVaultKey, wrapKey);
        const blob = await encryptItem(result.vaultKey, { title: 'GitHub' }, 'user-1');
        expect(await decryptItem(viaPassword, blob, 'user-1')).toEqual({ title: 'GitHub' });
        expect(result).toMatchObject({ token: 'tok-1', userId: 'user-1' });
    });

    it("hands back the server's messages when sign-up is refused", async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ success: false, errors: [{ msg: 'Sorry, another account exists with this email!' }] }) });
        expect(await signUp(HOST, account)).toEqual({ ok: false, errors: ['Sorry, another account exists with this email!'] });
    });
});

describe('signIn', () => {
    it('does prelogin, sends only the authKey, and returns a vault key that opens a blob made at sign-up', async () => {
        const created = await signUp(HOST, account);
        const blob = await encryptItem(created.vaultKey, { title: 'GitHub' }, 'user-1');
        requests.length = 0;

        const result = await signIn(HOST, { email: account.email, password: PASSWORD });
        expect(result).toMatchObject({ ok: true, token: 'tok-2', userId: 'user-1' });
        expect(await decryptItem(result.vaultKey, blob, 'user-1')).toEqual({ title: 'GitHub' });
        expect(requests.map((r) => r.path)).toEqual(['/api/auth/prelogin', '/api/auth/login']);
        expect(Object.keys(JSON.parse(requests[1].text)).sort()).toEqual(['authKey', 'email']);
        expect(allText()).not.toContain(PASSWORD);
    });

    it('with a wrong password returns errors and no vault key', async () => {
        await signUp(HOST, account);
        const result = await signIn(HOST, { email: account.email, password: 'not it' });
        expect(result).toEqual({ ok: false, errors: ['Please login with valid credentials'] });
    });

    it('answers an unknown email exactly like a wrong password', async () => {
        const result = await signIn(HOST, { email: 'nobody@example.com', password: PASSWORD });
        expect(result).toEqual({ ok: false, errors: ['Please login with valid credentials'] });
    });
});

describe('unlock and reauthKey', () => {
    it('unlock opens the vault with the right password and refuses a wrong one', async () => {
        const created = await signUp(HOST, account);
        const blob = await encryptItem(created.vaultKey, { title: 'x' }, 'user-1');
        const good = await unlock(HOST, 'tok', PASSWORD);
        expect(good.ok).toBe(true);
        expect(await decryptItem(good.vaultKey, blob, 'user-1')).toEqual({ title: 'x' });
        expect(await unlock(HOST, 'tok', 'wrong')).toEqual({ ok: false, error: 'That is not your master password.' });
        expect(fetch.mock.calls.at(-1)[1].headers['auth-token']).toBe('tok');
    });

    it('reauthKey is the authKey for that password with the account kdf', async () => {
        await signUp(HOST, account);
        const { authKey } = await deriveKeys(PASSWORD, users['t@example.com'].kdf);
        expect(await reauthKey(HOST, 'tok', PASSWORD)).toBe(authKey);
    });
});

describe('changePassword', () => {
    it('keeps the salt, sends keys not passwords, re-wraps the same vault key and returns the new token', async () => {
        const created = await signUp(HOST, account);
        const blob = await encryptItem(created.vaultKey, { title: 'x' }, 'user-1');
        const salt = users['t@example.com'].kdf.salt;
        requests.length = 0;

        const result = await changePassword(HOST, 'tok', { currentPassword: PASSWORD, newPassword: 'a brand new pass', vaultKey: created.vaultKey });
        expect(result).toEqual({ ok: true, token: 'tok-3' });
        const sent = JSON.parse(requests.find((r) => r.path === '/api/auth/change-password').text);
        expect(Object.keys(sent).sort()).toEqual(['currentAuthKey', 'newAuthKey', 'newKdf', 'newWrappedVaultKey']);
        expect(sent.newKdf.salt).toBe(salt);
        expect(allText()).not.toMatch(/correct horse|a brand new pass/);

        // the new password opens the same vault; the old one no longer signs in
        const again = await signIn(HOST, { email: account.email, password: 'a brand new pass' });
        expect(await decryptItem(again.vaultKey, blob, 'user-1')).toEqual({ title: 'x' });
        expect((await signIn(HOST, { email: account.email, password: PASSWORD })).ok).toBe(false);
    });

    it("returns the server's message for a wrong current password and changes nothing", async () => {
        const created = await signUp(HOST, account);
        const wrapped = users['t@example.com'].wrappedVaultKey;
        const result = await changePassword(HOST, 'tok', { currentPassword: 'nope', newPassword: 'new one', vaultKey: created.vaultKey });
        expect(result).toEqual({ ok: false, error: 'Current master password is incorrect' });
        expect(users['t@example.com'].wrappedVaultKey).toBe(wrapped);
    });
});
