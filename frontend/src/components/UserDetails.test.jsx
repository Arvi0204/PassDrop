import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import toast from 'react-hot-toast';
import UserDetails from './UserDetails';
import { saveSignIn, saveVaultKey } from '../lib/session';
import { deriveKeys, exportVaultKey, newVaultKey, unwrapVaultKey, wrapVaultKey } from '../lib/vaultCrypto';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// 1000 rounds keeps the key derivation fast; the account's kdf comes from the stand-in API like it does in production
const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
const MASTER = 'current-master-pw';

// a stand-in API: the profile (with the kdf and wrapped key), and settable answers to the destructive calls
let answers, vaultKey;
beforeEach(async () => {
    saveSignIn({ token: 'tok-123', userId: 'user-1' });
    vaultKey = await newVaultKey();
    await saveVaultKey(vaultKey);
    const { wrapKey } = await deriveKeys(MASTER, KDF);
    const wrappedVaultKey = await wrapVaultKey(vaultKey, wrapKey);
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    answers = { DELETE: { success: true, message: 'deleted' }, POST: { success: true, authToken: 'tok-new' } };
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => ({
        status: 200,
        ok: true,
        json: async () => answers[options.method] ?? { username: 'tester', email: 't@example.com', createdAt: '2026-01-01', lastLogin: '2026-02-02', kdf: KDF, wrappedVaultKey }
    })));
});

const calls = (method) => fetch.mock.calls.filter(([, options]) => options?.method === method);
const deletions = () => calls('DELETE');
const confirm = () => screen.getByRole('button', { name: /Yes, I'm sure/ });
const passwordBox = () => screen.getByPlaceholderText(/Enter your master password/);
const authKeyFor = async (password) => (await deriveKeys(password, KDF)).authKey;

function show() {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><UserDetails /></MemoryRouter>);
}
async function openDialog(user, buttonName) {
    show();
    await user.click(screen.getByRole('button', { name: buttonName }));
    return passwordBox();
}

describe('deleting from the Account page', () => {
    it('Delete All Passwords sends a currentAuthKey derived from the master password that was typed', async () => {
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete All Passwords/), MASTER);
        await user.click(confirm());

        await waitFor(() => expect(deletions()).toHaveLength(1));
        const [url, options] = deletions()[0];
        expect(url).toBe('http://api.test/api/passwords');
        expect(JSON.parse(options.body)).toEqual({ currentAuthKey: await authKeyFor(MASTER) });
        expect(options.body).not.toContain(MASTER);
        expect(options.headers['auth-token']).toBe('tok-123');
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });

    it('Delete Account sends a currentAuthKey derived from the master password that was typed', async () => {
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete PassDrop Account/), 'another-pw');
        await user.click(confirm());

        await waitFor(() => expect(deletions()).toHaveLength(1));
        const [url, options] = deletions()[0];
        expect(url).toBe('http://api.test/api/auth/me');
        expect(JSON.parse(options.body)).toEqual({ currentAuthKey: await authKeyFor('another-pw') });
        // deleting the account signs out: the token and the vault key both go
        await waitFor(() => expect(localStorage.getItem('passdrop.token')).toBeNull());
        expect(sessionStorage.getItem('passdrop.vaultKey')).toBeNull();
    });

    // the bug this guards against: the dialog remembered the password box as it was when it OPENED (empty)
    it('sends the proof of the password as it is when the button is pressed, however it was edited after the dialog opened', async () => {
        const user = userEvent.setup();
        const box = await openDialog(user, /Delete All Passwords/);
        await user.type(box, 'wrong-guess');
        await user.clear(box);
        await user.type(box, 'right-one');
        await user.click(confirm());

        await waitFor(() => expect(deletions()).toHaveLength(1));
        expect(JSON.parse(deletions()[0][1].body).currentAuthKey).toBe(await authKeyFor('right-one'));
    });

    it("shows the server's message when the master password is refused, and keeps the dialog open", async () => {
        answers.DELETE = { success: false, error: 'Current master password is incorrect' };
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete All Passwords/), 'nope');
        await user.click(confirm());

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Current master password is incorrect'));
        expect(passwordBox()).toBeTruthy();
    });

    it('Cancel closes the dialog and forgets the typed password', async () => {
        const user = userEvent.setup();
        await user.type(await openDialog(user, /Delete All Passwords/), 'secret-typed');
        await user.click(screen.getByRole('button', { name: /^Cancel/ }));
        await waitFor(() => expect(screen.queryByPlaceholderText(/Enter your master password/)).toBeNull());

        await user.click(screen.getByRole('button', { name: /Delete All Passwords/ }));
        expect(passwordBox().value).toBe('');
        expect(deletions()).toHaveLength(0);
    });
});

describe('changing the master password from the Account page', () => {
    async function change(user, current, next) {
        show();
        await user.type(screen.getByPlaceholderText('Enter your current master password'), current);
        await user.type(screen.getByPlaceholderText('Enter strong new master password'), next);
        await user.type(screen.getByPlaceholderText('Repeat new master password'), next);
        await user.click(screen.getByRole('button', { name: /Update Master Password/ }));
    }

    it('sends currentAuthKey, newAuthKey, newKdf and newWrappedVaultKey, keeps the vault key and saves the new token', async () => {
        const user = userEvent.setup();
        const keyBefore = sessionStorage.getItem('passdrop.vaultKey');
        await change(user, MASTER, 'a-new-master-pw');

        await waitFor(() => expect(calls('POST')).toHaveLength(1));
        const [url, options] = calls('POST')[0];
        expect(url).toBe('http://api.test/api/auth/change-password');
        expect(options.headers['auth-token']).toBe('tok-123');
        const sent = JSON.parse(options.body);
        expect(Object.keys(sent).sort()).toEqual(['currentAuthKey', 'newAuthKey', 'newKdf', 'newWrappedVaultKey']);
        expect(sent.currentAuthKey).toBe(await authKeyFor(MASTER));
        expect(sent.newAuthKey).toBe(await authKeyFor('a-new-master-pw'));
        expect(sent.newKdf).toEqual(KDF); // the same salt
        expect(options.body).not.toMatch(/current-master-pw|a-new-master-pw/);

        // the new password's key opens the very same vault key
        const { wrapKey } = await deriveKeys('a-new-master-pw', KDF);
        expect(await exportVaultKey(await unwrapVaultKey(sent.newWrappedVaultKey, wrapKey))).toBe(await exportVaultKey(vaultKey));

        await waitFor(() => expect(localStorage.getItem('passdrop.token')).toBe('tok-new'));
        expect(localStorage.getItem('passdrop.userId')).toBe('user-1');
        expect(sessionStorage.getItem('passdrop.vaultKey')).toBe(keyBefore);
    });

    it('in a locked tab the current password opens the vault key for the change, and the tab stays locked', async () => {
        sessionStorage.removeItem('passdrop.vaultKey');
        const user = userEvent.setup();
        await change(user, MASTER, 'a-new-master-pw');
        await waitFor(() => expect(calls('POST')).toHaveLength(1));
        const { wrapKey } = await deriveKeys('a-new-master-pw', KDF);
        const sent = JSON.parse(calls('POST')[0][1].body);
        expect(await exportVaultKey(await unwrapVaultKey(sent.newWrappedVaultKey, wrapKey))).toBe(await exportVaultKey(vaultKey));
        expect(sessionStorage.getItem('passdrop.vaultKey')).toBeNull();
    });

    it('a wrong current password in a locked tab says so and changes nothing', async () => {
        sessionStorage.removeItem('passdrop.vaultKey');
        const user = userEvent.setup();
        await change(user, 'not-it', 'a-new-master-pw');
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('That is not your master password.'));
        expect(calls('POST')).toHaveLength(0);
        expect(localStorage.getItem('passdrop.token')).toBe('tok-123');
    });

    it("shows the server's message when the current password is refused, and keeps the token", async () => {
        answers.POST = { success: false, error: 'Current master password is incorrect' };
        const user = userEvent.setup();
        await change(user, 'not-it', 'a-new-master-pw');
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Current master password is incorrect'));
        expect(localStorage.getItem('passdrop.token')).toBe('tok-123');
    });
});
