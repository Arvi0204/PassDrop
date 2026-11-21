import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Manager from './Manager';
import PasswordState from '../context/PasswordState';
import { saveSignIn, saveVaultKey } from '../lib/session';
import { deriveKeys, encryptItem, newVaultKey, wrapVaultKey } from '../lib/vaultCrypto';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// the water animation needs a real browser; the vault only asks it whether an entrance is queued
vi.mock('../context/useTide', () => ({ useTide: () => ({ peekEntrance: () => false, release() {}, finishEntrance() {}, rise() {}, async complete() {}, queueEntrance() {}, abort() {} }) }));

const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
const github = { title: 'GitHub', url: 'github.com', username: 'me', password: 'pw-1', notes: '', isFavorite: false };
let vaultKey, passwordsFetched;

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    saveSignIn({ token: 'tok-1', userId: 'user-1' });
    vaultKey = await newVaultKey();
    const { wrapKey } = await deriveKeys('the-master-pw', KDF);
    const me = { kdf: KDF, wrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey) };
    const records = [
        { _id: 'a', blob: await encryptItem(vaultKey, github, 'user-1'), createdAt: 'c', updatedAt: 'u' },
        { _id: 'b', blob: 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, // cannot be opened with this key
        { _id: 'c', blob: await encryptItem(vaultKey, { ...github, title: 'Mail', password: 'pw-2' }, 'user-1'), createdAt: 'c', updatedAt: 'u' }
    ];
    passwordsFetched = 0;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        if (url.endsWith('/api/passwords')) passwordsFetched += 1;
        return { ok: true, status: 200, json: async () => (url.endsWith('/api/auth/me') ? me : records) };
    }));
});

const show = () =>
    render(
        <PasswordState>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Manager /></MemoryRouter>
        </PasswordState>
    );

describe('the vault page', () => {
    it('in a new tab (signed in, no vault key) shows the lock screen and fetches nothing', async () => {
        show();
        expect(screen.getByText('Your passwords are encrypted. Enter your master password to unlock them.')).toBeTruthy();
        expect(screen.queryByText('GitHub')).toBeNull();
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(passwordsFetched).toBe(0);
    });

    it('a wrong password keeps it locked; the right one shows the vault', async () => {
        const user = userEvent.setup();
        show();
        await user.type(screen.getByLabelText('Master Password'), 'wrong');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        await screen.findByText('That is not your master password.');
        expect(passwordsFetched).toBe(0);

        await user.clear(screen.getByLabelText('Master Password'));
        await user.type(screen.getByLabelText('Master Password'), 'the-master-pw');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        expect((await screen.findAllByText('GitHub')).length).toBeGreaterThan(0);
        expect(screen.queryByText('Your passwords are encrypted. Enter your master password to unlock them.')).toBeNull();
        expect(passwordsFetched).toBe(1);
    });

    it('after a reload (the vault key is still in sessionStorage) it opens straight to the vault', async () => {
        await saveVaultKey(vaultKey);
        show();
        expect((await screen.findAllByText('GitHub')).length).toBeGreaterThan(0);
        expect(screen.queryByText('Your passwords are encrypted. Enter your master password to unlock them.')).toBeNull();
    });

    it('shows an item that cannot be decrypted as a plain row, and still lists the others', async () => {
        await saveVaultKey(vaultKey);
        show();
        expect(await screen.findByText('This login could not be decrypted')).toBeTruthy();
        expect(screen.getAllByText('GitHub').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Mail').length).toBeGreaterThan(0);
        await waitFor(() => expect(screen.getByText('3 items')).toBeTruthy());
    });
});
