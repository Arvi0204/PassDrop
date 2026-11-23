import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useDrops from './useDrops';
import { listDrops, listHistory } from '../../lib/dropApi';

vi.mock('../../lib/dropApi', () => ({ listDrops: vi.fn(), listHistory: vi.fn() }));
vi.mock('../../lib/session', () => ({ getToken: () => 'tok', getUserId: () => 'u1', getVaultKey: async () => ({}) }));

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
let live, past;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_BACKEND', 'http://api.test');
    live = [];
    past = [];
    listDrops.mockReset();
    listDrops.mockImplementation(async () => ({ ok: true, drops: live }));
    listHistory.mockReset();
    listHistory.mockImplementation(async () => ({ ok: true, history: past }));
});
afterEach(() => vi.useRealTimers());

describe('useDrops', () => {
    it('loads when enabled, and not before', async () => {
        const { rerender } = renderHook(({ on }) => useDrops(on), { initialProps: { on: false } });
        await flush();
        expect(listDrops).not.toHaveBeenCalled();
        rerender({ on: true });
        await flush();
        expect(listDrops).toHaveBeenCalledTimes(1);
    });

    it('forgets the links (and their keys) when it is disabled, as the vault locks', async () => {
        live = [{ id: 'D1', login: 'a', key: 'k', expiresAt: '2099-01-01T00:00:00Z' }];
        past = [{ id: 'P1', login: 'a' }];
        const { result, rerender } = renderHook(({ on }) => useDrops(on), { initialProps: { on: true } });
        await flush();
        expect(result.current.drops).toHaveLength(1);
        expect(result.current.history).toHaveLength(1);
        rerender({ on: false });
        await flush();
        expect(result.current.drops).toEqual([]);
        expect(result.current.history).toEqual([]);
    });

    it('does not bring the links back when the vault locks while they load', async () => {
        let finish;
        live = [{ id: 'D1', login: 'a', key: 'k', expiresAt: '2099-01-01T00:00:00Z' }];
        listDrops.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ ok: true, drops: live }); }));
        const { result, rerender } = renderHook(({ on }) => useDrops(on), { initialProps: { on: true } });
        await flush();
        rerender({ on: false });
        await act(async () => { finish(); await Promise.resolve(); await Promise.resolve(); });
        expect(result.current.drops).toEqual([]);
    });

    it('reloads every 10 seconds, so views other people use up show without a page reload', async () => {
        const { result } = renderHook(() => useDrops(true));
        await flush();
        live = [{ id: 'D1', login: 'a', expiresAt: '2099-01-01T00:00:00Z' }];
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(result.current.drops).toEqual(live);
        live = []; // the last view was taken: the server deleted it
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(result.current.drops).toEqual([]);
    });

    it('reloads when the tab is looked at again', async () => {
        renderHook(() => useDrops(true));
        await flush();
        listDrops.mockClear();
        act(() => { window.dispatchEvent(new Event('focus')); });
        await flush();
        expect(listDrops).toHaveBeenCalledTimes(1);
    });

    it('drops a link from the list when it ends, without waiting for the next poll', async () => {
        live = [{ id: 'D1', login: 'a', expiresAt: new Date(Date.now() + 3000).toISOString() }];
        const { result } = renderHook(() => useDrops(true));
        await flush();
        expect(result.current.drops).toHaveLength(1);
        live = []; // it ended, and the server no longer lists it
        listDrops.mockClear();
        await act(async () => { await vi.advanceTimersByTimeAsync(5600); }); // its end plus a moment (never sooner than 5 s)
        expect(listDrops).toHaveBeenCalledTimes(1);
        expect(result.current.drops).toEqual([]);
    });

    describe('the history of ended links', () => {
        it('is fetched on the first load, and again only when the set of live links changes', async () => {
            live = [{ id: 'D1', login: 'a', expiresAt: '2099-01-01T00:00:00Z' }];
            const { result } = renderHook(() => useDrops(true));
            await flush();
            expect(listHistory).toHaveBeenCalledTimes(1);

            await act(async () => { await vi.advanceTimersByTimeAsync(30000); }); // three polls, nothing changed
            expect(listHistory).toHaveBeenCalledTimes(1);

            live = []; // the link ended: it is now in the history
            past = [{ id: 'D1', login: 'a', reason: 'used', opens: 1 }];
            await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
            expect(listHistory).toHaveBeenCalledTimes(2);
            expect(result.current.history).toEqual(past);
        });

        it('keeps what it showed, and tries again, when the history cannot be loaded', async () => {
            const { result } = renderHook(() => useDrops(true));
            await flush();
            listHistory.mockResolvedValue({ ok: false, error: 'down' });
            live = [{ id: 'D2', login: 'a', expiresAt: '2099-01-01T00:00:00Z' }];
            await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
            expect(result.current.drops).toEqual(live); // the live list still updated
            const tries = listHistory.mock.calls.length;
            await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
            expect(listHistory.mock.calls.length).toBe(tries + 1); // not marked as fetched, so the next poll retries
        });
    });

    it('keeps what it showed when a reload fails', async () => {
        live = [{ id: 'D1', login: 'a', expiresAt: '2099-01-01T00:00:00Z' }];
        const { result } = renderHook(() => useDrops(true));
        await flush();
        listDrops.mockRejectedValue(new Error('offline'));
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        expect(result.current.drops).toEqual(live);
    });
});
