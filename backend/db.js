const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

let client;
let db;

/** One account per email (also settles two simultaneous sign-ups), and a quick way to list one user's logins. */
const ensureIndexes = async (database) => {
    await database.collection('users').createIndex({ email: 1 }, { unique: true });
    await database.collection('passwords').createIndex({ user: 1 });
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
