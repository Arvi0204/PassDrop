import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Recover from './Recover';
import { getVaultKey } from '../lib/session';
import {
    decryptItem, deriveRecoveryKeys, encryptItem, newKdf, newRecoveryKey, newVaultKey, wrapVaultKey
} from '../lib/vaultCrypto';

// a real recovery setup (1000 rounds to stay fast) behind a stand-in API
const KDF = newKdf(1000);
let recoveryKey, blob, stored;

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    recoveryKey = newRecoveryKey();
    const vaultKey = await newVaultKey();
    blob = await encryptItem(vaultKey, { title: 'GitHub' }, 'user-1');
    const { recoveryAuthKey, recoveryWrapKey } = await deriveRecoveryKeys(recoveryKey, KDF);
    const recoveryWrappedKey = await wrapVaultKey(vaultKey, recoveryWrapKey);
    stored = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        const path = new URL(url).pathname;
        const body = options.body ? JSON.parse(options.body) : {};
        const reply = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });
        if (path === '/api/auth/prelogin') return reply({ success: true, kdf: KDF });
        if (body.email !== 'me@example.com' || body.recoveryAuthKey !== recoveryAuthKey) {
            return reply({ success: false, errors: [{ msg: 'Check the email and recovery key.' }] }, 400);
        }
        if (path.endsWith('/unlock')) return reply({ success: true, kdf: KDF, recoveryWrappedKey });
        stored = body;
        return reply({ success: true, authToken: 'tok-new', userId: 'user-1', kdf: KDF, wrappedVaultKey: body.newWrappedVaultKey });
    }));
});

async function fill(user, { email = 'me@example.com', key = recoveryKey, password = 'fresh start pass 9!', confirm = password } = {}) {
    render(
        <MemoryRouter initialEntries={['/recover']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes><Route path="/recover" element={<Recover />} /><Route path="/" element={<p>THE VAULT</p>} /></Routes>
        </MemoryRouter>
    );
    await user.type(screen.getByLabelText('Email address'), email);
    await user.type(screen.getByLabelText('Recovery key'), key);
    await user.type(screen.getByLabelText('New master password'), password);
    await user.type(screen.getByLabelText('Confirm new master password'), confirm);
    await user.click(screen.getByRole('button', { name: /Recover vault/ }));
}

describe('Recover', () => {
    it('accepts the key in lowercase with spaces, signs in and unlocks with the same vault', async () => {
        const user = userEvent.setup();
        await fill(user, { key: recoveryKey.toLowerCase().replaceAll('-', ' ') });
        expect(await screen.findByText('THE VAULT')).toBeTruthy();
        expect(localStorage.getItem('passdrop.token')).toBe('tok-new');
        expect(localStorage.getItem('passdrop.userId')).toBe('user-1');
        expect(await decryptItem(await getVaultKey(), blob, 'user-1')).toEqual({ title: 'GitHub' });
        expect(JSON.stringify(fetch.mock.calls)).not.toMatch(/fresh start pass/);
    });

    it('a wrong key shows "Check the email and recovery key." and stores nothing', async () => {
        const user = userEvent.setup();
        await fill(user, { key: newRecoveryKey() });
        expect(await screen.findByText('Check the email and recovery key.')).toBeTruthy();
        expect(localStorage.getItem('passdrop.token')).toBeNull();
        expect(await getVaultKey()).toBeNull();
        expect(stored).toBeNull();
    });

    it('a key that is not 32 hex digits gets the same message without asking the server to reset anything', async () => {
        const user = userEvent.setup();
        await fill(user, { key: 'ABCD-1234' });
        expect(await screen.findByText('Check the email and recovery key.')).toBeTruthy();
        expect(stored).toBeNull();
    });

    it('does not submit a new master password shorter than 12 characters', async () => {
        const user = userEvent.setup();
        await fill(user, { password: 'short-pw-11' });
        expect(await screen.findByText('Use at least 12 characters')).toBeTruthy();
        await waitFor(() => expect(fetch).not.toHaveBeenCalled());
    });

    it('does not submit when the two new passwords differ', async () => {
        const user = userEvent.setup();
        await fill(user, { password: 'fresh start pass 9!', confirm: 'something else' });
        expect(await screen.findByText('Passwords do not match')).toBeTruthy();
        await waitFor(() => expect(fetch).not.toHaveBeenCalled());
    });
});
