// Drop calls. The share key is made here, used to encrypt the login, and goes only into the link that is returned: it is
// never sent to the server. A drop's label (the login's title, for the sender's list) is encrypted with the sender's vault
// key. Results are `{ ok: true, ... }` or `{ ok: false, error }`; a network failure throws, so callers can show their own
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
    const body = {
        blob: await encryptItem(shareKey, pickShared(item)),
        // the login's title and what the sender calls the link, for the sender's list
        label: await encryptItem(vaultKey, { title: item.title || item.url || '', name: name.trim(), fp: await fingerprintOf(item) }, userId),
        // which login it was made from: its opaque record id, so the server ends the link when the login is deleted
        login: item._id,
        ...rule
    };
    const response = await authFetch(`${host}/api/drops`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to make the drop') };
    const { id, mode, viewsLeft, expiresAt } = json;
    return { ok: true, id, mode, viewsLeft, expiresAt, link: dropLink(origin, id, toLinkKey(await exportVaultKey(shareKey))) };
}

// each row has its `login` id from the server, and its label opened: the title and the sender's own `name` (and `fp`)
const openLabels = (rows, vaultKey, userId) => Promise.all(rows.map(async ({ label, ...row }) => {
    try {
        const { title, name, fp } = await decryptItem(vaultKey, label, userId);
        return { ...row, title: title || '', name: name || '', fp: fp || '' };
    } catch {
        return { ...row, title: '', name: '', fp: '' };
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
    return { ok: true, history: await openLabels(json, vaultKey, userId) };
}

export async function revokeDrop(host, token, id) {
    const response = await authFetch(`${host}/api/drops/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
    return response.ok ? { ok: true } : { ok: false, error: errorOf(await response.json(), 'Failed to revoke') };
}

/** Opens a drop (this takes a view) and decrypts it with the key from the link. No sign-in. */
export async function openDrop(host, id, linkKey) {
    const response = await fetch(`${host}/api/drops/${encodeURIComponent(id)}/open`, { method: 'POST' });
    if (response.status === 404) return { ok: false, gone: true, error: GONE };
    const json = await response.json();
    if (!response.ok) return { ok: false, error: errorOf(json, 'Failed to open the drop') };
    try {
        const item = await decryptItem(await importVaultKey(fromLinkKey(linkKey)), json.blob);
        return { ok: true, item, mode: json.mode, viewsLeft: json.viewsLeft, expiresAt: json.expiresAt };
    } catch {
        return { ok: false, error: BAD_LINK };
    }
}
