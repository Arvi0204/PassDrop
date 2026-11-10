const express = require('express');
const router = express.Router();
const fetchUser = require('../middleware/fetchUser');
const requirePassword = require('../middleware/requirePassword');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const connectToDb = require('../db');
const { encrypt, decrypt } = require('../utils/encryption');

// Helper to get the passwords collection
const getPasswordsCollection = async () => {
    const db = await connectToDb();
    return db.collection('passwords');
};

// Helper to safely decrypt a stored password record
const toDecryptedItem = (item) => {
    try {
        return {
            ...item,
            password: item.iv && item.password
                ? decrypt({ iv: item.iv, encryptedData: item.password })
                : item.password
        };
    } catch (err) {
        console.error(`Failed to decrypt password for item ${item._id}:`, err.message);
        return { ...item, password: '' };
    }
};

// Internal fields (the encryption IV and the owner id) are not part of the API
const toClient = ({ iv, user, ...item }) => item;

// ==========================================
// Handlers for both RESTful and legacy paths
// ==========================================

// GET all passwords
const handleGetAll = async (req, res) => {
    try {
        const collection = await getPasswordsCollection();
        const records = await collection
            .find({ user: new ObjectId(req.user.id) })
            .sort({ createdAt: -1 })
            .toArray();

        const decryptedRecords = records.map(toDecryptedItem).map(toClient);
        return res.json(decryptedRecords);
    } catch (error) {
        console.error('Error fetching passwords:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// CREATE new password item
const handleCreate = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { url = '', username = '', password, title, notes, isFavorite } = req.body;

    try {
        const collection = await getPasswordsCollection();
        const { iv, encryptedData } = encrypt(password);

        const newDoc = {
            url,
            username,
            password: encryptedData,
            iv: iv.toString('hex'),
            title: title || '',
            notes: notes || '',
            isFavorite: Boolean(isFavorite),
            user: new ObjectId(req.user.id),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collection.insertOne(newDoc);

        // Return the created item with PLAINTEXT password so frontend state stays consistent
        return res.status(201).json(toClient({
            ...newDoc,
            _id: result.insertedId,
            password // Keep plaintext in response for immediate client use
        }));
    } catch (error) {
        console.error('Error saving password:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// UPDATE existing password item
const handleUpdate = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, error: 'Invalid password ID format' });
    }

    const { url, username, password, title, notes, isFavorite } = req.body;

    try {
        const collection = await getPasswordsCollection();
        const existing = await collection.findOne({ _id: new ObjectId(id) });

        if (!existing) {
            return res.status(404).json({ success: false, error: 'Password entry not found' });
        }

        if (existing.user.toString() !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized to modify this entry' });
        }

        const updates = { updatedAt: new Date() };
        if (url !== undefined) updates.url = url;
        if (username !== undefined) updates.username = username;
        if (title !== undefined) updates.title = title;
        if (notes !== undefined) updates.notes = notes;
        if (isFavorite !== undefined) updates.isFavorite = Boolean(isFavorite);

        if (password) {
            const { iv, encryptedData } = encrypt(password);
            updates.iv = iv.toString('hex');
            updates.password = encryptedData;
        }

        const updatedDoc = await collection.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updates },
            { returnDocument: 'after' }
        );

        // In MongoDB Node driver v6, findOneAndUpdate returns document directly (or inside .value depending on version)
        const docToReturn = updatedDoc?.value || updatedDoc;
        const decryptedDoc = toDecryptedItem(docToReturn);

        // If password was updated with new plaintext, reflect it directly
        if (password) {
            decryptedDoc.password = password;
        }

        return res.json(toClient(decryptedDoc));
    } catch (error) {
        console.error('Error updating password:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// DELETE single password item
const handleDelete = async (req, res) => {
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

        await collection.deleteOne({ _id: new ObjectId(id) });
        return res.json({ success: true, message: 'Password deleted successfully', deletedPass: toClient({ ...existing, password: undefined }) });
    } catch (error) {
        console.error('Error deleting password:', error.message);
        return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// DELETE all passwords for the user
const handleDeleteAll = async (req, res) => {
    try {
        const collection = await getPasswordsCollection();
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
};

// ==========================================
// RESTful Routes
// ==========================================

const createValidation = [
    body('password', 'Password cannot be blank').notEmpty()
];

// GET all credentials for logged-in user
router.get('/', fetchUser, handleGetAll);

// CREATE new credential
router.post('/', fetchUser, createValidation, handleCreate);

// UPDATE credential by ID
router.put('/:id', fetchUser, handleUpdate);

// DELETE single credential by ID
router.delete('/:id', fetchUser, handleDelete);

// DELETE all credentials for logged-in user
router.delete('/', fetchUser, requirePassword, handleDeleteAll);

module.exports = router;
