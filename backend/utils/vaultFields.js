// Checks for the values a client sends that the server stores but cannot read: derived keys, key-derivation settings
// and wrapped keys. The server cannot judge their content, only their shape and size.

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const SEALED = /^v1\.[A-Za-z0-9+/]+={0,2}\.[A-Za-z0-9+/]+={0,2}$/; // v1.<iv>.<ciphertext>, as vaultCrypto.js writes them

const KDF_MIN_ITERATIONS = 600000;
const KDF_MAX_ITERATIONS = 10000000;

/** True for a base64 string that decodes to exactly `bytes` bytes. */
const isBase64Of = (v, bytes) =>
    typeof v === 'string' && BASE64.test(v) && Buffer.from(v, 'base64').length === bytes && Buffer.from(v, 'base64').toString('base64') === v;

const isKdf = (v) =>
    Boolean(v) && typeof v === 'object' && v.name === 'PBKDF2-SHA256' &&
    Number.isInteger(v.iterations) && v.iterations >= KDF_MIN_ITERATIONS && v.iterations <= KDF_MAX_ITERATIONS &&
    isBase64Of(v.salt, 16);

const isWrappedKey = (v) => typeof v === 'string' && v.length <= 512 && SEALED.test(v);

module.exports = { KDF_MIN_ITERATIONS, isBase64Of, isKdf, isWrappedKey };
