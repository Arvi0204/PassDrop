const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const router = express.Router();

const { ObjectId } = require('mongodb');
const { body, query, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetchUser = require('../middleware/fetchUser');
const requirePassword = require('../middleware/requirePassword');
const { checkPassword, LOCKED_MESSAGE } = require('../utils/passwordGuard');
const { isBase64Of, isKdf, isWrappedKey } = require('../utils/vaultFields');
const { fakeKdfFor } = require('../utils/kdf');
const removeDrops = require('../utils/removeDrops');
const connectToDb = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// When a token stops working, as a millisecond timestamp, so clients need not decode the JWT
const tokenExpiry = (token) => jwt.decode(token).exp * 1000;

const BCRYPT_COST = 12;

// `v` ties the token to the account's tokenVersion, which moves on when the password changes
const signToken = (id, version = 0) =>
    jwt.sign({ user: { id }, v: version }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });

// What the browser needs after signing in to unlock the vault: the key-derivation settings and the wrapped vault key
const signInPayload = (user, authToken) => ({
    success: true,
    authToken,
    expiresAt: tokenExpiry(authToken),
    userId: String(user._id),
    kdf: user.kdf,
    wrappedVaultKey: user.wrappedVaultKey
});

// The server never receives a master password or recovery key, only keys derived from them (see frontend/src/lib/vaultCrypto.js).
const KEY_PROBLEM = 'Something went wrong preparing your password. Reload the page and try again.';
const authKeyField = (name) => body(name, KEY_PROBLEM).custom((v) => isBase64Of(v, 32));
const kdfField = (name) => body(name, KEY_PROBLEM).custom(isKdf);
const wrappedField = (name) => body(name, KEY_PROBLEM).custom(isWrappedKey);
const emailField = body('email', 'Enter a valid email').trim().isEmail();

const BAD_CREDENTIALS = 'Please login with valid credentials';
const BAD_RECOVERY = 'Check the email and recovery key.';

const normalizeEmail = (email) => email.toLowerCase().trim();

// ========================================================
// ROUTE 0: Key-derivation settings for an email (GET /api/auth/prelogin?email=)
// The browser needs the salt before it can compute its proof. An unknown email gets a believable, stable fake,
// so this cannot be used to find out who has an account.
// ========================================================
router.get('/prelogin', [query('email', 'Enter a valid email').trim().isEmail()], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) return res.status(400).json({ success: false, errors });
    try {
        const db = await connectToDb();
        const email = normalizeEmail(req.query.email);
        const user = await db.collection('users').findOne({ email }, { projection: { kdf: 1 } });
        return res.json({ success: true, kdf: user?.kdf || fakeKdfFor(email) });
    } catch (err) {
        console.error('Prelogin error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 1: Register User (POST /api/auth/register)
// ========================================================
router.post('/register', [
    body('username', 'Username must contain 3 to 64 characters').isString().bail().trim().isLength({ min: 3, max: 64 }),
    emailField,
    authKeyField('authKey'),
    kdfField('kdf'),
    wrappedField('wrappedVaultKey'),
    wrappedField('recoveryWrappedKey'),
    authKeyField('recoveryAuthKey')
], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) {
        return res.status(400).json({ success: false, errors });
    }

    const duplicate = () => res.status(400).json({ success: false, errors: [{ msg: 'Sorry, another account exists with this email!' }] });

    try {
        const db = await connectToDb();
        const email = normalizeEmail(req.body.email);
        if (await db.collection('users').findOne({ email })) return duplicate();

        const [authHash, recoveryAuthHash] = await Promise.all([
            bcrypt.hash(req.body.authKey, BCRYPT_COST),
            bcrypt.hash(req.body.recoveryAuthKey, BCRYPT_COST)
        ]);
        const { kdf, wrappedVaultKey, recoveryWrappedKey } = req.body;

        let newUser;
        try {
            newUser = await db.collection('users').insertOne({
                username: req.body.username.trim(),
                email,
                authHash,
                kdf: { name: kdf.name, iterations: kdf.iterations, salt: kdf.salt },
                wrappedVaultKey,
                recoveryWrappedKey,
                recoveryAuthHash,
                v: 2,
                tokenVersion: 0,
                createdAt: new Date(),
                lastLogin: new Date()
            });
        } catch (err) {
            if (err.code === 11000) return duplicate(); // two sign-ups on one email at the same moment
            throw err;
        }

        const authToken = signToken(newUser.insertedId);
        return res.status(201).json({ success: true, authToken, expiresAt: tokenExpiry(authToken), userId: String(newUser.insertedId) });
    } catch (err) {
        console.error('Registration error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 2: Login User (POST /api/auth/login)
// ========================================================
router.post('/login', [emailField, authKeyField('authKey')], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) {
        return res.status(400).json({ success: false, errors });
    }

    try {
        const db = await connectToDb();
        const user = await db.collection('users').findOne({ email: normalizeEmail(req.body.email) });

        const result = await checkPassword(db, user, req.body.authKey);
        if (result === 'locked') {
            return res.status(429).json({ success: false, errors: [{ msg: LOCKED_MESSAGE }] });
        }
        if (result !== 'ok') {
            return res.status(400).json({ success: false, errors: [{ msg: BAD_CREDENTIALS }] });
        }

        await db.collection('users').updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        return res.json(signInPayload(user, signToken(user._id, user.tokenVersion)));
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 3: Get Logged In User (GET /api/auth/me)
// What a signed-in browser needs to unlock the vault again: the settings and the wrapped key (both useless without
// the master password). Nothing secret is returned.
// ========================================================
router.get('/me', fetchUser, async (req, res) => {
    try {
        const db = await connectToDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: { username: 1, email: 1, createdAt: 1, lastLogin: 1, kdf: 1, wrappedVaultKey: 1 } }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json(user);
    } catch (err) {
        console.error('Get user error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 4: Change Master Password (POST /api/auth/change-password)
// The vault key is not re-encrypted, only re-wrapped, so this is cheap. The account's salt must stay the same: the
// recovery key is derived with it, and would stop working if it changed.
// ========================================================
router.post('/change-password', fetchUser, requirePassword, [
    authKeyField('newAuthKey'),
    kdfField('newKdf'),
    wrappedField('newWrappedVaultKey')
], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) {
        return res.status(400).json({ success: false, errors });
    }
    const { currentAuthKey, newAuthKey, newKdf, newWrappedVaultKey } = req.body;

    if (newAuthKey === currentAuthKey) {
        return res.status(400).json({
            success: false,
            error: 'New master password must be different from old master password'
        });
    }

    try {
        const db = await connectToDb();
        const current = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) }, { projection: { kdf: 1 } });
        if (!current) return res.status(404).json({ success: false, error: 'User not found' });
        if (newKdf.salt !== current.kdf.salt) {
            return res.status(400).json({ success: false, errors: [{ msg: KEY_PROBLEM }] });
        }

        const authHash = await bcrypt.hash(newAuthKey, BCRYPT_COST);
        const kdf = { name: newKdf.name, iterations: newKdf.iterations, salt: newKdf.salt };

        // Bumping tokenVersion signs out every other session, including a stolen token
        const user = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(req.user.id) },
            { $set: { authHash, kdf, wrappedVaultKey: newWrappedVaultKey, updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
            { returnDocument: 'after', projection: { tokenVersion: 1 } }
        );
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // The caller gets a fresh token so this session stays signed in
        const authToken = signToken(req.user.id, user.tokenVersion);
        return res.status(200).json({
            success: true,
            message: 'Password updated successfully! Other sessions were signed out',
            authToken,
            expiresAt: tokenExpiry(authToken),
            kdf,
            wrappedVaultKey: newWrappedVaultKey
        });
    } catch (error) {
        console.error('Change password error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 5: Delete Account (DELETE /api/auth/me)
// ========================================================
router.delete('/me', fetchUser, requirePassword, async (req, res) => {
    try {
        const userId = req.user.id;
        const db = await connectToDb();

        await db.collection('passwords').deleteMany({ user: new ObjectId(userId) });
        await removeDrops(db, { owner: new ObjectId(userId) });
        await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        return res.status(200).json({
            success: true,
            message: 'User and associated data deleted successfully.'
        });
    } catch (error) {
        console.error('Delete user error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 6: Recover an account with the recovery key
//   POST /api/auth/recovery/unlock  proves the recovery key and returns the vault key wrapped for it
//   POST /api/auth/recovery/reset   proves it again and sets a new master password (re-wrapping the vault key)
// Both count wrong proofs toward a 15-minute lockout of their own, separate from sign-in's, so guessing recovery proofs
// for an email cannot lock its owner out of signing in (and the other way round).
// ========================================================
const checkRecovery = async (db, req, res) => {
    const user = await db.collection('users').findOne({ email: normalizeEmail(req.body.email) });
    const result = await checkPassword(db, user, req.body.recoveryAuthKey, 'recoveryAuthHash');
    if (result === 'locked') {
        res.status(429).json({ success: false, errors: [{ msg: LOCKED_MESSAGE }] });
        return null;
    }
    if (result !== 'ok') {
        res.status(400).json({ success: false, errors: [{ msg: BAD_RECOVERY }] });
        return null;
    }
    return user;
};

router.post('/recovery/unlock', [emailField, authKeyField('recoveryAuthKey')], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) return res.status(400).json({ success: false, errors });
    try {
        const db = await connectToDb();
        const user = await checkRecovery(db, req, res);
        if (!user) return;
        return res.json({ success: true, kdf: user.kdf, recoveryWrappedKey: user.recoveryWrappedKey });
    } catch (err) {
        console.error('Recovery unlock error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

router.post('/recovery/reset', [
    emailField,
    authKeyField('recoveryAuthKey'),
    authKeyField('newAuthKey'),
    kdfField('newKdf'),
    wrappedField('newWrappedVaultKey')
], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) return res.status(400).json({ success: false, errors });
    try {
        const db = await connectToDb();
        const user = await checkRecovery(db, req, res);
        if (!user) return;
        const { newAuthKey, newKdf, newWrappedVaultKey } = req.body;
        if (newKdf.salt !== user.kdf.salt) return res.status(400).json({ success: false, errors: [{ msg: KEY_PROBLEM }] });

        const kdf = { name: newKdf.name, iterations: newKdf.iterations, salt: newKdf.salt };
        const updated = await db.collection('users').findOneAndUpdate(
            { _id: user._id },
            { $set: { authHash: await bcrypt.hash(newAuthKey, BCRYPT_COST), kdf, wrappedVaultKey: newWrappedVaultKey, updatedAt: new Date(), lastLogin: new Date(), failedAttempts: 0 }, $unset: { lockUntil: '' }, $inc: { tokenVersion: 1 } },
            { returnDocument: 'after' }
        );
        if (!updated) return res.status(404).json({ success: false, error: 'Account not found' });
        return res.json(signInPayload(updated, signToken(updated._id, updated.tokenVersion)));
    } catch (err) {
        console.error('Recovery reset error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 7: Replace the recovery key (POST /api/auth/recovery/rotate)
// Signed in, and the master password proven again. The browser has made a new recovery key and sends only its proof and
// the vault key wrapped by it; the old recovery key stops working. Like GitHub's recovery codes or Proton's recovery
// phrase, this can be done whenever, so a key that was never saved (or was lost) is never the end of the story.
// ========================================================
router.post('/recovery/rotate', fetchUser, requirePassword, [
    authKeyField('recoveryAuthKey'),
    wrappedField('recoveryWrappedKey')
], async (req, res) => {
    const errors = validationResult(req).array();
    if (errors.length !== 0) return res.status(400).json({ success: false, errors });
    try {
        const db = await connectToDb();
        const { recoveryAuthKey, recoveryWrappedKey } = req.body;
        await db.collection('users').updateOne(
            { _id: new ObjectId(req.user.id) },
            { $set: { recoveryAuthHash: await bcrypt.hash(recoveryAuthKey, BCRYPT_COST), recoveryWrappedKey, recoveryUpdatedAt: new Date() } }
        );
        return res.json({ success: true });
    } catch (err) {
        console.error('Recovery rotate error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
