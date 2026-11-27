import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShareDropModal from './ShareDropModal';
import { saveSignIn, saveVaultKey } from '../lib/session';
import { newVaultKey } from '../lib/vaultCrypto';
import { keyFromHash } from '../lib/drop';

const item = { _id: 'p1', title: 'GitHub', url: 'github.com', username: 'octocat', password: 'S3cret-pw!', notes: '' };
let posted;

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    saveSignIn({ token: 'tok-1', userId: 'user-1' });
    await saveVaultKey(await newVaultKey());
    posted = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options) => {
        posted = { url, options, body: JSON.parse(options.body) };
        return { ok: true, status: 201, json: async () => ({ id: 'ID-1', mode: posted.body.mode, viewsLeft: posted.body.views, expiresAt: '2030-01-01T00:00:00Z' }) };
    }));
});

const open = () => render(<ShareDropModal item={item} onClose={() => {}} />);

describe('ShareDropModal', () => {
    it('makes a one-view link by default and shows it, with the key only in the #fragment', async () => {
        const user = userEvent.setup();
        open();
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        const link = (await screen.findByLabelText('Drop link')).value;
        expect(posted.body).toMatchObject({ mode: 'views', views: 1 });
        expect(posted.options.headers['auth-token']).toBe('tok-1');
        expect(link).toMatch(/\/drop\/ID-1#/);
        const key = keyFromHash(new URL(link).hash);
        expect(key).toBeTruthy();
        expect(posted.options.body).not.toContain(key);
        expect(posted.options.body).not.toContain('S3cret-pw!');
        expect(screen.getByText(/copy it again, or revoke it, any time under Drops/)).toBeTruthy(); // nothing is lost by closing
    });

    it('lets the sender name the link, and the name is sent only inside the encrypted label', async () => {
        const user = userEvent.setup();
        open();
        await user.type(screen.getByLabelText(/Name this drop/), 'For Priya');
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        await screen.findByLabelText('Drop link');
        expect(posted.options.body).not.toContain('Priya');
    });

    it('tells the vault a link was made, so it can show it next to the login', async () => {
        const user = userEvent.setup();
        const onMade = vi.fn();
        render(<ShareDropModal item={item} onClose={() => {}} onMade={onMade} />);
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        await screen.findByLabelText('Drop link');
        expect(onMade).toHaveBeenCalledTimes(1);
    });

    it('chooses a number of views or a timer, never both', async () => {
        const user = userEvent.setup();
        open();
        await user.click(screen.getByRole('button', { name: '5 views' }));
        await user.click(screen.getByRole('button', { name: 'After a time' }));
        expect(screen.queryByRole('button', { name: '5 views' })).toBeNull(); // the view choices are gone
        await user.click(screen.getByRole('button', { name: '24 hours' }));
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        await screen.findByLabelText('Drop link');
        expect(posted.body).toMatchObject({ mode: 'timer', ttl: 86400 });
        expect(posted.body.views).toBeUndefined();
    });

    it('copies the link', async () => {
        const user = userEvent.setup(); // gives the page a clipboard
        const write = vi.spyOn(navigator.clipboard, 'writeText');
        open();
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        const link = (await screen.findByLabelText('Drop link')).value;
        await user.click(screen.getByRole('button', { name: 'Copy link and close' }));
        expect(write).toHaveBeenCalledWith(link);
    });

    describe('closing the dialog once the link is made', () => {
        // fake clocks, so the 2 seconds can be skipped; the user-event clicks keep working because they advance the clock too
        const made = async (onClose) => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            render(<ShareDropModal item={item} onClose={onClose} />);
            await user.click(screen.getByRole('button', { name: 'Create drop' }));
            await screen.findByLabelText('Drop link');
            return user;
        };
        afterEach(() => vi.useRealTimers());
        // a second at a time, so each render and its next timer settle before the clock moves on
        const wait = async (seconds) => { for (let i = 0; i < seconds; i += 1) await act(async () => { await vi.advanceTimersByTimeAsync(1000); }); };

        it('the big button copies the link, counts down from 2, and closes the dialog by itself', async () => {
            const onClose = vi.fn();
            const user = await made(onClose);
            const write = vi.spyOn(navigator.clipboard, 'writeText');
            await user.click(screen.getByRole('button', { name: 'Copy link and close' }));
            expect(write).toHaveBeenCalledWith(screen.getByLabelText('Drop link').value);
            expect(screen.getByRole('button', { name: 'Copied. Closing in 2' })).toBeTruthy();
            await wait(1);
            expect(screen.getByRole('button', { name: 'Copied. Closing in 1' })).toBeTruthy();
            expect(onClose).not.toHaveBeenCalled();
            await wait(1);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('a link copied by hand from the box starts it too', async () => {
            const onClose = vi.fn();
            await made(onClose);
            fireEvent.copy(screen.getByLabelText('Drop link'));
            await wait(2);
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('does not close by itself before the link is copied', async () => {
            const onClose = vi.fn();
            await made(onClose);
            await wait(30);
            expect(onClose).not.toHaveBeenCalled();
        });

        it('a copy the browser refuses does not start it: it says so and stays open', async () => {
            const onClose = vi.fn();
            const user = await made(onClose);
            vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
            await user.click(screen.getByRole('button', { name: 'Copy link and close' }));
            expect(await screen.findByText(/would not copy it/)).toBeTruthy();
            await wait(10);
            expect(onClose).not.toHaveBeenCalled();
        });

        it('has one copy button, and can be closed at any time (Escape, the X, the backdrop), because the link stays in the login\'s Drops', async () => {
            const onClose = vi.fn();
            const user = await made(onClose);
            expect(screen.getAllByRole('button', { name: /copy/i })).toHaveLength(1);
            await user.keyboard('{Escape}');
            expect(onClose).toHaveBeenCalledTimes(1);
            await user.click(screen.getByRole('button', { name: 'Close' }));
            expect(onClose).toHaveBeenCalledTimes(2);
            await user.click(document.querySelector('.backdrop-blur-sm'));
            expect(onClose).toHaveBeenCalledTimes(3);
        });

        it('closes without asking before any link is made', async () => {
            vi.useRealTimers();
            const user = userEvent.setup();
            const onClose = vi.fn();
            render(<ShareDropModal item={item} onClose={onClose} />);
            await user.click(screen.getByRole('button', { name: 'Cancel' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    it('asks to unlock first when the vault is locked, and sends nothing', async () => {
        sessionStorage.clear();
        const user = userEvent.setup();
        open();
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        expect(await screen.findByText('Unlock your vault first.')).toBeTruthy();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('shows the server\'s refusal', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ errors: [{ msg: 'You have 25 live drops. Revoke one to make another.' }] }) });
        const user = userEvent.setup();
        open();
        await user.click(screen.getByRole('button', { name: 'Create drop' }));
        expect(await screen.findByText('You have 25 live drops. Revoke one to make another.')).toBeTruthy();
    });
});

describe('ShareDropModal and the keyboard', () => {
    it('takes focus when it opens and keeps Tab inside it', async () => {
        const user = userEvent.setup();
        render(<><button type="button">Behind the dialog</button><ShareDropModal item={item} onClose={() => {}} /></>);
        const dialog = screen.getByRole('dialog');
        expect(dialog.contains(document.activeElement)).toBe(true);
        for (let i = 0; i < 15; i++) {
            await user.tab();
            expect(dialog.contains(document.activeElement), `Tab ${i + 1}`).toBe(true);
        }
    });
});
