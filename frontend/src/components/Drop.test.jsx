import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Drop from './Drop';
import { BAD_LINK } from '../lib/dropApi';
import { toLinkKey } from '../lib/drop';
import { encryptItem, exportVaultKey, newVaultKey } from '../lib/vaultCrypto';

const item = { title: 'GitHub', url: 'github.com', username: 'octocat', password: 'S3cret-pw!', notes: 'two factor is off' };
let linkKey, blob;

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    const shareKey = await newVaultKey();
    linkKey = toLinkKey(await exportVaultKey(shareKey));
    blob = await encryptItem(shareKey, item);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ blob, mode: 'views', viewsLeft: 1, expiresAt: '2030-01-01T00:00:00Z' }) })));
});

const at = (path) => render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes><Route path="/drop/:id" element={<Drop />} /></Routes>
    </MemoryRouter>
);

describe('Drop', () => {
    it('fetches nothing until Reveal is pressed, so a link preview cannot use up a view', () => {
        at(`/drop/ID-1#${linkKey}`);
        expect(screen.getByText('Someone shared a login with you')).toBeTruthy();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('Reveal opens the drop with no sign-in and shows the login, with the password hidden until shown', async () => {
        const user = userEvent.setup();
        at(`/drop/ID-1#${linkKey}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('GitHub')).toBeTruthy();
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('http://api.test/api/drops/ID-1/open');
        expect(options.method).toBe('POST');
        expect(options.headers).toBeUndefined(); // no token: the recipient has no account
        expect(JSON.stringify(fetch.mock.calls)).not.toContain(linkKey); // the key never goes to the server
        expect(screen.getByText('octocat')).toBeTruthy();
        expect(screen.getByText('two factor is off')).toBeTruthy();
        expect(screen.queryByText('S3cret-pw!')).toBeNull();
        await user.click(screen.getByRole('button', { name: 'Show Password' }));
        expect(screen.getByText('S3cret-pw!')).toBeTruthy();
        expect(screen.getByText(/1 view left/)).toBeTruthy();
    });

    it('copies the password', async () => {
        const user = userEvent.setup();
        const write = vi.spyOn(navigator.clipboard, 'writeText');
        at(`/drop/ID-1#${linkKey}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        await user.click(await screen.findByRole('button', { name: 'Copy Password' }));
        expect(write).toHaveBeenCalledWith('S3cret-pw!');
    });

    it('says the drop is gone when it has ended or was revoked', async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ success: false }) });
        const user = userEvent.setup();
        at(`/drop/ID-1#${linkKey}`);
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('This drop is gone')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Reveal login' })).toBeNull();
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
