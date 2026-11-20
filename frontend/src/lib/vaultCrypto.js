// All of PassDrop's cryptography, in one place and with no I/O. It uses only WebCrypto, so the same file runs in the web
// app, in the extension's service worker and in Node (tests). The server never sees anything this file produces except
// the `authKey` proofs, the wrapped keys and the encrypted blobs.
//
//   master password --PBKDF2--> masterKey --HKDF--> authKey (sent to the server as the sign-in proof)
//                                              \--> wrapKey (never leaves the client; locks the vault key)
//   vault key: random AES-256-GCM key that encrypts every login; stored only wrapped (by wrapKey and by a recovery key)
//   recovery key: 128 random bits shown once; HKDF gives a second proof and a second wrapping key

export const KDF_MIN_ITERATIONS = 600000;

const AUTH_INFO = 'passdrop-auth-v1';
const WRAP_INFO = 'passdrop-wrap-v1';
const RECOVERY_AUTH_INFO = 'passdrop-recovery-auth-v1';
const RECOVERY_WRAP_INFO = 'passdrop-recovery-wrap-v1';
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export class VaultCryptoError extends Error {
    // code: 'wrong-key' (the key does not open this data), 'bad-blob' (not a blob at all), 'bad-recovery-key'
    constructor(code, message) {
        super(message || code);
        this.name = 'VaultCryptoError';
        this.code = code;
    }
}

const toB64 = (bytes) => {
    let s = '';
    const view = new Uint8Array(bytes);
    for (let i = 0; i < view.length; i += 0x8000) s += String.fromCharCode(...view.subarray(i, i + 0x8000));
    return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export function newKdf(iterations = KDF_MIN_ITERATIONS) {
    return { name: 'PBKDF2-SHA256', iterations, salt: toB64(random(16)) };
}

// Deliberately not trimmed: spaces are part of a password. NFKC makes composed and decomposed accents one password.
const normalizePassword = (password) => password.normalize('NFKC');

async function hkdf(material, salt, info, usage) {
    const params = { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode(info) };
    return usage === 'key'
        ? subtle().deriveKey(params, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
        : toB64(await subtle().deriveBits(params, material, 256));
}

export async function deriveKeys(masterPassword, kdf) {
    const pbkdf2 = await subtle().importKey('raw', enc.encode(normalizePassword(masterPassword)), 'PBKDF2', false, ['deriveBits']);
    const masterBits = await subtle().deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(kdf.salt), iterations: kdf.iterations }, pbkdf2, 256);
    const master = await subtle().importKey('raw', masterBits, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const none = new Uint8Array(0);
    return { authKey: await hkdf(master, none, AUTH_INFO, 'bits'), wrapKey: await hkdf(master, none, WRAP_INFO, 'key') };
}

export const newVaultKey = () => subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
export const exportVaultKey = async (key) => toB64(await subtle().exportKey('raw', key));
export const importVaultKey = (b64) => subtle().importKey('raw', fromB64(b64), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

async function seal(key, plain, aad) {
    const iv = random(12);
    const params = { name: 'AES-GCM', iv, ...(aad ? { additionalData: enc.encode(aad) } : {}) };
    return `v1.${toB64(iv)}.${toB64(await subtle().encrypt(params, key, plain))}`;
}

async function open(key, text, aad) {
    const parts = typeof text === 'string' ? text.split('.') : [];
    let iv, ct;
    try {
        if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('shape');
        iv = fromB64(parts[1]);
        ct = fromB64(parts[2]);
        if (iv.length !== 12 || ct.length < 16) throw new Error('size');
    } catch {
        throw new VaultCryptoError('bad-blob', 'Not an encrypted PassDrop item');
    }
    try {
        const params = { name: 'AES-GCM', iv, ...(aad ? { additionalData: enc.encode(aad) } : {}) };
        return new Uint8Array(await subtle().decrypt(params, key, ct));
    } catch {
        throw new VaultCryptoError('wrong-key', 'That key does not open this data');
    }
}

export async function wrapVaultKey(vaultKey, wrapKey) {
    return seal(wrapKey, await subtle().exportKey('raw', vaultKey));
}

export async function unwrapVaultKey(wrapped, wrapKey) {
    const raw = await open(wrapKey, wrapped);
    return subtle().importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export const encryptItem = (vaultKey, item, userId) => seal(vaultKey, enc.encode(JSON.stringify(item)), userId);

export async function decryptItem(vaultKey, blob, userId) {
    const plain = await open(vaultKey, blob, userId);
    try {
        return JSON.parse(dec.decode(plain));
    } catch {
        throw new VaultCryptoError('bad-blob', 'Not an encrypted PassDrop item');
    }
}

// 128 random bits as 8 groups of 4 uppercase hex digits: 1A2B-3C4D-...
export function newRecoveryKey() {
    const hex = [...random(16)].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    return hex.match(/.{4}/g).join('-');
}

// Accepts any casing, spaces, or missing hyphens. Returns the canonical form, or null if it is not 32 hex digits.
export function normalizeRecoveryKey(input) {
    const hex = String(input ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
    return hex.length === 32 ? hex.match(/.{4}/g).join('-') : null;
}

export async function deriveRecoveryKeys(recoveryKey, kdf) {
    const canonical = normalizeRecoveryKey(recoveryKey);
    if (!canonical) throw new VaultCryptoError('bad-recovery-key', 'That is not a recovery key');
    const bytes = Uint8Array.from(canonical.replace(/-/g, '').match(/../g), (h) => parseInt(h, 16));
    const material = await subtle().importKey('raw', bytes, 'HKDF', false, ['deriveBits', 'deriveKey']);
    const salt = fromB64(kdf.salt);
    return {
        recoveryAuthKey: await hkdf(material, salt, RECOVERY_AUTH_INFO, 'bits'),
        recoveryWrapKey: await hkdf(material, salt, RECOVERY_WRAP_INFO, 'key')
    };
}
