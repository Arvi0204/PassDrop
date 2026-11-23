// Drop calls. The share key is made here, used to encrypt the login, and goes into the link that is returned: it is never sent to
// the server in the clear. A drop's label (the login's title, the sender's name for it, and the link's key, for the sender's list) is
// encrypted with the sender's vault key, which the server never has, so only the sender's unlocked vault can rebuild a live link. Results are `{ ok: true, ... }` or `{ ok: false, error }`; a network failure throws, so callers can show their own
// "cannot connect" message.
import authFetch from './authFetch';
import { decryptItem, encryptItem, exportVaultKey, importVaultKey, newVaultKey } from './vaultCrypto';
import { dropLink, fingerprintOf, fromLinkKey, pickShared, toLinkKey } from './drop';

export const GONE = 'This drop is gone. It has ended, or the sender revoked it.';
export const BAD_LINK = 'This link is incomplete or has been changed, so it cannot be opened.';

const headers = (token) => ({ 'Content-Type': 'application/json', 'auth-token': token });
const errorOf = (json, fallback) => json.errors?.[0]?.msg || json.error || fallback;

/** `rule` is { mode: 'views', views: 1..10 } or { mode: 'timer', ttl: seconds }. */
export async function createDrop(host, token, { item, rule, name = '', vaultKey, userId, origin = window.location.origin }) {
    const shareKey = await newVaultKey();
    const linkKey = toLinkKey(await exportVaultKey(shareKey));
    const body = {
        blob: await encryptItem(shareKey, pickShared(item)),
        // the login's title, what the sender calls the link and the link's key, for the sender's list (the key lets a live link be copied again)
        label: await encryptItem(vaultKey, { title: item.title || item.url || '', name: name.trim(), fp: await fingerprintOf(item), key: linkKey }, userId),
        // which login it was made from: its opaque record id, so the server ends the link when the login is deleted
        login: item._id,
        ...rule
    };
    const response = await authFetch(`${host}/api/drops`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to make the drop') };
    const { id, mode, viewsLeft, expiresAt } = json;
    return { ok: true, id, mode, viewsLeft, expiresAt, link: dropLink(origin, id, linkKey) };
}

// each row has its `login` id from the server, and its label opened: the title, the sender's own `name`, `fp`, and the link's `key`
// (empty for a link made before the key was kept)
const openLabels = (rows, vaultKey, userId) => Promise.all(rows.map(async ({ label, ...row }) => {
    try {
        const { title, name, fp, key } = await decryptItem(vaultKey, label, userId);
        return { ...row, title: title || '', name: name || '', fp: fp || '', key: key || '' };
    } catch {
        return { ...row, title: '', name: '', fp: '', key: '' };
    }
}));

/** The sender's live drops. */
export async function listDrops(host, token, { vaultKey, userId }) {
    const response = await authFetch(`${host}/api/drops`, { method: 'GET', headers: headers(token) });
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to load your shared logins') };
    return { ok: true, drops: await openLabels(json, vaultKey, userId) };
}

/** The sender's links that ended in the last 30 days: each has `reason` ('used', 'expired' or 'revoked'), `endedAt` and `opens`. */
export async function listHistory(host, token, { vaultKey, userId }) {
    const response = await authFetch(`${host}/api/drops/history`, { method: 'GET', headers: headers(token) });
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to load your past links') };
    // an ended link has nothing to copy, so its key is not kept in memory
    return { ok: true, history: (await openLabels(json, vaultKey, userId)).map((entry) => ({ ...entry, key: '' })) };
}

/** Clears the ended links in one login's history now, instead of at 30 days. Live links are not touched. */
export async function clearHistory(host, token, login) {
    const response = await authFetch(`${host}/api/drops/history?login=${encodeURIComponent(login)}`, { method: 'DELETE', headers: headers(token) });
    return response.ok ? { ok: true } : { ok: false, error: errorOf(await response.json(), 'Failed to clear the past links') };
}

export async function revokeDrop(host, token, id) {
    const response = await authFetch(`${host}/api/drops/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
    return response.ok ? { ok: true } : { ok: false, error: errorOf(await response.json(), 'Failed to revoke') };
}

/**
 * What is left of a drop, before anyone opens it. No sign-in, no key, and it never takes a view: { ok: true, mode, viewsLeft } for a
 * views drop, { ok: true, mode, expiresAt, createdAt } for a timer drop (both with `now`, the server's clock), or { ok: false, gone: true }.
 */
export async function peekDrop(host, id) {
    const response = await fetch(`${host}/api/drops/${encodeURIComponent(id)}`);
    if (response.status === 404) return { ok: false, gone: true, error: GONE };
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to look at the drop') };
    return { ok: true, ...json };
}

/** Opens a drop (this takes a view) and decrypts it with the key from the link. No sign-in. */
export async function openDrop(host, id, linkKey) {
    const response = await fetch(`${host}/api/drops/${encodeURIComponent(id)}/open`, { method: 'POST' });
    if (response.status === 404) return { ok: false, gone: true, error: GONE };
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to open the drop') };
    try {
        const item = await decryptItem(await importVaultKey(fromLinkKey(linkKey)), json.blob);
        return { ok: true, item, mode: json.mode, viewsLeft: json.viewsLeft, expiresAt: json.expiresAt, createdAt: json.createdAt, now: json.now };
    } catch {
        return { ok: false, error: BAD_LINK };
    }
}
