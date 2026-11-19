const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const uri = process.env.MONGODB_URI;
let client;
let db;

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
        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        throw err;
    }
};

module.exports = connectToDb;
