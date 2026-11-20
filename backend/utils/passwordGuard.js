const bcrypt = require('bcryptjs');

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_MS = 15 * 60 * 1000;

// Compared against when the email is unknown, so a missing account takes as long as a wrong proof
const DUMMY_HASH = '$2a$12$73pTzGxvxtvQMSg14/vfH.12EjMVVKEE/Q9AnFoHACKT.JcAVmhky';

/**
 * Checks a proof (the authKey derived from the master password, or the one derived from the recovery key) and counts
 * failures on the account. The server never sees the master password itself, only these derived proofs.
 * `hashField` is the stored hash to compare with: 'authHash' or 'recoveryAuthHash'.
 * Resolves to 'ok', 'bad' or 'locked'. `user` may be null (unknown email).
 */
const checkPassword = async (db, user, secret, hashField = 'authHash') => {
    if (!user || typeof user[hashField] !== 'string') {
        await bcrypt.compare(String(secret), DUMMY_HASH);
        return 'bad';
    }
    if (user.lockUntil && user.lockUntil > new Date()) return 'locked';

    const users = db.collection('users');
    if (await bcrypt.compare(String(secret), user[hashField])) {
        if (user.failedAttempts || user.lockUntil) {
            await users.updateOne({ _id: user._id }, { $set: { failedAttempts: 0 }, $unset: { lockUntil: '' } });
        }
        return 'ok';
    }

    const { failedAttempts } = await users.findOneAndUpdate(
        { _id: user._id },
        { $inc: { failedAttempts: 1 } },
        { returnDocument: 'after', projection: { failedAttempts: 1 } }
    );
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await users.updateOne(
            { _id: user._id },
            { $set: { failedAttempts: 0, lockUntil: new Date(Date.now() + LOCK_MS) } }
        );
    }
    return 'bad';
};

const LOCKED_MESSAGE = 'Too many failed attempts. Try again in a few minutes.';

module.exports = { checkPassword, LOCKED_MESSAGE };
