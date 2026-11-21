// Where "signed in" and "unlocked" live. Signed in = the token + user id (localStorage, survives closing the tab).
// Unlocked = the vault key (sessionStorage, gone when the tab closes). Nothing else in the app touches these keys.
import { exportVaultKey, importVaultKey } from './vaultCrypto';

const TOKEN = 'passdrop.token';
const USER_ID = 'passdrop.userId';
const VAULT_KEY = 'passdrop.vaultKey';
const PENDING_RECOVERY_KEY = 'passdrop.pendingRecoveryKey';
const PENDING_RECOVERY_USER = 'passdrop.pendingRecoveryUser'; // whose it is

// components that show the lock state (the vault context) listen here
const listeners = new Set();
const changed = () => listeners.forEach((listener) => listener());
export const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const getToken = () => localStorage.getItem(TOKEN);
export const getUserId = () => localStorage.getItem(USER_ID);
export const hasVaultKey = () => sessionStorage.getItem(VAULT_KEY) !== null;

export function saveSignIn({ token, userId }) {
    localStorage.setItem(TOKEN, token);
    localStorage.setItem(USER_ID, userId);
    changed();
}

export async function getVaultKey() {
    const stored = sessionStorage.getItem(VAULT_KEY);
    if (!stored) return null;
    try {
        return await importVaultKey(stored);
    } catch {
        sessionStorage.removeItem(VAULT_KEY); // not a key: treat the vault as locked
        return null;
    }
}

export async function saveVaultKey(key) {
    sessionStorage.setItem(VAULT_KEY, await exportVaultKey(key));
    changed();
}

// The recovery key made at sign-up, held (in this tab only) until the Account page has shown it once. It is never sent
// anywhere; signing out or showing it removes it. It belongs to the account that made it: if another account has signed
// in by the time the Account page opens (say, from a second tab), the key is not offered to that account.
const heldFor = () => sessionStorage.getItem(PENDING_RECOVERY_USER) === (getUserId() ?? '');
export const getPendingRecoveryKey = () => (heldFor() ? sessionStorage.getItem(PENDING_RECOVERY_KEY) : null);
export const hasPendingRecoveryKey = () => getPendingRecoveryKey() !== null;
export function setPendingRecoveryKey(key) {
    sessionStorage.setItem(PENDING_RECOVERY_KEY, key);
    sessionStorage.setItem(PENDING_RECOVERY_USER, getUserId() ?? '');
    changed();
}
export function clearPendingRecoveryKey() {
    sessionStorage.removeItem(PENDING_RECOVERY_KEY);
    sessionStorage.removeItem(PENDING_RECOVERY_USER);
    changed();
}

// forget the vault key only: still signed in, the master password unlocks it again
export function lock() {
    sessionStorage.removeItem(VAULT_KEY);
    changed();
}

export function signOut() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(USER_ID);
    sessionStorage.removeItem(VAULT_KEY);
    sessionStorage.removeItem(PENDING_RECOVERY_KEY);
    sessionStorage.removeItem(PENDING_RECOVERY_USER);
    changed();
}
