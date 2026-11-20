import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import toast from 'react-hot-toast';
import Login from './Login';
import { signIn } from '../lib/accountApi';
import { getVaultKey } from '../lib/session';
import { newVaultKey } from '../lib/vaultCrypto';

// the host comes from VITE_BACKEND, which only a developer's ignored frontend/.env sets: pin it so the test passes anywhere
beforeEach(() => vi.stubEnv('VITE_BACKEND', 'http://api.test'));

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../lib/accountApi', () => ({ signIn: vi.fn() }));
// the water animation needs a real browser; every step just resolves
vi.mock('../context/useTide', () => ({
    useTide: () => ({ begin() {}, abort() {}, shake() {}, leave() {}, queueEntrance() {}, cancel: async () => {}, complete: async () => {} })
}));

async function submit(user) {
    render(
        <MemoryRouter initialEntries={['/login']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes><Route path="/login" element={<Login />} /><Route path="/" element={<p>THE VAULT</p>} /></Routes>
        </MemoryRouter>
    );
    await user.type(screen.getByLabelText('Email address'), 'me@example.com');
    await user.type(screen.getByLabelText('Master Password'), 'hunter2-hunter2');
    await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
}

describe('Login', () => {
    it('a wrong password shows the error and stores nothing', async () => {
        signIn.mockResolvedValue({ ok: false, errors: ['Please login with valid credentials'] });
        await submit(userEvent.setup());
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Please login with valid credentials'));
        expect(localStorage.getItem('passdrop.token')).toBeNull();
        expect(await getVaultKey()).toBeNull();
        expect(screen.queryByText('THE VAULT')).toBeNull();
    });

    it('signing in stores the token, user id and vault key, then opens the vault', async () => {
        signIn.mockResolvedValue({ ok: true, token: 'tok', userId: 'user-1', vaultKey: await newVaultKey() });
        await submit(userEvent.setup());
        expect(await screen.findByText('THE VAULT')).toBeTruthy();
        expect(signIn).toHaveBeenCalledWith('http://api.test', { email: 'me@example.com', password: 'hunter2-hunter2' });
        expect(localStorage.getItem('passdrop.token')).toBe('tok');
        expect(localStorage.getItem('passdrop.userId')).toBe('user-1');
        expect(await getVaultKey()).not.toBeNull();
    });

    it('links to the recovery page', () => {
        render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Login /></MemoryRouter>);
        expect(screen.getByRole('link', { name: /Forgot it/ }).getAttribute('href')).toBe('/recover');
    });
});
