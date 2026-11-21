import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FrozenVault from './FrozenVault';
import PasswordState from '../context/PasswordState';
import { saveSignIn } from '../lib/session';
import { deriveKeys, newVaultKey, wrapVaultKey } from '../lib/vaultCrypto';

const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    saveSignIn({ token: 'tok-1', userId: 'user-1' });
    const { wrapKey } = await deriveKeys('the-master-pw', KDF);
    const me = { kdf: KDF, wrappedVaultKey: await wrapVaultKey(await newVaultKey(), wrapKey) };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => me })));
});

const frozen = (props = {}) => (
    <PasswordState>
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <FrozenVault unlocked={false} onGone={() => {}} {...props} />
        </MemoryRouter>
    </PasswordState>
);

describe('FrozenVault', () => {
    it('shows the lock card with the "Vault frozen" wording', () => {
        render(frozen());
        expect(screen.getByText('Vault frozen')).toBeTruthy();
        expect(screen.getByLabelText('Master Password')).toBeTruthy();
    });

    it('a wrong password shows the error, leaves the card up and does not report the frost gone', async () => {
        const user = userEvent.setup();
        const onGone = vi.fn();
        render(frozen({ onGone }));
        await user.type(screen.getByLabelText('Master Password'), 'not-it');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        await screen.findByText('That is not your master password.');
        expect(onGone).not.toHaveBeenCalled();
    });

    it('once unlocked it clears the frost and then reports it is gone', async () => {
        const onGone = vi.fn();
        const { rerender } = render(frozen({ onGone }));
        rerender(frozen({ unlocked: true, onGone }));
        await waitFor(() => expect(onGone).toHaveBeenCalled());
    });
});
