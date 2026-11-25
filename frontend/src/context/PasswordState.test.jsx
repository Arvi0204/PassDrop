import { useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import PasswordState from './PasswordState';
import passwordContext from './passwordContext';
import { lock, saveSignIn, saveVaultKey } from '../lib/session';
import { decryptItem, encryptItem, newVaultKey } from '../lib/vaultCrypto';

vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const USER = 'user-1';
let vaultKey, ctx, server;

// the vault state, as the components see it
function Probe() {
    ctx = useContext(passwordContext);
    return (
        <ul>
            {ctx.passwordArray.map((p) => <li key={p._id}>{p.unreadable ? 'unreadable' : `${p.title}|${p.password}`}</li>)}
            <li>{ctx.locked ? 'LOCKED' : 'OPEN'}</li>
        </ul>
    );
}
const mount = () => render(<PasswordState><Probe /></PasswordState>);
const blobOf = (item) => encryptItem(vaultKey, item, USER);
const github = { title: 'GitHub', url: 'github.com', username: 'me', password: 'pw-1', notes: '', isFavorite: false };

beforeEach(async () => {
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    vaultKey = await newVaultKey();
    saveSignIn({ token: 'tok', userId: USER });
    await saveVaultKey(vaultKey);
    server = { records: [], saved: [] };
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
        const method = options.method || 'GET';
        const body = options.body ? JSON.parse(options.body) : null;
        server.saved.push({ method, url, body });
        const reply = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });
        if (method === 'GET') return reply(server.records);
        if (method === 'POST') return reply({ _id: 'new-1', blob: body.blob, createdAt: 'c', updatedAt: 'u' }, 201);
        if (method === 'PUT') return reply({ _id: url.split('/').pop(), blob: body.blob, createdAt: 'c', updatedAt: 'u2' });
        return reply({ success: true });
    }));
});

describe('PasswordState', () => {
    it('getPasswords decrypts every blob; one corrupt blob becomes unreadable and the rest still load', async () => {
        server.records = [
            { _id: 'a', blob: await blobOf(github), createdAt: 'c', updatedAt: 'u' },
            { _id: 'b', blob: 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }, // not encrypted with this key
            { _id: 'c', blob: 'garbage' },
            { _id: 'd', blob: await blobOf({ ...github, title: 'Mail', password: 'pw-2' }) }
        ];
        mount();
        await act(() => ctx.getPasswords());
        expect(ctx.passwordArray).toEqual([
            { ...github, _id: 'a', createdAt: 'c', updatedAt: 'u' },
            { _id: 'b', unreadable: true },
            { _id: 'c', unreadable: true },
            expect.objectContaining({ _id: 'd', title: 'Mail', password: 'pw-2' })
        ]);
        expect(screen.getAllByText('unreadable')).toHaveLength(2);
    });

    it('a blob made for another user is unreadable (the user id is part of what is signed)', async () => {
        server.records = [{ _id: 'a', blob: await encryptItem(vaultKey, github, 'someone-else') }];
        mount();
        await act(() => ctx.getPasswords());
        expect(ctx.passwordArray).toEqual([{ _id: 'a', unreadable: true }]);
    });

    it('addPass sends only { blob } that opens to the login, and lists the decrypted item', async () => {
        mount();
        let result;
        await act(async () => { result = await ctx.addPass({ ...github, _id: 'ignored', extra: 'x' }); });
        const sent = server.saved.at(-1);
        expect(sent).toMatchObject({ method: 'POST', url: 'http://api.test/api/passwords' });
        expect(Object.keys(sent.body)).toEqual(['blob']);
        expect(JSON.stringify(sent)).not.toMatch(/GitHub|pw-1|github\.com/);
        expect(await decryptItem(vaultKey, sent.body.blob, USER)).toEqual(github);
        expect(result.success).toBe(true);
        expect(screen.getByText('GitHub|pw-1')).toBeTruthy();
    });

    it('editPass merges a partial update into the saved login, sends only { blob } and updates the list', async () => {
        server.records = [{ _id: 'a', blob: await blobOf(github), createdAt: 'c', updatedAt: 'u' }];
        mount();
        await act(() => ctx.getPasswords());
        await act(() => ctx.editPass('a', { isFavorite: true }));
        const sent = server.saved.at(-1);
        expect(sent).toMatchObject({ method: 'PUT', url: 'http://api.test/api/passwords/a' });
        expect(Object.keys(sent.body)).toEqual(['blob']);
        expect(await decryptItem(vaultKey, sent.body.blob, USER)).toEqual({ ...github, isFavorite: true });
        expect(ctx.passwordArray[0]).toMatchObject({ _id: 'a', title: 'GitHub', isFavorite: true, updatedAt: 'u2' });
    });

    it('deletePass removes the item', async () => {
        server.records = [{ _id: 'a', blob: await blobOf(github) }, { _id: 'b', blob: 'garbage' }];
        mount();
        await act(() => ctx.getPasswords());
        await act(() => ctx.deletePass('b'));
        expect(ctx.passwordArray.map((p) => p._id)).toEqual(['a']);
    });

    it('with no vault key the state is locked and nothing is fetched or shown', async () => {
        lock();
        server.records = [{ _id: 'a', blob: await blobOf(github) }];
        mount();
        expect(screen.getByText('LOCKED')).toBeTruthy();
        await act(() => ctx.getPasswords());
        expect(fetch).not.toHaveBeenCalled();
        expect(ctx.passwordArray).toEqual([]);
        let result;
        await act(async () => { result = await ctx.addPass(github); });
        expect(result.success).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('saving with the vault key missing says so, sends nothing and reports failure for both add and edit', async () => {
        server.records = [{ _id: 'a', blob: await blobOf(github) }];
        mount();
        await act(() => ctx.getPasswords());
        fetch.mockClear();
        toast.error.mockClear();
        lock();
        let added, edited;
        await act(async () => { added = await ctx.addPass(github); });
        await act(async () => { edited = await ctx.editPass('a', { title: 'x' }); });
        expect(added.success).toBe(false);
        expect(edited.success).toBe(false);
        expect(toast.error).toHaveBeenCalledTimes(2);
        expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/locked/));
        expect(fetch).not.toHaveBeenCalled();
    });

    it('locking clears what is shown; unlocking again allows loading', async () => {
        server.records = [{ _id: 'a', blob: await blobOf(github) }];
        mount();
        await act(() => ctx.getPasswords());
        expect(screen.getByText('GitHub|pw-1')).toBeTruthy();
        act(() => lock());
        await waitFor(() => expect(screen.getByText('LOCKED')).toBeTruthy());
        expect(screen.queryByText('GitHub|pw-1')).toBeNull();
        await act(() => saveVaultKey(vaultKey));
        expect(screen.getByText('OPEN')).toBeTruthy();
    });
});
