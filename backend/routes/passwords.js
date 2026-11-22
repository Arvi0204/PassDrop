const express = require('express');
const router = express.Router();
const fetchUser = require('../middleware/fetchUser');
const requirePassword = require('../middleware/requirePassword');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const connectToDb = require('../db');
const { isBlob } = require('../utils/vaultFields');
const removeDrops = require('../utils/removeDrops');

// Every login is one encrypted blob made in the browser. The server cannot read it: it stores the blob next to the owner
// and the times, and hands it back. (Titles, addresses, usernames, passwords and notes are all inside the blob.)

const getPasswordsCollection = async () => {
    const db = await connectToDb();
    return db.collection('passwords');
};

// The owner id is internal
const toClient = ({ user, ...item }) => item;

const blobValidation = [body('blob', 'Something went wrong saving this login. Reload the page and try again.').custom(isBlob)];

// GET all passwords
router.get('/', fetchUser, async (req, res) => {
    try {
        const collection = await getPasswordsCollection();
        const records = await collection
            .find({ user: new ObjectId(req.user.id) })
            .sort({ createdAt: -1 })
            .toArray();
        return res.json(records.map(toClient));
    } catch (error) {
        console.error('Error fetching passwords:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// CREATE new password item
router.post('/', fetchUser, blobValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const collection = await getPasswordsCollection();
        const newDoc = { blob: req.body.blob, user: new ObjectId(req.user.id), createdAt: new Date(), updatedAt: new Date() };
        const result = await collection.insertOne(newDoc);
        return res.status(201).json(toClient({ ...newDoc, _id: result.insertedId }));
    } catch (error) {
        console.error('Error saving password:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// UPDATE existing password item (replaces the blob)
router.put('/:id', fetchUser, blobValidation, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'Invalid password ID format' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const collection = await getPasswordsCollection();
        const existing = await collection.findOne({ _id: new ObjectId(id) });

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Password entry not found' });
        }

        if (existing.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized to modify this entry' });
        }

        const updated = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { blob: req.body.blob, updatedAt: new Date() } },
            { returnDocument: 'after' }
        );
        return res.json(toClient(updated?.value || updated));
    } catch (error) {
        console.error('Error updating password:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// DELETE single password item
router.delete('/:id', fetchUser, async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'Invalid password ID format' });
    }

    try {
        const collection = await getPasswordsCollection();
        const existing = await collection.findOne({ _id: new ObjectId(id) });

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Password entry not found' });
        }

        if (existing.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized to delete this entry' });
        }

        // the links made from this login end with it (first, so a failure here can never leave a link without its login)
        await removeDrops(await connectToDb(), { login: existing._id, owner: new ObjectId(req.user.id) });
        await collection.deleteOne({ _id: new ObjectId(id) });
        return res.json({ success: true, message: 'Password deleted successfully', deletedPass: { _id: existing._id } });
    } catch (error) {
        console.error('Error deleting password:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// DELETE all passwords for the user (asks for the master password again)
router.delete('/', fetchUser, requirePassword, async (req, res) => {
    try {
        const collection = await getPasswordsCollection();
        // every link was made from one of these logins, so all of the user's links end with them
        await removeDrops(await connectToDb(), { owner: new ObjectId(req.user.id) });
        const result = await collection.deleteMany({ user: new ObjectId(req.user.id) });

        return res.json({
            success: true,
            message: 'All passwords deleted successfully',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Error deleting all passwords:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

module.exports = router;
