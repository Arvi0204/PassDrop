import { useCallback, useEffect, useRef, useState } from 'react';
import { listDrops, listHistory } from '../../lib/dropApi';
import { getToken, getUserId, getVaultKey } from '../../lib/session';

const POLL_MS = 10000;
const MIN_WAIT_MS = 5000; // so a clock that disagrees with the server's cannot make it reload in a tight loop

/**
 * The signed-in user's live drops, each with the id of the login it was made from (`login`). Views are used up by other
 * people, so it reloads every 10 seconds and whenever the tab is looked at again, and again at the moment the soonest
 * drop ends. A failed load keeps what was shown: sharing is secondary to the vault, so it never raises an error over it.
 * It also returns the history of ended links. That only changes when a live link appears or goes, so it is fetched
 * on the first load and then only when the set of live links has changed, not on every poll.
 */
export default function useDrops(enabled) {
    const host = import.meta.env.VITE_BACKEND;
    const [drops, setDrops] = useState([]);
    const [history, setHistory] = useState([]);
    const seen = useRef(null); // the live links the history was last fetched for
    const on = useRef(enabled);
    on.current = enabled;

    const reload = useCallback(async () => {
        try {
            const vaultKey = await getVaultKey();
            if (!vaultKey) return;
            const who = { vaultKey, userId: getUserId() };
            const result = await listDrops(host, getToken(), who);
            if (!result.ok || !on.current) return; // locked while it loaded: do not bring the links back
            setDrops(result.drops);
            const now = result.drops.map((d) => d.id).join();
            if (seen.current === now) return;
            const past = await listHistory(host, getToken(), who);
            if (past.ok && on.current) { setHistory(past.history); seen.current = now; }
        } catch {
            // keep what is shown
        }
    }, [host]);

    useEffect(() => {
        if (!enabled) { // locked: the links hold their keys, so none may stay in memory
            setDrops((d) => (d.length ? [] : d));
            setHistory((h) => (h.length ? [] : h));
            seen.current = null;
            return undefined;
        }
        const looked = () => { if (document.visibilityState === 'visible') reload(); };
        reload();
        const timer = setInterval(reload, POLL_MS);
        document.addEventListener('visibilitychange', looked);
        window.addEventListener('focus', looked);
        return () => {
            clearInterval(timer);
            document.removeEventListener('visibilitychange', looked);
            window.removeEventListener('focus', looked);
        };
    }, [enabled, reload]);

    // a drop that ends leaves the list when it ends, without waiting for the next poll
    useEffect(() => {
        const soonest = Math.min(...drops.map((d) => new Date(d.expiresAt).getTime()));
        if (!Number.isFinite(soonest)) return undefined;
        const timer = setTimeout(reload, Math.min(Math.max(soonest - Date.now() + 500, MIN_WAIT_MS), 2 ** 31 - 1));
        return () => clearTimeout(timer);
    }, [drops, reload]);

    return { drops, history, reload };
}
