import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Signup from './Signup';
import { signUp } from '../lib/accountApi';
import { getPendingRecoveryKey, getVaultKey } from '../lib/session';
import { newVaultKey } from '../lib/vaultCrypto';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../lib/accountApi', () => ({ signUp: vi.fn() }));
// the water animation needs a real browser; every step just resolves
vi.mock('../context/useTide', () => ({
    useTide: () => ({
        begin() {}, abort() {}, shake() {}, leave() {}, queueEntrance() {},
        cancel: async () => {}, complete: async () => {}, welcome: async () => {}
    })
}));

const KEY = '1A2B-3C4D-5E6F-7A8B-9C0D-1E2F-3A4B-5C6D';

describe('Signup', () => {
    it('signs in and goes straight to the vault, without interrupting the water; the recovery key is held for the Account page', async () => {
        signUp.mockResolvedValue({ ok: true, token: 'tok', userId: 'user-1', vaultKey: await newVaultKey(), recoveryKey: KEY });
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/signup']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes><Route path="/signup" element={<Signup />} /><Route path="/" element={<p>THE VAULT</p>} /></Routes>
            </MemoryRouter>
        );
        await user.type(screen.getByLabelText('Full Name / Username'), 'Jane');
        await user.type(screen.getByLabelText('Email address'), 'jane@example.com');
        await user.type(screen.getByLabelText('Master Password'), 'a-good-master-pw-1!');
        await user.type(screen.getByLabelText('Confirm Master Password'), 'a-good-master-pw-1!');
        await user.click(screen.getByRole('button', { name: /Create Free Vault/ }));

        expect(await screen.findByText('THE VAULT')).toBeTruthy();
        expect(screen.queryByTestId('recovery-key')).toBeNull(); // no screen in the way of the animation
        expect(localStorage.getItem('passdrop.token')).toBe('tok');
        expect(localStorage.getItem('passdrop.userId')).toBe('user-1');
        expect(await getVaultKey()).not.toBeNull();
        expect(getPendingRecoveryKey()).toBe(KEY); // waiting for the Account page, in this tab only
        expect(localStorage.getItem('passdrop.pendingRecoveryKey')).toBeNull();
    });

    it('stores nothing when the account cannot be created', async () => {
        signUp.mockResolvedValue({ ok: false, errors: ['Sorry, another account exists with this email!'] });
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/signup']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes><Route path="/signup" element={<Signup />} /><Route path="/" element={<p>THE VAULT</p>} /></Routes>
            </MemoryRouter>
        );
        await user.type(screen.getByLabelText('Full Name / Username'), 'Jane');
        await user.type(screen.getByLabelText('Email address'), 'jane@example.com');
        await user.type(screen.getByLabelText('Master Password'), 'a-good-master-pw-1!');
        await user.type(screen.getByLabelText('Confirm Master Password'), 'a-good-master-pw-1!');
        await user.click(screen.getByRole('button', { name: /Create Free Vault/ }));
        await vi.waitFor(() => expect(signUp).toHaveBeenCalled());
        expect(localStorage.getItem('passdrop.token')).toBeNull();
        expect(getPendingRecoveryKey()).toBeNull();
        expect(screen.queryByText('THE VAULT')).toBeNull();
    });

    it('refuses a master password shorter than 12 characters without asking the server', async () => {
        signUp.mockClear();
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={['/signup']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes><Route path="/signup" element={<Signup />} /></Routes>
            </MemoryRouter>
        );
        await user.type(screen.getByLabelText('Full Name / Username'), 'Jane');
        await user.type(screen.getByLabelText('Email address'), 'jane@example.com');
        await user.type(screen.getByLabelText('Master Password'), 'short-pw-11');
        await user.type(screen.getByLabelText('Confirm Master Password'), 'short-pw-11');
        await user.click(screen.getByRole('button', { name: /Create Free Vault/ }));
        expect(await screen.findByText('Use at least 12 characters')).toBeTruthy();
        expect(signUp).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Show passwords' })).toBeTruthy();
    });
});
