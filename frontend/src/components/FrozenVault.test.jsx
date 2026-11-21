import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import FrozenVault from './FrozenVault';
import { POOL_MAX } from '../lib/frost';
import PasswordState from '../context/PasswordState';
import { saveSignIn } from '../lib/session';
import { deriveKeys, newVaultKey, wrapVaultKey } from '../lib/vaultCrypto';

// the water needs a real browser; these tests check when the vault asks for it
const tide = vi.hoisted(() => ({
    rise: vi.fn(), complete: vi.fn(async () => {}), cancel: vi.fn(), abort: vi.fn(), release: vi.fn(),
    queueEntrance: vi.fn(), peekEntrance: vi.fn(() => false)
}));
vi.mock('../context/useTide', () => ({ useTide: () => tide }));

const KDF = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    saveSignIn({ token: 'tok-1', userId: 'user-1' });
    const { wrapKey } = await deriveKeys('the-master-pw', KDF);
    const me = { kdf: KDF, wrappedVaultKey: await wrapVaultKey(await newVaultKey(), wrapKey) };
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => me })));
    Object.values(tide).forEach((fn) => fn.mockClear());
    tide.peekEntrance.mockReturnValue(false);
});

const show = (props = {}) =>
    render(
        <PasswordState>
            <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <FrozenVault unlocked={false} onGone={() => {}} {...props} />
            </MemoryRouter>
        </PasswordState>
    );

describe('FrozenVault', () => {
    it('shows the card with the new wording and keeps the water down until the first key', async () => {
        const user = userEvent.setup();
        show();
        expect(screen.getByText('Vault frozen')).toBeTruthy();
        expect(tide.rise).not.toHaveBeenCalled();
        await user.type(screen.getByLabelText('Master Password'), 'abc');
        expect(tide.rise).toHaveBeenCalledTimes(3);
    });

    it('the water climbs with every key, stops at its cap, and typing or deleting never lowers it', async () => {
        const user = userEvent.setup();
        show();
        const input = screen.getByLabelText('Master Password');
        await user.type(input, 'abcdefghijklmnopqrst'); // more keys than it takes to reach the cap
        const levels = tide.rise.mock.calls.map(([level]) => level);
        expect(levels[0]).toBeGreaterThan(0);
        expect(levels[0]).toBeLessThan(0.1); // one key is a small step, not a third of the screen
        expect(levels).toEqual([...levels].sort((a, b) => a - b)); // only ever up
        expect(Math.max(...levels)).toBeLessThanOrEqual(POOL_MAX);
        expect(levels.at(-1)).toBe(POOL_MAX);
        const calls = tide.rise.mock.calls.length;
        await user.clear(input);
        await user.type(input, 'a');
        expect(tide.rise.mock.calls.length).toBe(calls); // nothing higher to raise it to
    });

    it('a wrong password leaves the water up (it must not read as signing out) and queues no entrance', async () => {
        const user = userEvent.setup();
        show();
        await user.type(screen.getByLabelText('Master Password'), 'not-it');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        await screen.findByText('That is not your master password.');
        expect(tide.cancel).not.toHaveBeenCalled();
        expect(tide.abort).not.toHaveBeenCalled();
        expect(tide.queueEntrance).not.toHaveBeenCalled();
    });

    it('the right password queues the entrance before the vault key is stored', async () => {
        const user = userEvent.setup();
        const order = [];
        tide.queueEntrance.mockImplementation(() => order.push(sessionStorage.getItem('passdrop.vaultKey') ? 'stored' : 'queued'));
        show();
        await user.type(screen.getByLabelText('Master Password'), 'the-master-pw');
        await user.click(screen.getByRole('button', { name: /Unlock Vault/ }));
        await waitFor(() => expect(tide.queueEntrance).toHaveBeenCalled());
        expect(order).toEqual(['queued']);
    });

    it('once unlocked it floods the water (when an entrance is queued) and then reports it is gone', async () => {
        tide.peekEntrance.mockReturnValue(true);
        const onGone = vi.fn();
        const { rerender } = show({ onGone });
        rerender(
            <PasswordState>
                <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <FrozenVault unlocked onGone={onGone} />
                </MemoryRouter>
            </PasswordState>
        );
        await waitFor(() => expect(onGone).toHaveBeenCalled());
        expect(tide.complete).toHaveBeenCalled();
        expect(tide.release).not.toHaveBeenCalled(); // the vault page releases it as the logins surface
    });

    it('leaving while the water is up clears it', async () => {
        const user = userEvent.setup();
        const { unmount } = show();
        await user.type(screen.getByLabelText('Master Password'), 'a');
        unmount();
        expect(tide.abort).toHaveBeenCalled();
    });
});
