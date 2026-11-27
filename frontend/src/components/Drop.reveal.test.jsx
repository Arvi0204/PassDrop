import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Drop from './Drop';
import { toLinkKey } from '../lib/drop';
import { encryptItem, exportVaultKey, newVaultKey } from '../lib/vaultCrypto';

// a browser that can play the release animation, but whose animation fails: the view has been used by then
vi.mock('../lib/dropFall', () => ({ canRelease: () => true, releaseDrop: () => Promise.reject(new Error('the animation failed')) }));

const item = { title: 'GitHub', url: 'github.com', username: 'octocat', password: 'S3cret-pw!', notes: '' };
let linkKey, blob;

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    const shareKey = await newVaultKey();
    linkKey = toLinkKey(await exportVaultKey(shareKey));
    blob = await encryptItem(shareKey, item);
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        const reply = (json) => ({ ok: true, status: 200, json: async () => json });
        return options.method === 'POST' ? reply({ blob, mode: 'views', viewsLeft: 2, now: '2026-01-01T12:00:00.000Z' }) : reply({ mode: 'views', viewsLeft: 3, now: '2026-01-01T12:00:00.000Z' });
    }));
});

describe('Drop, when the animation fails after the view is used', () => {
    it('still shows the login, and does not blame the connection, so nobody spends a second view to see it', async () => {
        const user = userEvent.setup();
        render(
            <MemoryRouter initialEntries={[`/drop/ID-1#${linkKey}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes><Route path="/drop/:id" element={<Drop />} /></Routes>
            </MemoryRouter>
        );
        await screen.findByText('3 views left');
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('octocat')).toBeTruthy();
        expect(screen.queryByText(/Cannot connect/)).toBeNull();
        expect(fetch.mock.calls.filter(([, o]) => o?.method === 'POST')).toHaveLength(1); // one view, once
    });
});

describe('Drop and site icons', () => {
    // the site of a shared login is whatever its sender typed, so loading its icon would tell the sender when and
    // from where the link was opened: this page must never ask for one
    beforeEach(async () => {
        const shareKey = await newVaultKey();
        linkKey = toLinkKey(await exportVaultKey(shareKey));
        blob = await encryptItem(shareKey, { ...item, url: 'https://tracker.example/login' });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('never loads an icon from the address a sender chose', async () => {
        const made = [];
        vi.stubGlobal('Image', class { constructor() { made.push(this); } });
        const user = userEvent.setup();
        const { container } = render(
            <MemoryRouter initialEntries={[`/drop/ID-1#${linkKey}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes><Route path="/drop/:id" element={<Drop />} /></Routes>
            </MemoryRouter>
        );
        await screen.findByText('3 views left');
        await user.click(screen.getByRole('button', { name: 'Reveal login' }));
        expect(await screen.findByText('octocat')).toBeTruthy();
        expect(made).toHaveLength(0);
        expect(container.querySelector('img')).toBeNull();
    });
});
