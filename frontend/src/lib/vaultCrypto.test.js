// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
    KDF_MIN_ITERATIONS, KDF_MAX_ITERATIONS, checkKdf, newKdf, deriveKeys, newVaultKey, exportVaultKey, importVaultKey, wrapVaultKey, unwrapVaultKey,
    encryptItem, decryptItem, newRecoveryKey, normalizeRecoveryKey, deriveRecoveryKeys, VaultCryptoError
} from './vaultCrypto';

const kdf = { name: 'PBKDF2-SHA256', iterations: 1000, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
const otherKdf = { ...kdf, salt: 'AQEBAQEBAQEBAQEBAQEBAQ==' };
const authOf = async (password, k = kdf) => (await deriveKeys(password, k)).authKey;
const rejects = async (promise) => promise.then(() => null, (e) => e);

describe('checkKdf', () => {
    const good = { name: 'PBKDF2-SHA256', iterations: KDF_MIN_ITERATIONS, salt: 'AAAAAAAAAAAAAAAAAAAAAA==' };
    const code = (kdf, min) => { try { checkKdf(kdf, min); return null; } catch (e) { return e.code; } };

    it('accepts the settings sign-up makes, and the largest allowed number of rounds', () => {
        expect(checkKdf(newKdf())).toMatchObject({ name: 'PBKDF2-SHA256', iterations: KDF_MIN_ITERATIONS });
        expect(code({ ...good, iterations: KDF_MAX_ITERATIONS })).toBeNull();
    });

    it('refuses too few rounds, too many, and ones that are not whole numbers', () => {
        expect(code({ ...good, iterations: KDF_MIN_ITERATIONS - 1 })).toBe('bad-kdf');
        expect(code({ ...good, iterations: 1 })).toBe('bad-kdf');
        expect(code({ ...good, iterations: KDF_MAX_ITERATIONS + 1 })).toBe('bad-kdf');
        expect(code({ ...good, iterations: 1e12 })).toBe('bad-kdf');
        expect(code({ ...good, iterations: 600000.5 })).toBe('bad-kdf');
        expect(code({ ...good, iterations: '600000' })).toBe('bad-kdf');
    });

    it('refuses another algorithm, a bad salt, and anything that is not settings at all', () => {
        expect(code({ ...good, name: 'MD5' })).toBe('bad-kdf');
        expect(code({ ...good, salt: 'AAAAAAAAAAAAAAAAAAAAA=' })).toBe('bad-kdf'); // 15 bytes
        expect(code({ ...good, salt: '!!!!!!!!!!!!!!!!!!!!!!==' })).toBe('bad-kdf');
        expect(code({ ...good, salt: undefined })).toBe('bad-kdf');
        for (const nothing of [null, undefined, 'PBKDF2', 42, {}]) expect(code(nothing)).toBe('bad-kdf');
    });

    it('takes the minimum as a parameter, so tests can use fast settings', () => {
        const fast = { ...good, iterations: 1000 };
        expect(code(fast)).toBe('bad-kdf');
        expect(code(fast, 1000)).toBeNull();
        expect(code({ ...fast, iterations: 999 }, 1000)).toBe('bad-kdf');
    });
});

describe('deriveKeys', () => {
    it('derives the same keys for the same password and salt, different keys otherwise', async () => {
        const a = await authOf('correct horse');
        expect(a).toHaveLength(44);
        expect(a).toBe(await authOf('correct horse'));
        expect(a).not.toBe(await authOf('correct horses'));
        expect(a).not.toBe(await authOf('correct horse', otherKdf));
    });

    it('treats composed and decomposed accents as one password', async () => {
        expect(await authOf('café')).toBe(await authOf('café'));
    });

    it('keeps spaces in a password', async () => {
        expect(await authOf('a b')).not.toBe(await authOf('ab'));
        expect(await authOf('x ')).not.toBe(await authOf('x'));
    });

    it('pins the authKey for a known password, salt and iteration count', async () => {
        // computed once; a change here means the key format changed and every existing account would stop signing in
        expect(await authOf('correct horse')).toBe('RCDm/lWaGQSgot2jSm+j4IVDK88HQggLvh7SObEBenQ=');
    });

    it('creates a salted kdf at the minimum strength by default', () => {
        const a = newKdf();
        expect(a).toMatchObject({ name: 'PBKDF2-SHA256', iterations: KDF_MIN_ITERATIONS });
        expect(a.salt).not.toBe(newKdf().salt);
    });
});

describe('the vault key', () => {
    it('wraps and unwraps; a different wrapKey throws wrong-key', async () => {
        const vault = await newVaultKey();
        const { wrapKey } = await deriveKeys('pw', kdf);
        const wrapped = await wrapVaultKey(vault, wrapKey);
        expect(wrapped).toMatch(/^v1\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
        expect(await exportVaultKey(await unwrapVaultKey(wrapped, wrapKey))).toBe(await exportVaultKey(vault));
        const wrong = (await deriveKeys('other', kdf)).wrapKey;
        expect((await rejects(unwrapVaultKey(wrapped, wrong))).code).toBe('wrong-key');
    });

    it('exports and imports through base64 and still decrypts', async () => {
        const vault = await newVaultKey();
        const blob = await encryptItem(vault, { title: 'x' }, 'u1');
        const again = await importVaultKey(await exportVaultKey(vault));
        expect(await decryptItem(again, blob, 'u1')).toEqual({ title: 'x' });
    });
});

describe('items', () => {
    const item = { title: 'GitHub', url: 'https://github.com', username: 'octocat', password: 'S3cret-passw0rd!', notes: '', isFavorite: true };

    it('encrypts to v1.<iv>.<ct>, round-trips, and uses a fresh IV each time', async () => {
        const vault = await newVaultKey();
        const a = await encryptItem(vault, item, 'u1');
        const b = await encryptItem(vault, item, 'u1');
        expect(a).toMatch(/^v1\.[^.]+\.[^.]+$/);
        expect(a).not.toBe(b);
        expect(a).not.toContain('S3cret');
        expect(await decryptItem(vault, a, 'u1')).toEqual(item);
    });

    it('refuses another user id, a tampered blob (wrong-key) and a malformed string (bad-blob)', async () => {
        const vault = await newVaultKey();
        const blob = await encryptItem(vault, item, 'u1');
        expect((await rejects(decryptItem(vault, blob, 'u2'))).code).toBe('wrong-key');
        const [v, iv, ct] = blob.split('.');
        const flipped = `${v}.${iv}.${ct.slice(0, -6)}${ct.slice(-6, -5) === 'A' ? 'B' : 'A'}${ct.slice(-5)}`;
        expect((await rejects(decryptItem(vault, flipped, 'u1'))).code).toBe('wrong-key');
        expect((await rejects(decryptItem(vault, 'not a blob', 'u1'))).code).toBe('bad-blob');
        expect((await rejects(decryptItem(vault, 'v2.AAAA.AAAA', 'u1'))).code).toBe('bad-blob');
        expect((await rejects(decryptItem(vault, undefined, 'u1'))).code).toBe('bad-blob');
        expect(await rejects(decryptItem(vault, blob, 'u2'))).toBeInstanceOf(VaultCryptoError);
    });
});

describe('the recovery key', () => {
    it('is 8 groups of 4 uppercase hex; normalizeRecoveryKey accepts lowercase, spaces and missing hyphens, null for 31 or 33 digits', () => {
        const key = newRecoveryKey();
        expect(key).toMatch(/^([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
        expect(key).not.toBe(newRecoveryKey());
        expect(normalizeRecoveryKey(key.toLowerCase())).toBe(key);
        expect(normalizeRecoveryKey(key.replace(/-/g, ' '))).toBe(key);
        expect(normalizeRecoveryKey(key.replace(/-/g, ''))).toBe(key);
        expect(normalizeRecoveryKey(key.replace(/-/g, '').slice(1))).toBeNull();
        expect(normalizeRecoveryKey(key.replace(/-/g, '') + '0')).toBeNull();
        expect(normalizeRecoveryKey(null)).toBeNull();
    });

    it('unwraps a vault key wrapped for it, and differs per salt', async () => {
        const key = newRecoveryKey();
        const vault = await newVaultKey();
        const { recoveryAuthKey, recoveryWrapKey } = await deriveRecoveryKeys(key, kdf);
        expect(recoveryAuthKey).toHaveLength(44);
        const wrapped = await wrapVaultKey(vault, recoveryWrapKey);
        // the same key typed differently derives the same keys
        const again = await deriveRecoveryKeys(key.toLowerCase().replace(/-/g, ' '), kdf);
        expect(again.recoveryAuthKey).toBe(recoveryAuthKey);
        expect(await exportVaultKey(await unwrapVaultKey(wrapped, again.recoveryWrapKey))).toBe(await exportVaultKey(vault));
        expect((await deriveRecoveryKeys(key, otherKdf)).recoveryAuthKey).not.toBe(recoveryAuthKey);
        expect((await rejects(deriveRecoveryKeys('nope', kdf))).code).toBe('bad-recovery-key');
    });

    it('never matches the master-password proof for the same salt', async () => {
        const key = newRecoveryKey();
        expect((await deriveRecoveryKeys(key, kdf)).recoveryAuthKey).not.toBe(await authOf(key));
    });
});
