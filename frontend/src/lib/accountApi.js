// Account calls that involve keys: each one derives what the server needs from the master password (or recovery key) in
// the browser, so only derived proofs and wrapped keys are ever sent (never the password, the recovery key or the vault
// key). Results are `{ ok: true, ... }` or `{ ok: false, error(s) }`; a network failure throws, so callers can show
// their own "cannot connect" message. Nothing is stored here: callers save the session (see session.js).
import authFetch from './authFetch';
import {
    KDF_MIN_ITERATIONS, VaultCryptoError, checkKdf, deriveKeys, deriveRecoveryKeys, newKdf, newRecoveryKey, newVaultKey, unwrapVaultKey, wrapVaultKey
} from './vaultCrypto';

export const WRONG_PASSWORD = 'That is not your master password.';
export const BAD_RECOVERY = 'Check the email and recovery key.';
export const UNSAFE_KDF = 'The server sent unsafe key settings, so nothing was sent. Try again later.';

// Only a test run sets TEST_KDF_MIN_ITERATIONS (vitest's test.env, see vite.config.js). It has no VITE_ prefix, so no .env
// file can lower the minimum in a real build.
const MIN_ITERATIONS = Number(import.meta.env.TEST_KDF_MIN_ITERATIONS) || KDF_MIN_ITERATIONS;
const safe = (kdf) => checkKdf(kdf, MIN_ITERATIONS); // throws VaultCryptoError 'bad-kdf'

// a refusal of the server's key settings becomes an ordinary failed result, not a crash that reads as "cannot connect"
const refusingUnsafeSettings = (fn, failure) => async (...args) => {
    try {
        return await fn(...args);
    } catch (error) {
        if (error instanceof VaultCryptoError && error.code === 'bad-kdf') return failure;
        throw error;
    }
};

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
    return { ...json, kdf: safe(json.kdf) };
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

export const signIn = refusingUnsafeSettings(async (host, { email, password }) => {
    const prelogin = await call(`${host}/api/auth/prelogin?email=${encodeURIComponent(email)}`);
    if (!prelogin.ok || !prelogin.json.success) return { ok: false, errors: errorsOf(prelogin.json, 'Login failed. Check your credentials.') };

    const { authKey, wrapKey } = await deriveKeys(password, safe(prelogin.json.kdf));
    const { ok, json } = await post(host, '/api/auth/login', { email, authKey });
    if (!ok || !json.success) return { ok: false, errors: errorsOf(json, 'Login failed. Check your credentials.') };
    try {
        return { ok: true, token: json.authToken, userId: json.userId, vaultKey: await unwrapVaultKey(json.wrappedVaultKey, wrapKey) };
    } catch (error) {
        if (!(error instanceof VaultCryptoError)) throw error;
        return { ok: false, errors: ['Your vault could not be opened. Reload the page and try again.'] };
    }
}, { ok: false, errors: [UNSAFE_KDF] });

// opens the vault of a signed-in user again (a reopened tab); a wrong password is caught by the wrapped key failing to open
export const unlock = refusingUnsafeSettings(async (host, token, password) => {
    const { kdf, wrappedVaultKey } = await me(host, token);
    const { wrapKey } = await deriveKeys(password, kdf);
    try {
        return { ok: true, vaultKey: await unwrapVaultKey(wrappedVaultKey, wrapKey) };
    } catch (error) {
        if (!(error instanceof VaultCryptoError)) throw error;
        return { ok: false, error: WRONG_PASSWORD };
    }
}, { ok: false, error: UNSAFE_KDF });

// the `currentAuthKey` that proves a master password to the server for destructive actions
export async function reauthKey(host, token, password) {
    const { kdf } = await me(host, token);
    return (await deriveKeys(password, kdf)).authKey;
}

// The salt stays the same (the recovery key is derived with it); only the keys change. The vault key itself is not
// re-encrypted, only re-wrapped, so the saved logins are untouched.
export const changePassword = refusingUnsafeSettings(async (host, token, { currentPassword, newPassword, vaultKey }) => {
    const { kdf } = await me(host, token);
    const { authKey: currentAuthKey } = await deriveKeys(currentPassword, kdf);
    const { authKey: newAuthKey, wrapKey } = await deriveKeys(newPassword, kdf);
    const { ok, json } = await post(host, '/api/auth/change-password',
        { currentAuthKey, newAuthKey, newKdf: kdf, newWrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey) },
        { 'auth-token': token });
    if (!ok || !json.success) return { ok: false, error: errorsOf(json, 'Failed to update master password')[0] };
    return { ok: true, token: json.authToken };
}, { ok: false, error: UNSAFE_KDF });

// A new recovery key, whenever the user wants one (like GitHub's recovery codes): the old key stops working. The master
// password is proven twice over: its derived proof goes to the server, and opening the account's own wrapped vault key
// with it proves it locally too (so this works in a locked tab as well). The raw recovery key never leaves the browser.
export const regenerateRecoveryKey = refusingUnsafeSettings(async (host, token, password) => {
    const { kdf, wrappedVaultKey } = await me(host, token);
    const { authKey: currentAuthKey, wrapKey } = await deriveKeys(password, kdf);
    let vaultKey;
    try {
        vaultKey = await unwrapVaultKey(wrappedVaultKey, wrapKey);
    } catch (error) {
        if (error instanceof VaultCryptoError) return { ok: false, error: WRONG_PASSWORD };
        throw error;
    }
    const recoveryKey = newRecoveryKey();
    const { recoveryAuthKey, recoveryWrapKey } = await deriveRecoveryKeys(recoveryKey, kdf); // the account's own salt
    const { ok, json } = await post(host, '/api/auth/recovery/rotate',
        { currentAuthKey, recoveryAuthKey, recoveryWrappedKey: await wrapVaultKey(vaultKey, recoveryWrapKey) },
        { 'auth-token': token });
    if (!ok || !json.success) return { ok: false, error: errorsOf(json, 'Failed to make a new recovery key')[0] };
    return { ok: true, recoveryKey };
}, { ok: false, error: UNSAFE_KDF });

export const recover = refusingUnsafeSettings(async (host, { email, recoveryKey, newPassword }) => {
    const fail = { ok: false, error: BAD_RECOVERY };
    const prelogin = await call(`${host}/api/auth/prelogin?email=${encodeURIComponent(email)}`);
    if (!prelogin.ok || !prelogin.json.success) return { ok: false, error: errorsOf(prelogin.json, BAD_RECOVERY)[0] };

    const accountKdf = safe(prelogin.json.kdf); // checked here, outside the try below, so it is not mistaken for a mistyped key
    let keys;
    try {
        keys = await deriveRecoveryKeys(recoveryKey, accountKdf);
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
    const kdf = safe(unlocked.json.kdf);
    const { authKey: newAuthKey, wrapKey } = await deriveKeys(newPassword, kdf);
    const reset = await post(host, '/api/auth/recovery/reset',
        { email, recoveryAuthKey, newAuthKey, newKdf: kdf, newWrappedVaultKey: await wrapVaultKey(vaultKey, wrapKey) });
    if (!reset.ok || !reset.json.success) return { ok: false, error: errorsOf(reset.json, BAD_RECOVERY)[0] };
    return { ok: true, token: reset.json.authToken, userId: reset.json.userId, vaultKey };
}, { ok: false, error: UNSAFE_KDF });
