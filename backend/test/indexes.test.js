const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
require('../test-helpers/testApp'); // starts the throwaway MongoDB for this file
const connectToDb = require('../db');

describe('the database indexes', () => {
    test('one that cannot be built is reported, and does not stop the others being made', async () => {
        const db = await connectToDb();
        await db.dropDatabase();
        // two accounts on one email: the unique email index cannot be built
        await db.collection('users').insertMany([{ email: 'same@example.com' }, { email: 'same@example.com' }]);

        await assert.rejects(() => connectToDb.ensureIndexes(db));

        const names = async (collection) => (await db.collection(collection).indexes()).map((index) => index.name);
        assert.ok((await names('passwords')).includes('user_1'));
        assert.ok((await names('drops')).includes('expiresAt_1'));
        assert.ok((await names('drops')).includes('owner_1'));
        assert.ok((await names('droplog')).includes('purgeAt_1'));
        assert.ok((await names('droplog')).includes('owner_1'));
    });

    test('are all made when nothing is wrong, and making them again changes nothing', async () => {
        const db = await connectToDb();
        await db.dropDatabase();
        await connectToDb.ensureIndexes(db);
        await connectToDb.ensureIndexes(db);
        assert.ok((await db.collection('users').indexes()).some((index) => index.name === 'email_1' && index.unique));
    });
});
