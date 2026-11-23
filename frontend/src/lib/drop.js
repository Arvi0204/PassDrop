// Helpers for drops: one login shared by a link that ends after a number of views or a time. The link is
// /drop/<id>#<share key>: the key is in the #fragment, which a browser never sends to a server.

export const VIEW_CHOICES = [1, 2, 3, 5, 10];
export const TIMER_CHOICES = [
    { ttl: 600, label: '10 minutes' },
    { ttl: 3600, label: '1 hour' },
    { ttl: 86400, label: '24 hours' },
    { ttl: 604800, label: '7 days' }
];

const LINK_KEY = /^[A-Za-z0-9_-]{43}$/; // a 256-bit key as unpadded base64url

// the key as the vault code writes it (standard base64) <-> as it goes in a link
export const toLinkKey = (b64) => b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const fromLinkKey = (key) => {
    const b64 = key.replace(/-/g, '+').replace(/_/g, '/');
    return b64 + '='.repeat((4 - (b64.length % 4)) % 4);
};

export const dropLink = (origin, id, linkKey) => `${origin}/drop/${id}#${linkKey}`;

/** The share key in a location.hash, or null if the link is missing it or it is not a key. */
export const keyFromHash = (hash) => {
    const key = (hash || '').replace(/^#/, '');
    return LINK_KEY.test(key) ? key : null;
};

// only these five fields are shared; nothing else about the login (favourite, dates, id) goes into a drop
export const pickShared = (item) => ({
    title: item.title || '', url: item.url || '', username: item.username || '', password: item.password || '', notes: item.notes || ''
});

/**
 * A fingerprint of what a link shows. It is kept in the sender's encrypted label, so the vault can tell that a login was
 * edited after it was shared (a link shows the login as it was then). Editing something a link does not show, such as the
 * favourite star, leaves it unchanged.
 */
export async function fingerprintOf(item) {
    const bytes = new TextEncoder().encode(JSON.stringify(pickShared(item)));
    return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** "under a minute", "12 min", "3 h 20 min", "5 days", or "ended". */
export function timeLeft(expiresAt, now = Date.now()) {
    const ms = new Date(expiresAt).getTime() - now;
    if (!(ms > 0)) return 'ended';
    const minutes = Math.ceil(ms / 60000);
    if (minutes <= 1) return 'under a minute';
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 24 * 60) { const m = minutes % 60; return m ? `${Math.floor(minutes / 60)} h ${m} min` : `${minutes / 60} h`; }
    const days = Math.ceil(minutes / (24 * 60));
    return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** What is left of a drop, in words: "2 views left" or "ends in 3 h 20 min". */
export const describeRule = ({ mode, viewsLeft, expiresAt }, now = Date.now()) => {
    if (mode === 'views') return `${viewsLeft} ${viewsLeft === 1 ? 'view' : 'views'} left`;
    const left = timeLeft(expiresAt, now);
    return left === 'ended' ? 'ended' : `ends in ${left}`; // the server may still list it for a moment after its time is up
};
