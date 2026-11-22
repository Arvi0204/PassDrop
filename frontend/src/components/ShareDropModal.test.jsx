import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
        await user.click(screen.getByRole('button', { name: 'Create link' }));
        const link = (await screen.findByLabelText('Drop link')).value;
        expect(posted.body).toMatchObject({ mode: 'views', views: 1 });
        expect(posted.options.headers['auth-token']).toBe('tok-1');
        expect(link).toMatch(/\/drop\/ID-1#/);
        const key = keyFromHash(new URL(link).hash);
        expect(key).toBeTruthy();
        expect(posted.options.body).not.toContain(key);
        expect(posted.options.body).not.toContain('S3cret-pw!');
        expect(screen.getByText(/shown only now/)).toBeTruthy();
    });

    it('lets the sender name the link, and the name is sent only inside the encrypted label', async () => {
        const user = userEvent.setup();
        open();
        await user.type(screen.getByLabelText(/Name this link/), 'For Priya');
        await user.click(screen.getByRole('button', { name: 'Create link' }));
        await screen.findByLabelText('Drop link');
        expect(posted.options.body).not.toContain('Priya');
    });

    it('tells the vault a link was made, so it can show it next to the login', async () => {
        const user = userEvent.setup();
        const onMade = vi.fn();
        render(<ShareDropModal item={item} onClose={() => {}} onMade={onMade} />);
        await user.click(screen.getByRole('button', { name: 'Create link' }));
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
        await user.click(screen.getByRole('button', { name: 'Create link' }));
        await screen.findByLabelText('Drop link');
        expect(posted.body).toMatchObject({ mode: 'timer', ttl: 86400 });
        expect(posted.body.views).toBeUndefined();
    });

    it('copies the link', async () => {
        const user = userEvent.setup(); // gives the page a clipboard
        const write = vi.spyOn(navigator.clipboard, 'writeText');
        open();
        await user.click(screen.getByRole('button', { name: 'Create link' }));
        const link = (await screen.findByLabelText('Drop link')).value;
        await user.click(screen.getByRole('button', { name: /Copy link/ }));
        expect(write).toHaveBeenCalledWith(link);
    });

    describe('closing the dialog once the link is made', () => {
        const made = async (user, onClose) => {
            render(<ShareDropModal item={item} onClose={onClose} />);
            await user.click(screen.getByRole('button', { name: 'Create link' }));
            await screen.findByLabelText('Drop link');
        };

        it('asks first when the link has not been copied, because it cannot be shown again', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            await made(user, onClose);
            await user.click(screen.getByRole('button', { name: 'Done' }));
            expect(screen.getByText(/You have not copied the link yet/)).toBeTruthy();
            expect(onClose).not.toHaveBeenCalled();
            await user.click(screen.getByRole('button', { name: 'Close anyway' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('closes straight away once the link has been copied with the button', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            await made(user, onClose);
            await user.click(screen.getByRole('button', { name: /Copy link/ }));
            await user.click(screen.getByRole('button', { name: 'Done' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('counts a link copied by hand from the box', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            await made(user, onClose);
            fireEvent.copy(screen.getByLabelText('Drop link'));
            await user.click(screen.getByRole('button', { name: 'Close' }));
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('Escape asks the first time and closes the second', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            await made(user, onClose);
            await user.keyboard('{Escape}');
            expect(onClose).not.toHaveBeenCalled();
            expect(screen.getByText(/You have not copied the link yet/)).toBeTruthy();
            await user.keyboard('{Escape}');
            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('a copy the browser refuses does not count: it says so and still asks before closing', async () => {
            const user = userEvent.setup();
            const onClose = vi.fn();
            await made(user, onClose);
            vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));
            await user.click(screen.getByRole('button', { name: /Copy link/ }));
            expect(await screen.findByText(/would not copy it/)).toBeTruthy();
            await user.click(screen.getByRole('button', { name: 'Done' }));
            expect(onClose).not.toHaveBeenCalled();
        });

        it('closes without asking before any link is made', async () => {
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
        await user.click(screen.getByRole('button', { name: 'Create link' }));
        expect(await screen.findByText('Unlock your vault first.')).toBeTruthy();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('shows the server\'s refusal', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ errors: [{ msg: 'You have 25 live drops. Revoke one to make another.' }] }) });
        const user = userEvent.setup();
        open();
        await user.click(screen.getByRole('button', { name: 'Create link' }));
        expect(await screen.findByText('You have 25 live drops. Revoke one to make another.')).toBeTruthy();
    });
});
