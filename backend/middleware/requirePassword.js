const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');
const connectToDb = require('../db');

// Destructive actions ask for the master password again, so a stolen token alone cannot do them
const requirePassword = async (req, res, next) => {
    const { currentPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword) {
        return res.status(400).json({ success: false, error: 'Enter your current master password' });
    }

    try {
        const db = await connectToDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
        if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(403).json({ success: false, error: 'Current master password is incorrect' });
        }
        next();
    } catch (err) {
        console.error('Re-authentication error:', err.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

module.exports = requirePassword;
