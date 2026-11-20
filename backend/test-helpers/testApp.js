// Boots the real Express app for a test, against a real MongoDB that is started just for the test file and
// thrown away afterwards (mongodb-memory-server-core; the MongoDB version is pinned in package.json under
// "config", and its program is downloaded once into ~/.cache/mongodb-binaries the first time tests run).
// The settings are set before the app loads, so a test never reaches a real database, not even one named
// in backend/.env: the address below is a placeholder until the temporary MongoDB is up, and `before` refuses
// to carry on unless that address is on this computer.

const crypto = require('node:crypto');
const { before, after } = require('node:test');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server-core');

process.env.NODE_ENV = 'test';
// a fresh random secret on every run, so none is written down anywhere and a test can never depend on a particular one
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.MONGODB_URI = 'mongodb://never-connects.invalid/'; // set first, so dotenv cannot bring in the one from backend/.env

const connectToDb = require('../db');
const app = require('../server');

let mongod;

before(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    if (!uri.startsWith('mongodb://127.0.0.1')) throw new Error(`refusing to run tests against ${uri}`);
    process.env.MONGODB_URI = uri; // the app connects on its first request, and reads this then
});

after(async () => {
    const db = await connectToDb();
    await db.client.close(); // otherwise the open connection keeps the test process alive
    await mongod.stop();
});

const collection = async (name) => (await connectToDb()).collection(name);

/** Every stored document of a collection, to check what the app really saved. */
const all = async (name) => (await collection(name)).find().toArray();

/** An empty database, for the start of each test (dropping it drops its indexes, so they are made again). */
const reset = async () => {
    const db = await connectToDb();
    await db.dropDatabase();
    await connectToDb.ensureIndexes(db);
};

// Hashing at the real cost (12) takes a few hundred milliseconds. A hash made cheaper still checks the same
// way (the cost is stored in the hash), so test users are created with a cheap one; the register test uses the real route.
const CHEAP = 4;
const random = (bytes) => crypto.randomBytes(bytes).toString('base64');
const sealed = () => `v1.${random(12)}.${random(48)}`; // looks like a wrapped key; the server cannot tell it is not one

/**
 * A v2 user, as the browser would have created them. The server only ever stores derived proofs, so the tests make up
 * random ones: the returned authKey is what the browser would send to sign in or re-authenticate, and recoveryAuthKey
 * what it would send to recover. Nothing here is a real password.
 */
async function seedUser({ email = 'user@example.com', username = 'user' } = {}) {
    const authKey = random(32);
    const recoveryAuthKey = random(32);
    const kdf = { name: 'PBKDF2-SHA256', iterations: 600000, salt: random(16) };
    const doc = {
        username, email, authHash: await bcrypt.hash(authKey, CHEAP), kdf, wrappedVaultKey: sealed(),
        recoveryWrappedKey: sealed(), recoveryAuthHash: await bcrypt.hash(recoveryAuthKey, CHEAP),
        v: 2, tokenVersion: 0, createdAt: new Date(), lastLogin: new Date()
    };
    const { insertedId } = await (await collection('users')).insertOne(doc);
    return { id: insertedId, email, authKey, recoveryAuthKey, kdf, wrappedVaultKey: doc.wrappedVaultKey, recoveryWrappedKey: doc.recoveryWrappedKey };
}

async function login({ email, authKey }) {
    const res = await request(app).post('/api/auth/login').send({ email, authKey });
    return res.body.authToken;
}

/** A user who is signed in: { id, email, authKey, ..., token } */
async function signedInUser(options) {
    const user = await seedUser(options);
    return { ...user, token: await login(user) };
}

/** What the browser sends to register, with random stand-ins for the derived keys. */
const registrationBody = (overrides = {}) => ({
    username: 'Ada', email: 'ada@example.com', authKey: random(32),
    kdf: { name: 'PBKDF2-SHA256', iterations: 600000, salt: random(16) },
    wrappedVaultKey: sealed(), recoveryWrappedKey: sealed(), recoveryAuthKey: random(32), ...overrides
});

/** An encrypted item as the browser would store it (the server cannot tell it from a real one). */
const blob = () => `v1.${random(12)}.${random(80)}`;

module.exports = { app, request: () => request(app), collection, all, reset, seedUser, login, signedInUser, registrationBody, blob, random, sealed };
