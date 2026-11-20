const { ObjectId } = require('mongodb');
const connectToDb = require('../db');
const { checkPassword, LOCKED_MESSAGE } = require('../utils/passwordGuard');
const { isBase64Of } = require('../utils/vaultFields');

// Destructive actions ask for the master password again, so a stolen token alone cannot do them.
// The browser proves it with `currentAuthKey`, a key derived from the master password; the password itself never arrives.
const requirePassword = async (req, res, next) => {
    const { currentAuthKey } = req.body || {};
    if (!isBase64Of(currentAuthKey, 32)) {
        return res.status(400).json({ success: false, error: 'Enter your current master password' });
    }

    try {
        const db = await connectToDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
        const result = await checkPassword(db, user, currentAuthKey);
        if (result === 'locked') {
            return res.status(429).json({ success: false, error: LOCKED_MESSAGE });
        }
        if (result !== 'ok') {
            return res.status(403).json({ success: false, error: 'Current master password is incorrect' });
        }
        next();
    } catch (err) {
        console.error('Re-authentication error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = requirePassword;
