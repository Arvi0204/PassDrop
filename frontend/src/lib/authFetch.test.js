import { afterEach, describe, expect, it, vi } from 'vitest';
import authFetch from './authFetch';

const respond = (status) => vi.stubGlobal('fetch', vi.fn(async () => ({ status, ok: status < 400 })));

afterEach(() => vi.restoreAllMocks());

describe('authFetch', () => {
    it('hands back an ordinary answer untouched, and keeps the token', async () => {
        sessionStorage.setItem('token', 'abc');
        respond(200);
        expect((await authFetch('/api/x', { method: 'GET' })).status).toBe(200);
        respond(403); // a wrong master password is not a dead session
        expect((await authFetch('/api/x')).status).toBe(403);
        expect(sessionStorage.getItem('token')).toBe('abc');
    });

    it('passes the url and options through to fetch', async () => {
        respond(200);
        await authFetch('/api/y', { method: 'DELETE', body: '{}' });
        expect(fetch).toHaveBeenCalledWith('/api/y', { method: 'DELETE', body: '{}' });
    });

    it('on a 401 drops the token, heads for the login page, and never gives the caller an answer', async () => {
        // jsdom cannot navigate; it reports the attempt as a "not implemented" error, which is how we see it
        const reported = vi.spyOn(console, 'error').mockImplementation(() => {});
        sessionStorage.setItem('token', 'dead');
        respond(401);
        let answered = false;
        authFetch('/api/x').then(() => { answered = true; });
        await vi.waitFor(() => expect(sessionStorage.getItem('token')).toBeNull());
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(answered).toBe(false);
        expect(reported.mock.calls.flat().join(' ')).toMatch(/navigation/i);
    });
});
