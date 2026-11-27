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
    // Recovery has its own counter, so someone guessing recovery proofs for an email cannot lock the owner out of sign-in
    const [attempts, lock] = hashField === 'recoveryAuthHash' ? ['recoveryFailedAttempts', 'recoveryLockUntil'] : ['failedAttempts', 'lockUntil'];
    if (user[lock] && user[lock] > new Date()) return 'locked';

    const users = db.collection('users');
    if (await bcrypt.compare(String(secret), user[hashField])) {
        if (user[attempts] || user[lock]) {
            await users.updateOne({ _id: user._id }, { $set: { [attempts]: 0 }, $unset: { [lock]: '' } });
        }
        return 'ok';
    }

    const updated = await users.findOneAndUpdate(
        { _id: user._id },
        { $inc: { [attempts]: 1 } },
        { returnDocument: 'after', projection: { [attempts]: 1 } }
    );
    if (updated?.[attempts] >= MAX_FAILED_ATTEMPTS) {
        await users.updateOne(
            { _id: user._id },
            { $set: { [attempts]: 0, [lock]: new Date(Date.now() + LOCK_MS) } }
        );
    }
    return 'bad';
};

const LOCKED_MESSAGE = 'Too many failed attempts. Try again in a few minutes.';

module.exports = { checkPassword, LOCKED_MESSAGE };
