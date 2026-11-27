const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

let client;
let db;

/**
 * One account per email (also settles two simultaneous sign-ups), a quick way to list one user's logins, and the
 * clean-up of drops. They are made together, so a cold start waits for one round trip instead of six, and one that
 * cannot be built (say, two old accounts on one email) is reported without stopping the others.
 */
const ensureIndexes = async (database) => {
    const results = await Promise.allSettled([
        database.collection('users').createIndex({ email: 1 }, { unique: true }),
        database.collection('passwords').createIndex({ user: 1 }),
        // a drop is deleted by the database shortly after it ends (routes/drops.js also never serves one past its end)
        database.collection('drops').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        database.collection('drops').createIndex({ owner: 1 }),
        // a drop's history (no blob) is deleted by the database 30 days after the link ended
        database.collection('droplog').createIndex({ purgeAt: 1 }, { expireAfterSeconds: 0 }),
        database.collection('droplog').createIndex({ owner: 1 })
    ]);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
};

/**
 * Connect to MongoDB and reuse connection across invocations.
 * Safe for both traditional persistent servers and serverless environments.
 */
const connectToDb = async () => {
    if (db) {
        return db;
    }

    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in environment variables');
    }

    if (!client) {
        client = new MongoClient(process.env.MONGODB_URI, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
        });
    }

    try {
        await client.connect();
        const dbName = process.env.DB_NAME || 'PassDrop';
        db = client.db(dbName);
        console.log(`Connected to MongoDB database: ${dbName}`);
        try {
            await ensureIndexes(db);
        } catch (err) {
            // an index that cannot be built (say, two old accounts on one email) must not take the whole API down
            console.error('Could not create indexes:', err.message);
        }
        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        throw err;
    }
};

connectToDb.ensureIndexes = ensureIndexes;
module.exports = connectToDb;
