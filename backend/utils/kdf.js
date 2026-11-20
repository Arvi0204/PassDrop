const crypto = require('node:crypto');
const { KDF_MIN_ITERATIONS } = require('./vaultFields');

/**
 * The key-derivation settings the server pretends an unknown email has, so asking for them reveals nothing: the salt is
 * stable for one email (asking twice gives the same answer, as for a real account) and unguessable without JWT_SECRET.
 */
const fakeKdfFor = (email) => {
    const mac = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`prelogin-v1:${String(email).toLowerCase().trim()}`).digest();
    return { name: 'PBKDF2-SHA256', iterations: KDF_MIN_ITERATIONS, salt: mac.subarray(0, 16).toString('base64') };
};

module.exports = { fakeKdfFor };
