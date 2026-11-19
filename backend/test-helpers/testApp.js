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
// fresh random keys on every run, so no key is written down anywhere and a test can never depend on a particular one
// (the test database is thrown away at the end, so nothing encrypted needs to be readable next time)
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
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

/** An empty database, for the start of each test. */
const reset = async () => (await connectToDb()).dropDatabase();

// Hashing at the real cost (12) takes a few hundred milliseconds. A hash made cheaper still checks the same
// way (the cost is stored in the hash), so test users are created with a cheap one; the register test uses the real route.
const CHEAP = 4;

async function seedUser({ email = 'user@example.com', username = 'user', password = 'correct-horse-battery' } = {}) {
    const { insertedId } = await (await collection('users')).insertOne({
        username, email, password: await bcrypt.hash(password, CHEAP), tokenVersion: 0, createdAt: new Date(), lastLogin: new Date()
    });
    return { id: insertedId, email, password };
}

async function login({ email, password }) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    return res.body.authToken;
}

/** A user who is signed in: { id, email, password, token } */
async function signedInUser(options) {
    const user = await seedUser(options);
    return { ...user, token: await login(user) };
}

module.exports = { app, request: () => request(app), collection, all, reset, seedUser, login, signedInUser };
