// Account calls that involve keys: each one derives what the server needs from the master password (or recovery key) in
// the browser, so only derived proofs and wrapped keys are ever sent (never the password, the recovery key or the vault
// key). Results are `{ ok: true, ... }` or `{ ok: false, error(s) }`; a network failure throws, so callers can show
// their own "cannot connect" message. Nothing is stored here: callers save the session (see session.js).
import authFetch from './authFetch';
import {
    VaultCryptoError, deriveKeys, deriveRecoveryKeys, newKdf, newRecoveryKey, newVaultKey, unwrapVaultKey, wrapVaultKey
} from './vaultCrypto';

export const WRONG_PASSWORD = 'That is not your master password.';
export const BAD_RECOVERY = 'Check the email and recovery key.';

const jsonHeaders = { 'Content-Type': 'application/json' };

async function call(url, options) {
    const response = await fetch(url, options);
    return { ok: response.ok, json: await response.json() };
}

const post = (host, path, body, headers = {}) =>
    call(`${host}${path}`, { method: 'POST', headers: { ...jsonHeaders, ...headers }, body: JSON.stringify(body) });

const errorsOf = (json, fallback) => json.errors?.map((e) => e.msg) ?? [json.error || fallback];

// the account's key-derivation settings and wrapped vault key, for a signed-in user
async function me(host, token) {
    const response = await authFetch(`${host}/api/auth/me`, { method: 'GET', headers: { ...jsonHeaders, 'auth-token': token } });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to fetch your account');
    return json;
}

export async function signUp(host, { username, email, password }) {
    const kdf = newKdf();
    const { authKey, wrapKey } = await deriveKeys(password, kdf);
    const vaultKey = await newVaultKey();
    const recoveryKey = newRecoveryKey();
    const { recoveryAuthKey, recoveryWrapKey } = await deriveRecoveryKeys(recoveryKey, kdf); // same salt as the password
    const { ok, json } = await post(host, '/api/auth/register', {
        username, email, authKey, kdf, recoveryAuthKey,
        wrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey),
        recoveryWrappedKey: await wrapVaultKey(vaultKey, recoveryWrapKey)
    });
    if (!ok || !json.success) return { ok: false, errors: errorsOf(json, 'Failed to create account') };
    return { ok: true, token: json.authToken, userId: json.userId, vaultKey, recoveryKey };
}

export async function signIn(host, { email, password }) {
    const prelogin = await call(`${host}/api/auth/prelogin?email=${encodeURIComponent(email)}`);
    if (!prelogin.ok || !prelogin.json.success) return { ok: false, errors: errorsOf(prelogin.json, 'Login failed. Check your credentials.') };

    const { authKey, wrapKey } = await deriveKeys(password, prelogin.json.kdf);
    const { ok, json } = await post(host, '/api/auth/login', { email, authKey });
    if (!ok || !json.success) return { ok: false, errors: errorsOf(json, 'Login failed. Check your credentials.') };
    try {
        return { ok: true, token: json.authToken, userId: json.userId, vaultKey: await unwrapVaultKey(json.wrappedVaultKey, wrapKey) };
    } catch (error) {
        if (!(error instanceof VaultCryptoError)) throw error;
        return { ok: false, errors: ['Your vault could not be opened. Reload the page and try again.'] };
    }
}

// opens the vault of a signed-in user again (a reopened tab); a wrong password is caught by the wrapped key failing to open
export async function unlock(host, token, password) {
    const { kdf, wrappedVaultKey } = await me(host, token);
    const { wrapKey } = await deriveKeys(password, kdf);
    try {
        return { ok: true, vaultKey: await unwrapVaultKey(wrappedVaultKey, wrapKey) };
    } catch (error) {
        if (!(error instanceof VaultCryptoError)) throw error;
        return { ok: false, error: WRONG_PASSWORD };
    }
}

// the `currentAuthKey` that proves a master password to the server for destructive actions
export async function reauthKey(host, token, password) {
    const { kdf } = await me(host, token);
    return (await deriveKeys(password, kdf)).authKey;
}

// The salt stays the same (the recovery key is derived with it); only the keys change. The vault key itself is not
// re-encrypted, only re-wrapped, so the saved logins are untouched.
export async function changePassword(host, token, { currentPassword, newPassword, vaultKey }) {
    const { kdf } = await me(host, token);
    const { authKey: currentAuthKey } = await deriveKeys(currentPassword, kdf);
    const { authKey: newAuthKey, wrapKey } = await deriveKeys(newPassword, kdf);
    const { ok, json } = await post(host, '/api/auth/change-password',
        { currentAuthKey, newAuthKey, newKdf: kdf, newWrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey) },
        { 'auth-token': token });
    if (!ok || !json.success) return { ok: false, error: errorsOf(json, 'Failed to update master password')[0] };
    return { ok: true, token: json.authToken };
}

export async function recover(host, { email, recoveryKey, newPassword }) {
    const fail = { ok: false, error: BAD_RECOVERY };
    const prelogin = await call(`${host}/api/auth/prelogin?email=${encodeURIComponent(email)}`);
    if (!prelogin.ok || !prelogin.json.success) return { ok: false, error: errorsOf(prelogin.json, BAD_RECOVERY)[0] };

    let keys;
    try {
        keys = await deriveRecoveryKeys(recoveryKey, prelogin.json.kdf);
    } catch (error) {
        if (error instanceof VaultCryptoError) return fail; // not 32 hex digits
        throw error;
    }
    const { recoveryAuthKey, recoveryWrapKey } = keys;
    const unlocked = await post(host, '/api/auth/recovery/unlock', { email, recoveryAuthKey });
    if (!unlocked.ok || !unlocked.json.success) return { ok: false, error: errorsOf(unlocked.json, BAD_RECOVERY)[0] };

    let vaultKey;
    try {
        vaultKey = await unwrapVaultKey(unlocked.json.recoveryWrappedKey, recoveryWrapKey);
    } catch (error) {
        if (error instanceof VaultCryptoError) return fail;
        throw error;
    }
    const kdf = unlocked.json.kdf;
    const { authKey: newAuthKey, wrapKey } = await deriveKeys(newPassword, kdf);
    const reset = await post(host, '/api/auth/recovery/reset',
        { email, recoveryAuthKey, newAuthKey, newKdf: kdf, newWrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey) });
    if (!reset.ok || !reset.json.success) return { ok: false, error: errorsOf(reset.json, BAD_RECOVERY)[0] };
    return { ok: true, token: reset.json.authToken, userId: reset.json.userId, vaultKey };
}
