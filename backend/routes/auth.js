const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const router = express.Router();

const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fetchUser = require('../middleware/fetchUser');
const requirePassword = require('../middleware/requirePassword');
const { checkPassword, LOCKED_MESSAGE } = require('../utils/passwordGuard');
const connectToDb = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// When a token stops working, as a millisecond timestamp, so clients need not decode the JWT
const tokenExpiry = (token) => jwt.decode(token).exp * 1000;

const BCRYPT_COST = 12;

// `v` ties the token to the account's tokenVersion, which moves on when the password changes
const signToken = (id, version = 0) =>
    jwt.sign({ user: { id }, v: version }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' });

// ========================================================
// ROUTE 1: Register User (POST /api/auth/createuser, POST /api/auth/register)
// ========================================================
const handleCreateUser = async (req, res) => {
    let success = false;
    const errors = validationResult(req).array();
    if (errors.length !== 0) {
        return res.status(400).json({ success, errors });
    }

    try {
        const db = await connectToDb();

        // Check if user with same email already exists (case-insensitive)
        const normalizedEmail = req.body.email.toLowerCase().trim();
        const existingUser = await db.collection('users').findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({
                success,
                errors: [{ msg: 'Sorry, another account exists with this email!' }]
            });
        }

        // Hash the master password
        const secPass = await bcrypt.hash(req.body.password, BCRYPT_COST);

        const newUser = await db.collection('users').insertOne({
            username: req.body.username.trim(),
            email: normalizedEmail,
            password: secPass,
            tokenVersion: 0,
            createdAt: new Date(),
            lastLogin: new Date()
        });

        const authToken = signToken(newUser.insertedId);

        return res.status(201).json({ success: true, authToken, expiresAt: tokenExpiry(authToken) });
    } catch (err) {
        console.error('Registration error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

router.post('/register', [
    body('username', 'Username must contain at least 3 characters').isLength({ min: 3 }),
    body('email', 'Enter a valid email').isEmail(),
    body('password', 'Password must be at least 8 characters').isLength({ min: 8 })
], handleCreateUser);

// ========================================================
// ROUTE 2: Login User (POST /api/auth/login)
// ========================================================
router.post('/login', [
    body('email', 'Enter a valid email').isEmail(),
    body('password', 'Password cannot be blank').exists()
], async (req, res) => {
    let success = false;
    const errors = validationResult(req).array();
    if (errors.length !== 0) {
        return res.status(400).json({ success, errors });
    }

    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    try {
        const db = await connectToDb();

        const user = await db.collection('users').findOne({ email: normalizedEmail });

        const result = await checkPassword(db, user, password);
        if (result === 'locked') {
            return res.status(429).json({ success, errors: [{ msg: LOCKED_MESSAGE }] });
        }
        if (result !== 'ok') {
            return res.status(400).json({
                success,
                errors: [{ msg: 'Please login with valid credentials' }]
            });
        }

        // Update last login timestamp
        await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { lastLogin: new Date() } }
        );

        const authToken = signToken(user._id, user.tokenVersion);

        return res.json({ success: true, authToken, expiresAt: tokenExpiry(authToken) });
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ========================================================
// ROUTE 3: Get Logged In User (GET /api/auth/me, POST /api/auth/getuser)
// ========================================================
const handleGetUser = async (req, res) => {
    try {
        const db = await connectToDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(req.user.id) },
            { projection: { password: 0 } }
        );

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        return res.json(user);
    } catch (err) {
        console.error('Get user error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

router.get('/me', fetchUser, handleGetUser);

// ========================================================
// ROUTE 4: Change Master Password (POST /api/auth/change-password)
// ========================================================
const handleChangePassword = async (req, res) => {
    let success = false;
    const errors = validationResult(req).array();
    if (errors.length !== 0) {
        return res.status(400).json({ success, errors });
    }
    const { currentPassword, newPassword } = req.body;

    if (newPassword === currentPassword) {
        return res.status(400).json({
            success,
            error: 'New master password must be different from old master password'
        });
    }

    try {
        const db = await connectToDb();
        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);

        // Bumping tokenVersion signs out every other session, including a stolen token
        const user = await db.collection('users').findOneAndUpdate(
            { _id: new ObjectId(req.user.id) },
            { $set: { password: hashedPassword, updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
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
            expiresAt: tokenExpiry(authToken)
        });
    } catch (error) {
        console.error('Change password error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

const changePasswordValidation = [
    body('newPassword', 'Password must be at least 8 characters').isLength({ min: 8 })
];

router.post('/change-password', fetchUser, changePasswordValidation, requirePassword, handleChangePassword);

// ========================================================
// ROUTE 5: Delete Account (DELETE /api/auth/me)
// ========================================================
const handleDeleteUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const db = await connectToDb();

        // Delete user's passwords
        await db.collection('passwords').deleteMany({ user: new ObjectId(userId) });

        // Delete user account
        await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        return res.status(200).json({
            success: true,
            message: 'User and associated data deleted successfully.'
        });
    } catch (error) {
        console.error('Delete user error:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

router.delete('/me', fetchUser, requirePassword, handleDeleteUser);

module.exports = router;
