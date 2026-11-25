import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Manager from './Manager';
import PasswordState from '../context/PasswordState';
import toast from 'react-hot-toast';
import { lock, saveSignIn, saveVaultKey } from '../lib/session';
import { deriveKeys, encryptItem, newVaultKey, wrapVaultKey } from '../lib/vaultCrypto';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// the water animation needs a real browser; the vault only asks it whether an entrance is queued
vi.mock('../context/useTide', () => ({ useTide: () => ({ peekEntrance: () => false, release() {}, finishEntrance() {} }) }));

const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
const github = { title: 'GitHub', url: 'github.com', username: 'me', password: 'pw-1', notes: '', isFavorite: false };
let vaultKey, passwordsFetched, liveDrops, pastDrops, revoked, deleted, drop;

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
    revoked = [];
    deleted = [];
    // two links made from GitHub and one from Mail
    // (the server sends each link's login id in the clear, and the title inside the encrypted label)
    drop = async (id, login, title) => ({ id, login, label: await encryptItem(vaultKey, { title }, 'user-1'), mode: 'views', viewsLeft: 2, expiresAt: '2030-01-01T00:00:00Z', createdAt: '2026-11-22T14:05:00Z' });
    liveDrops = [await drop('D1', 'a', 'GitHub'), await drop('D2', 'a', 'GitHub'), await drop('D3', 'c', 'Mail')];
    // one link made from GitHub that was used up earlier
    pastDrops = [{ id: 'P1', login: 'a', label: await encryptItem(vaultKey, { title: 'GitHub', name: 'For Sam' }, 'user-1'), mode: 'views', createdAt: '2026-11-18T10:00:00Z', endedAt: '2026-11-18T10:05:00Z', reason: 'used', opens: 1 }];
    const reply = (json) => ({ ok: true, status: 200, json: async () => json });
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        if (url.includes('/api/drops')) {
            if (url.endsWith('/api/drops/history')) return reply(pastDrops);
            if (options.method === 'DELETE') { const id = url.split('/').pop(); revoked.push(id); liveDrops = liveDrops.filter((d) => d.id !== id); return reply({ success: true }); }
            return reply(liveDrops);
        }
        if (options.method === 'PUT') return reply({ _id: url.split('/').pop(), blob: JSON.parse(options.body).blob, createdAt: 'c', updatedAt: 'u' });
        if (options.method === 'DELETE') { // deleting a login: the server ends its links with it
            deleted.push(url.split('/').pop());
            liveDrops = liveDrops.filter((d) => d.login !== url.split('/').pop());
            return reply({ success: true });
        }
        if (url.endsWith('/api/passwords')) passwordsFetched += 1;
        return reply(url.endsWith('/api/auth/me') ? me : records);
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
    });});

describe('shared links', () => {
    it('lists a link that has no login (made in an earlier version) by itself, so nothing is counted that cannot be seen', async () => {
        const user = userEvent.setup();
        liveDrops.push(await drop('D4', undefined, 'Old login'));
        await saveVaultKey(vaultKey);
        show();
        const chip = await screen.findByRole('button', { name: 'Dropped (3)' }); // GitHub, Mail, and the link without a login
        await user.click(chip);
        expect(await screen.findByText('Drops without a login (1)')).toBeTruthy();
        const row = screen.getByText(/From Old login/).closest('li');
        expect(row.textContent).toMatch(/Dropped .* · 2 views left/); // who, when, what is left
        expect(revoked).toEqual([]); // nothing is revoked on its own or in bulk
        await user.click(within(row).getByRole('button', { name: 'Revoke' }));
        await user.click(await within(row).findByRole('button', { name: 'Revoke now' }));
        await waitFor(() => expect(revoked).toEqual(['D4']));
        await waitFor(() => expect(screen.queryByText(/Drops without a login/)).toBeNull());
        expect(screen.getByRole('button', { name: 'Dropped (2)' })).toBeTruthy();
    });

    it('shows a badge on a login that has links, and a Dropped filter that lists only those logins', async () => {
        const user = userEvent.setup();
        await saveVaultKey(vaultKey);
        show();
        expect(await screen.findByRole('button', { name: 'Dropped (2)' })).toBeTruthy(); // GitHub and Mail
        expect(await screen.findByLabelText('2 drops')).toBeTruthy();
        expect(screen.getByLabelText('1 drop')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Dropped (2)' }));
        expect(screen.getByText('Accounts with Drops')).toBeTruthy();
        await waitFor(() => expect(screen.getByText('2 items')).toBeTruthy());
        await waitFor(() => expect(screen.queryByText('This login could not be decrypted')).toBeNull()); // after its exit animation
    });

    it('closes the Drop dialog when the vault locks, so the login it holds does not stay in memory', async () => {
        const user = userEvent.setup();
        await saveVaultKey(vaultKey);
        show();
        await user.click(await screen.findByRole('button', { name: 'Drop' }));
        expect(await screen.findByRole('dialog')).toBeTruthy();
        act(() => lock());
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('says what an empty Dropped or Favorites filter is for, instead of calling the vault empty', async () => {
        const user = userEvent.setup();
        liveDrops = [];
        await saveVaultKey(vaultKey);
        show();
        await user.click(await screen.findByRole('button', { name: 'Dropped (0)' }));
        expect(await screen.findByText('No logins have a drop')).toBeTruthy();
        expect(screen.queryByText('Your vault is empty')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add Account' })).toBeNull(); // adding a login does not fill this filter
        await user.click(screen.getByRole('button', { name: 'Favorites (0)' }));
        expect(await screen.findByText('No favorites yet')).toBeTruthy();
    });

    it('lists the links of a login in its own panel, and Revoke ends one', async () => {
        const user = userEvent.setup();
        await saveVaultKey(vaultKey);
        show();
        expect(await screen.findByText('Drops (2)')).toBeTruthy(); // GitHub is selected first
        await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0]);
        expect(revoked).toEqual([]); // one click only asks
        await user.click(await screen.findByRole('button', { name: 'Revoke now' }));
        expect(await screen.findByText('Drops (1)')).toBeTruthy();
        expect(revoked).toHaveLength(1);
    });

    it('keeps the links that ended in a folded "Past links" list on the login they were made from', async () => {
        const user = userEvent.setup();
        await saveVaultKey(vaultKey);
        show();
        await user.click(await screen.findByRole('button', { name: 'Past drops (1)' })); // GitHub is selected first
        const row = screen.getByText('For Sam').closest('li');
        expect(row.textContent).toMatch(/Used up .*opened 1 time/);
    });

    describe('editing a login that has links', () => {
        const edit = async (user, password) => {
            await screen.findByText('Drops (2)');
            await user.click(screen.getByRole('button', { name: 'Edit' }));
            if (password) {
                const field = screen.getByPlaceholderText('Enter account password');
                await user.clear(field);
                await user.type(field, password);
            }
            await user.click(screen.getByRole('button', { name: 'Update Account' }));
        };

        it('says its links still show the old details when the edit changes what a link shows', async () => {
            const user = userEvent.setup();
            toast.mockClear();
            await saveVaultKey(vaultKey);
            show();
            await edit(user, 'a-new-password-1');
            await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringMatching(/2 drops still show the old details/), expect.anything()));
        });

        it('says nothing when the edit leaves what a link shows unchanged', async () => {
            const user = userEvent.setup();
            toast.mockClear();
            await saveVaultKey(vaultKey);
            show();
            await edit(user, null);
            await waitFor(() => expect(toast.success).toHaveBeenCalled());
            expect(toast).not.toHaveBeenCalled();
        });
    });

    it('keeps the edit dialog and what was typed when the save fails, and closes it when the save works', async () => {
        const user = userEvent.setup();
        await saveVaultKey(vaultKey);
        show();
        await screen.findByText('Drops (2)');
        const working = fetch.getMockImplementation();
        fetch.mockImplementation((url, options) => (options?.method === 'PUT' ? Promise.reject(new Error('offline')) : working(url, options)));
        await user.click(screen.getByRole('button', { name: 'Edit' }));
        const field = screen.getByPlaceholderText('Enter account password');
        await user.clear(field);
        await user.type(field, 'typed-and-not-lost');
        await user.click(screen.getByRole('button', { name: 'Update Account' }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to connect to server'));
        expect(screen.getByPlaceholderText('Enter account password').value).toBe('typed-and-not-lost');

        fetch.mockImplementation(working);
        await user.click(screen.getByRole('button', { name: 'Update Account' }));
        await waitFor(() => expect(screen.queryByPlaceholderText('Enter account password')).toBeNull());
    });

    it('deleting a login says its links stop working, leaves ending them to the server, and the counts follow', async () => {
        const user = userEvent.setup();
        await saveVaultKey(vaultKey);
        show();
        await screen.findByText('Drops (2)');
        await user.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1)); // the panel's, after the list's own row
        expect(screen.getByText(/Its drops will stop working/)).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Yes, Delete' }));
        await waitFor(() => expect(deleted).toEqual(['a']));
        expect(revoked).toEqual([]); // the page no longer revokes by itself: a failed request could have left a link behind
        expect(await screen.findByRole('button', { name: 'Dropped (1)' })).toBeTruthy(); // only Mail's link is left
    });
});
