import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Drop from './Drop';
import { BAD_LINK } from '../lib/dropApi';
import { toLinkKey } from '../lib/drop';
import { encryptItem, exportVaultKey, newVaultKey } from '../lib/vaultCrypto';

const item = { title: 'GitHub', url: 'github.com', username: 'octocat', password: 'S3cret-pw!', notes: 'two factor is off' };
const NOW = '2026-01-01T12:00:00.000Z';
let linkKey, blob, rule, openReply;

// a stand-in server: the lookup (GET) and the open (POST) answer from `rule`, which a test can change
beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    const shareKey = await newVaultKey();
    linkKey = toLinkKey(await exportVaultKey(shareKey));
    blob = await encryptItem(shareKey, item);
    rule = { mode: 'views', viewsLeft: 3, now: NOW };
    openReply = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        const reply = (status, json) => ({ ok: status < 400, status, json: async () => json });
        if (!rule) return reply(404, { success: false });
        if (options.method === 'POST') {
            if (openReply) return openReply;
            const after = rule.mode === 'views' ? { viewsLeft: rule.viewsLeft - 1 } : {};
            return reply(200, { blob, ...rule, ...after, expiresAt: rule.expiresAt, now: NOW });
        }
        return reply(200, rule);
    }));
});

const at = (path) => render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/drop/:id" element={<Drop />} /></Routes>
    </MemoryRouter>
);
const url = (calls, method) => calls.filter(([, o]) => (o?.method || 'GET') === method).map(([u]) => u);

describe('Drop', () => {
    it('looks at what is left on arrival and opens nothing until Reveal is pressed, so a link preview cannot use up a view', async () => {
        at(`/drop/ID-1#${linkKey}`);
        expect(screen.getByText('Someone dropped a login for you')).toBeTruthy();
        expect(await screen.findByText('3 views left')).toBeTruthy(); // the lookup answered
        expect(url(fetch.mock.calls, 'GET')).toEqual(['http://api.test/api/drops/ID-1']);
        expect(url(fetch.mock.calls, 'POST')).toEqual([]);
        expect(JSON.stringify(fetch.mock.calls)).not.toContain(linkKey);
    });

    it('Reveal opens the drop with no sign-in and shows the login, with the password hidden until shown', async () => {
        const user = userEvent.setup();
        at(`/drop/ID-1#${linkKey}`);
        await screen.findByText('3 views left');
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('GitHub')).toBeTruthy();
        const [open, options] = fetch.mock.calls.find(([, o]) => o?.method === 'POST');
        expect(open).toBe('http://api.test/api/drops/ID-1/open');
        expect(options.headers).toBeUndefined(); // no token: the recipient has no account
        expect(JSON.stringify(fetch.mock.calls)).not.toContain(linkKey); // the key never goes to the server
        expect(screen.getByText('octocat')).toBeTruthy();
        expect(screen.getByText('two factor is off')).toBeTruthy();
        expect(screen.queryByText('S3cret-pw!')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Show Password' }));
        expect(screen.getByText('S3cret-pw!')).toBeTruthy();
        expect(screen.getByText('2 views left. That one was used.')).toBeTruthy(); // 3 drops, one used
        expect(document.querySelectorAll('.drop-glyph')).toHaveLength(3);
        expect(document.querySelectorAll('.drop-glyph.is-full')).toHaveLength(2);
    });

    it('says it was the last view when it was', async () => {
        rule = { mode: 'views', viewsLeft: 1, now: NOW };
        const user = userEvent.setup();
        at(`/drop/ID-1#${linkKey}`);
        await user.click(await screen.findByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('That was the last view.')).toBeTruthy();
        expect(screen.getByText('octocat')).toBeTruthy(); // their own view: the login stays
    });

    it('copies the password', async () => {
        const user = userEvent.setup();
        const write = vi.spyOn(navigator.clipboard, 'writeText');
        at(`/drop/ID-1#${linkKey}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        await user.click(await screen.findByRole('button', { name: 'Copy Password' }));
        expect(write).toHaveBeenCalledWith('S3cret-pw!');
    });

    it('says so when the browser would not copy, instead of failing silently', async () => {
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
        at(`/drop/ID-1#${linkKey}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        await user.click(await screen.findByRole('button', { name: 'Copy Password' }));
        expect(await screen.findByText(/would not copy it/)).toBeTruthy();
    });

    it('says the drop is gone at once when it had already ended, with nothing to reveal', async () => {
        rule = null;
        at(`/drop/ID-1#${linkKey}`);
        expect(await screen.findByText('This drop is gone')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reveal login' })).toBeNull();
        expect(url(fetch.mock.calls, 'POST')).toEqual([]);
    });

    it('says the drop is gone when it ended after the page loaded (someone took the last view)', async () => {
        const user = userEvent.setup();
        at(`/drop/ID-1#${linkKey}`);
        await screen.findByText('3 views left');
        openReply = { ok: false, status: 404, json: async () => ({ success: false }) };
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('This drop is gone')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reveal login' })).toBeNull();
    });

    it('still lets them reveal when the lookup fails, and just leaves the rule out', async () => {
        fetch.mockRejectedValueOnce(new Error('offline')); // the lookup
        const user = userEvent.setup();
        at(`/drop/ID-1#${linkKey}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('octocat')).toBeTruthy();
        expect(document.querySelectorAll('.drop-glyph.is-full')).toHaveLength(2); // the open says 2 are left (and 1 was just used)
    });

    it('does not even offer to open a link whose key is missing or cut short', () => {
        for (const path of ['/drop/ID-1', '/drop/ID-1#abc']) {
            const { unmount } = at(path);
            expect(screen.getByText('This link is incomplete')).toBeTruthy();
            expect(screen.queryByRole('button', { name: 'Reveal login' })).toBeNull();
            unmount();
        }
        expect(fetch).not.toHaveBeenCalled();
    });

    it('says the link was changed when the key is not the right one, and lets them try again', async () => {
        const user = userEvent.setup();
        at(`/drop/ID-1#${'A'.repeat(43)}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText(BAD_LINK)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Reveal login' })).toBeTruthy();
    });
});

describe('Drop with a timer', () => {
    // fake clocks, so minutes can be skipped; the user-event clicks keep working because they advance the clock too
    const clocked = async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.parse(NOW) });
        return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    };
    const wait = async (seconds) => { for (let i = 0; i < seconds; i += 1) await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); };
    const timer = (seconds) => ({ mode: 'timer', createdAt: '2026-01-01T11:50:00.000Z', expiresAt: new Date(Date.parse(NOW) + seconds * 1000).toISOString(), now: NOW });
    afterEach(() => vi.useRealTimers());

    it('shows the time left, counted on the server\'s clock, and counts down', async () => {
        rule = timer(3 * 3600 + 20 * 60);
        await clocked();
        at(`/drop/ID-1#${linkKey}`);
        expect(await screen.findByText('Ends in 3 h 20 min')).toBeTruthy();
        await wait(61);
        expect(screen.getByText('Ends in 3 h 19 min')).toBeTruthy(); // 3 h 18 min 59 s, rounded up
    });

    it('opening a timer drop uses nothing: it shows the login and keeps counting', async () => {
        rule = timer(1800);
        const user = await clocked();
        at(`/drop/ID-1#${linkKey}`);
        await user.click(await screen.findByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('octocat')).toBeTruthy();
        expect(screen.getByText(/Opening this link again costs nothing until it ends/)).toBeTruthy();
        expect(screen.getByText(/Ends in 30 min|Ends in 29 min/)).toBeTruthy();
    });

    it('when the time is up before Reveal, the card says so and there is nothing to reveal', async () => {
        rule = timer(3);
        await clocked();
        at(`/drop/ID-1#${linkKey}`);
        expect(await screen.findByText(/Ends in 3 s|Ends in 2 s/)).toBeTruthy(); // never "0 min"
        await wait(4);
        expect(await screen.findByText('This drop is gone')).toBeTruthy();
        expect(screen.getByText('Its time was up. Ask the sender for a new one.')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reveal login' })).toBeNull();
    });

    it('when the time is up with the login open, the login is cleared from the page', async () => {
        rule = timer(5);
        const user = await clocked();
        at(`/drop/ID-1#${linkKey}`);
        await user.click(await screen.findByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('octocat')).toBeTruthy();
        await wait(6);
        expect(await screen.findByText('The time is up')).toBeTruthy();
        expect(screen.queryByText('octocat')).toBeNull();
        expect(screen.queryByText('two factor is off')).toBeNull();
    });

    it('never asks the server again on a timer: only when it arrives, when Reveal is pressed, and when the tab is looked at', async () => {
        rule = timer(3600);
        await clocked();
        at(`/drop/ID-1#${linkKey}`);
        await screen.findByText('Ends in 1 h');
        await wait(120);
        expect(fetch).toHaveBeenCalledTimes(1); // the lookup on arrival, and nothing in two minutes
    });
});

describe('Drop left open', () => {
    it('looks again when the tab is looked at (not more often than every 30 seconds) and notices the drop has ended', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.parse(NOW) });
        try {
            at(`/drop/ID-1#${linkKey}`);
            await screen.findByText('3 views left');
            expect(fetch).toHaveBeenCalledTimes(1);

            rule = null; // someone else took the last view
            act(() => { window.dispatchEvent(new Event('focus')); }); // too soon after the first look
            expect(fetch).toHaveBeenCalledTimes(1);

            await act(async () => { await vi.advanceTimersByTimeAsync(31000); });
            act(() => { window.dispatchEvent(new Event('focus')); });
            expect(await screen.findByText('This drop is gone')).toBeTruthy();
            expect(fetch).toHaveBeenCalledTimes(2);
        } finally { vi.useRealTimers(); }
    });

    it('shows the fewer views left when it looks again and someone has used one', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true, now: Date.parse(NOW) });
        try {
            at(`/drop/ID-1#${linkKey}`);
            await screen.findByText('3 views left');
            rule = { mode: 'views', viewsLeft: 1, now: NOW };
            await act(async () => { await vi.advanceTimersByTimeAsync(31000); });
            act(() => { window.dispatchEvent(new Event('focus')); });
            expect(await screen.findByText('1 view left')).toBeTruthy();
        } finally { vi.useRealTimers(); }
    });
});
