import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LockScreen from './LockScreen';
import { getVaultKey, saveSignIn } from '../lib/session';
import { decryptItem, deriveKeys, encryptItem, newVaultKey, wrapVaultKey } from '../lib/vaultCrypto';

// 1000 rounds keeps the key derivation fast; production uses the account's own kdf, served by /api/auth/me
const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
let vaultKey, blob;

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    saveSignIn({ token: 'tok-1', userId: 'user-1' });
    vaultKey = await newVaultKey();
    blob = await encryptItem(vaultKey, { title: 'GitHub' }, 'user-1');
    const { wrapKey } = await deriveKeys('the-master-pw', KDF);
    const me = { kdf: KDF, wrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey) };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => me })));
});

const show = (onUnlocked) =>
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><LockScreen onUnlocked={onUnlocked} /></MemoryRouter>);

describe('LockScreen', () => {
    it('says the vault locks when its tab is closed and asks only for the master password', () => {
        show();
        expect(screen.getByText('Your vault locks whenever its tab is closed.')).toBeTruthy();
        expect(document.querySelectorAll('input')).toHaveLength(1);
        expect(document.querySelector('input').type).toBe('password');
    });

    it('a wrong password shows "That is not your master password." and stores no vault key', async () => {
        const user = userEvent.setup();
        const onUnlocked = vi.fn();
        show(onUnlocked);
        await user.type(screen.getByLabelText('Master Password'), 'not-it');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        expect(await screen.findByText('That is not your master password.')).toBeTruthy();
        expect(sessionStorage.getItem('passdrop.vaultKey')).toBeNull();
        expect(await getVaultKey()).toBeNull();
        expect(onUnlocked).not.toHaveBeenCalled();
    });

    it('the right password stores the vault key (one that opens the saved logins) and reports it unlocked', async () => {
        const user = userEvent.setup();
        const onUnlocked = vi.fn();
        show(onUnlocked);
        await user.type(screen.getByLabelText('Master Password'), 'the-master-pw');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
        expect(await decryptItem(await getVaultKey(), blob, 'user-1')).toEqual({ title: 'GitHub' });
        expect(fetch.mock.calls[0][1].headers['auth-token']).toBe('tok-1');
    });

    it('can sign out instead, which forgets the sign-in', async () => {
        const user = userEvent.setup();
        show();
        await user.click(screen.getByRole('button', { name: /Sign out instead/ }));
        expect(localStorage.getItem('passdrop.token')).toBeNull();
    });
});
