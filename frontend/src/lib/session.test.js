import { describe, expect, it, vi } from 'vitest';
import {
    clearPendingRecoveryKey, getPendingRecoveryKey, getToken, getUserId, getVaultKey, hasPendingRecoveryKey, hasVaultKey, lock,
    saveSignIn, saveVaultKey, setPendingRecoveryKey, signOut, subscribe
} from './session';
import { newVaultKey, encryptItem, decryptItem } from './vaultCrypto';

describe('session', () => {
    it('keeps the token and user id in localStorage and the vault key in sessionStorage', async () => {
        saveSignIn({ token: 'tok', userId: 'u1' });
        await saveVaultKey(await newVaultKey());
        expect(localStorage.getItem('passdrop.token')).toBe('tok');
        expect(localStorage.getItem('passdrop.userId')).toBe('u1');
        expect(sessionStorage.getItem('passdrop.vaultKey')).toMatch(/^[A-Za-z0-9+/]{43}=$/);
        expect(localStorage.getItem('passdrop.vaultKey')).toBeNull();
        expect(sessionStorage.getItem('passdrop.token')).toBeNull();
        expect([getToken(), getUserId(), hasVaultKey()]).toEqual(['tok', 'u1', true]);
    });

    it('gives back a vault key that decrypts what the saved one encrypted', async () => {
        const key = await newVaultKey();
        await saveVaultKey(key);
        const blob = await encryptItem(key, { title: 'a' }, 'u1');
        expect(await decryptItem(await getVaultKey(), blob, 'u1')).toEqual({ title: 'a' });
    });

    it('lock() removes the vault key and keeps the sign-in; signOut() removes everything', async () => {
        saveSignIn({ token: 'tok', userId: 'u1' });
        await saveVaultKey(await newVaultKey());
        lock();
        expect(await getVaultKey()).toBeNull();
        expect([getToken(), getUserId()]).toEqual(['tok', 'u1']);
        await saveVaultKey(await newVaultKey());
        signOut();
        expect([getToken(), getUserId(), await getVaultKey()]).toEqual([null, null, null]);
    });

    it('holds the recovery key in this tab only, until it is cleared or the user signs out', () => {
        setPendingRecoveryKey('1A2B-3C4D');
        expect([hasPendingRecoveryKey(), getPendingRecoveryKey()]).toEqual([true, '1A2B-3C4D']);
        expect(sessionStorage.getItem('passdrop.pendingRecoveryKey')).toBe('1A2B-3C4D');
        expect(localStorage.getItem('passdrop.pendingRecoveryKey')).toBeNull();
        clearPendingRecoveryKey();
        expect([hasPendingRecoveryKey(), getPendingRecoveryKey()]).toEqual([false, null]);
        setPendingRecoveryKey('1A2B-3C4D');
        lock();
        expect(hasPendingRecoveryKey()).toBe(true); // locking does not lose it
        signOut();
        expect(hasPendingRecoveryKey()).toBe(false);
    });

    it('tells listeners when the recovery key appears or goes', () => {
        const listener = vi.fn();
        const stop = subscribe(listener);
        setPendingRecoveryKey('x');
        clearPendingRecoveryKey();
        stop();
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('treats a stored value that is not a key as locked', async () => {
        sessionStorage.setItem('passdrop.vaultKey', 'garbage');
        expect(await getVaultKey()).toBeNull();
        expect(hasVaultKey()).toBe(false);
    });

    it('tells subscribers when the sign-in or lock state changes', async () => {
        const listener = vi.fn();
        const stop = subscribe(listener);
        saveSignIn({ token: 't', userId: 'u' });
        lock();
        signOut();
        expect(listener).toHaveBeenCalledTimes(3);
        stop();
        lock();
        expect(listener).toHaveBeenCalledTimes(3);
    });
});
