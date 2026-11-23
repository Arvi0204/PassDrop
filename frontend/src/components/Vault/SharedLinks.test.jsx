import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SharedLinks from './SharedLinks';
import { fingerprintOf } from '../../lib/drop';
import { saveSignIn } from '../../lib/session';

const drops = [
    { id: 'D2', name: 'For Priya', mode: 'timer', viewsLeft: undefined, createdAt: '2026-11-22T14:05:00Z', expiresAt: new Date(Date.now() + 3 * 3600000 + 60000).toISOString() },
    { id: 'D1', name: '', mode: 'views', viewsLeft: 2, createdAt: '2026-11-21T09:30:00Z', expiresAt: '2030-01-01T00:00:00Z' }
];
let calls;

beforeEach(() => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    saveSignIn({ token: 'tok-1', userId: 'user-1' });
    calls = [];
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        calls.push(`${options.method} ${url.replace('http://api.test', '')}`);
        return { ok: true, status: 200, json: async () => ({ success: true }) };
    }));
});

describe('SharedLinks', () => {
    it('shows nothing for a login with no links', () => {
        const { container } = render(<SharedLinks drops={[]} onChanged={() => {}} />);
        expect(container.textContent).toBe('');
    });

    it('tells the links apart by the name the sender gave, when it was made, and what is left', () => {
        render(<SharedLinks drops={drops} onChanged={() => {}} />);
        expect(screen.getByText('Shared links (2)')).toBeTruthy();
        expect(screen.getByText('For Priya')).toBeTruthy();
        expect(screen.getByText('Unnamed link')).toBeTruthy(); // a link made without a name
        const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
        expect(screen.getByText(new RegExp(`Shared ${when('2026-11-22T14:05:00Z')} · ends in 3 h`))).toBeTruthy();
        expect(screen.getByText(new RegExp(`Shared ${when('2026-11-21T09:30:00Z')} · 2 views left`))).toBeTruthy();
    });

    describe('a login edited after it was shared', () => {
        const login = { title: 'GitHub', url: 'github.com', username: 'octo', password: 'pw', notes: '' };

        it('marks the links made before the edit, and not the ones that still match', async () => {
            const [fresh, stale] = [await fingerprintOf(login), await fingerprintOf({ ...login, password: 'old' })];
            render(<SharedLinks item={login} drops={[{ ...drops[0], fp: stale }, { ...drops[1], fp: fresh }]} onChanged={() => {}} />);
            expect(await screen.findAllByText(/edited after you shared this link/)).toHaveLength(1);
        });

        it('says nothing for a link made before details were tracked, or when the favourite star changes', async () => {
            const fp = await fingerprintOf(login);
            render(<SharedLinks item={{ ...login, isFavorite: true }} drops={[{ ...drops[0], fp: '' }, { ...drops[1], fp }]} onChanged={() => {}} />);
            await waitFor(() => expect(screen.getByText('Shared links (2)')).toBeTruthy());
            await new Promise((resolve) => setTimeout(resolve, 20)); // let the fingerprint settle
            expect(screen.queryByText(/edited after you shared/)).toBeNull();
        });
    });

    it('can list links that have no login, under their own heading and saying which login each came from', () => {
        render(<SharedLinks drops={[{ ...drops[1], title: 'Old login' }]} onChanged={() => {}} heading="Links without a login" showTitle />);
        expect(screen.getByText('Links without a login (1)')).toBeTruthy();
        expect(screen.getByText(/From Old login · Shared/)).toBeTruthy();
    });

    describe('past links', () => {
        const past = [
            { id: 'P1', name: 'For Sam', createdAt: '2026-11-18T10:00:00Z', endedAt: '2026-11-18T10:05:00Z', reason: 'used', opens: 1 },
            { id: 'P2', name: '', createdAt: '2026-11-15T10:00:00Z', endedAt: '2026-11-16T09:00:00Z', reason: 'revoked', opens: 0 },
            { id: 'P3', name: 'Old', createdAt: '2026-11-10T10:00:00Z', endedAt: '2026-11-11T10:00:00Z', reason: 'expired', opens: 4 }
        ];

        it('are folded away until asked for, and say how each ended and how often it was opened', async () => {
            const user = userEvent.setup();
            render(<SharedLinks drops={[]} past={past} onChanged={() => {}} />);
            expect(screen.queryByText('For Sam')).toBeNull();
            expect(screen.queryByText(/Shared links/)).toBeNull(); // no live links: no live heading
            await user.click(screen.getByRole('button', { name: 'Past links (3)' }));
            expect(screen.getByText('For Sam')).toBeTruthy();
            const row = (name) => screen.getByText(name).closest('li').textContent;
            expect(row('For Sam')).toMatch(/Used up .*opened 1 time$/);
            expect(row('Unnamed link')).toMatch(/Revoked .*never opened$/);
            expect(row('Old')).toMatch(/Expired .*opened 4 times$/);
            expect(screen.getByText(/kept for 30 days/)).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull(); // nothing to revoke: they are over
            await user.click(screen.getByRole('button', { name: 'Past links (3)' }));
            expect(screen.queryByText('For Sam')).toBeNull();
        });

        it('show under the live links of the same login', () => {
            render(<SharedLinks drops={drops} past={past} onChanged={() => {}} />);
            expect(screen.getByText('Shared links (2)')).toBeTruthy();
            expect(screen.getByRole('button', { name: 'Past links (3)' })).toBeTruthy();
        });
    });

    describe('copying a live link again', () => {
        const KEY = 'K'.repeat(43);
        const live = [{ ...drops[0], key: KEY }, { ...drops[1], key: '' }]; // the second was made before the key was kept

        it('copies the whole link (this address, the drop and its key) from a link that has its key', async () => {
            const user = userEvent.setup();
            const write = vi.spyOn(navigator.clipboard, 'writeText');
            render(<SharedLinks drops={live} onChanged={() => {}} />);
            const buttons = screen.getAllByRole('button', { name: 'Copy link' });
            expect(buttons).toHaveLength(1); // only the link that has its key
            await user.click(buttons[0]);
            expect(write).toHaveBeenCalledWith(`${window.location.origin}/drop/D2#${KEY}`);
            expect(await screen.findByRole('button', { name: 'Copied' })).toBeTruthy();
            expect(calls).toEqual([]); // copying asks the server for nothing
        });

        it('says so on a link made before the key was kept, and offers no button for it', () => {
            render(<SharedLinks drops={live} onChanged={() => {}} />);
            expect(screen.getAllByText(/Made before a link could be copied again/)).toHaveLength(1);
        });

        it('says when the browser would not copy', async () => {
            const user = userEvent.setup();
            vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
            render(<SharedLinks drops={live} onChanged={() => {}} />);
            await user.click(screen.getByRole('button', { name: 'Copy link' }));
            expect(await screen.findByRole('alert')).toBeTruthy();
        });
    });

    it('revokes only after a second click, then tells the vault to reload', async () => {
        const user = userEvent.setup();
        const onChanged = vi.fn();
        render(<SharedLinks drops={drops} onChanged={onChanged} />);
        await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0]);
        expect(calls).toEqual([]); // one click only asks
        await user.click(screen.getByRole('button', { name: 'Revoke now' }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
        expect(calls).toEqual(['DELETE /api/drops/D2']);
    });

    it('Keep backs out without revoking', async () => {
        const user = userEvent.setup();
        render(<SharedLinks drops={drops} onChanged={() => {}} />);
        await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0]);
        await user.click(screen.getByRole('button', { name: 'Keep' }));
        expect(calls).toEqual([]);
        expect(screen.getAllByRole('button', { name: 'Revoke' })).toHaveLength(2);
    });

    it('shows the refusal when a revoke fails', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'This drop is gone' }) });
        const user = userEvent.setup();
        render(<SharedLinks drops={drops} onChanged={() => {}} />);
        await user.click(screen.getAllByRole('button', { name: 'Revoke' })[0]);
        await user.click(screen.getByRole('button', { name: 'Revoke now' }));
        expect(await screen.findByRole('alert')).toBeTruthy();
    });
});
