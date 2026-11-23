const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const fetchUser = require('../middleware/fetchUser');
const { ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const connectToDb = require('../db');
const { isBlob } = require('../utils/vaultFields');

// A drop shares one login by a link. The browser encrypts the login with a fresh share key that lives only in the link's
// #fragment, so the server stores a blob it cannot read. The rule is either a number of views or a timer (never both);
// when it runs out the drop is deleted. Only the sender (the owner) can list or revoke their drops; anyone with the link
// can open one, no account needed. A drop also records which of the sender's logins it was made from (the login's opaque
// record id, never its content): routes/passwords.js deletes a login's drops with the login, so none can outlive it.
// Besides the drop, the sender gets a history row (collection `droplog`, no blob): when it was made, how many times it was
// opened, and when and why it ended. The database deletes it 30 days after the link ended, so the list cannot grow for ever.

const MAX_VIEWS = 10;
const TTLS = [600, 3600, 86400, 604800]; // seconds: 10 minutes, 1 hour, 24 hours, 7 days
const VIEWS_BACKSTOP_MS = 7 * 86400 * 1000; // a views drop nobody opens does not live forever
const MAX_LIVE_PER_USER = 25;
const ID = /^[A-Za-z0-9_-]{22}$/; // 128 random bits, base64url
const GONE = 'This drop is gone';
const HISTORY_MS = 30 * 86400 * 1000; // how long the history of an ended link is kept
const HISTORY_LIMIT = 200;

const getDrops = async () => (await connectToDb()).collection('drops');
const getLog = async () => (await connectToDb()).collection('droplog');
// the history is a record for the sender, never the thing that decides whether a link works: a failure here is logged and
// must not fail the request that already did the real work
const record = (promise) => promise.catch((error) => console.error('Drop history error:', error.message));
const endedNow = (why, now) => ({ endedAt: now, endedBy: why, purgeAt: new Date(now.getTime() + HISTORY_MS) });

// a drop that can still be opened: not past its end, and (for views) with a view left
const live = (now) => ({ expiresAt: { $gt: now }, $or: [{ mode: 'timer' }, { viewsLeft: { $gt: 0 } }] });

const ruleIsValid = (mode, { req }) => {
    if (mode === 'views') return Number.isInteger(req.body.views) && req.body.views >= 1 && req.body.views <= MAX_VIEWS;
    if (mode === 'timer') return TTLS.includes(req.body.ttl);
    return false;
};

const createValidation = [
    body('login', 'Something went wrong making this drop. Reload the page and try again.').custom((v) => typeof v === 'string' && v.length === 24 && ObjectId.isValid(v)),
    body('blob', 'Something went wrong making this drop. Reload the page and try again.').custom(isBlob),
    body('label', 'Something went wrong making this drop. Reload the page and try again.').custom(isBlob),
    body('mode', 'Choose a number of views (1 to 10) or one of the timers.').custom(ruleIsValid)
];

const gone = (res) => res.set('Cache-Control', 'no-store').status(404).json({ success: false, error: GONE });
const fail = (res, error) => {
    console.error('Drop error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
};

// CREATE a drop
router.post('/', fetchUser, createValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    try {
        const drops = await getDrops();
        const owner = new ObjectId(req.user.id), login = new ObjectId(req.body.login), now = new Date();
        // a link is made from one of the sender's own logins (the server sees only its opaque id), and ends with it
        const loginExists = async () => !!await (await connectToDb()).collection('passwords').findOne({ _id: login, user: owner }, { projection: { _id: 1 } });
        const notFound = () => res.status(400).json({ success: false, errors: [{ msg: 'That login was not found. Reload the page and try again.' }] });
        if (!await loginExists()) return notFound();
        if (await drops.countDocuments({ owner, ...live(now) }) >= MAX_LIVE_PER_USER) {
            return res.status(400).json({ success: false, errors: [{ msg: `You have ${MAX_LIVE_PER_USER} live drops. Revoke one to make another.` }] });
        }
        const { blob, label, mode } = req.body;
        const doc = {
            _id: crypto.randomBytes(16).toString('base64url'), owner, login, blob, label, mode, createdAt: now,
            ...(mode === 'views'
                ? { viewsLeft: req.body.views, expiresAt: new Date(now.getTime() + VIEWS_BACKSTOP_MS) }
                : { expiresAt: new Date(now.getTime() + req.body.ttl * 1000) })
        };
        await drops.insertOne(doc);
        await record((await getLog()).insertOne({
            _id: doc._id, owner, login, label, mode, createdAt: now, endsAt: doc.expiresAt, opens: 0, purgeAt: new Date(doc.expiresAt.getTime() + HISTORY_MS)
        }));
        // The login may have been deleted while this was being made: its delete ended the drops it could see, and not this one.
        // Looking again once the drop is stored closes that gap together with the second sweep the delete makes (routes/passwords.js):
        // either this sees the login gone and removes its own drop, or the login was still there and that sweep removes it.
        if (!await loginExists()) {
            await drops.deleteOne({ _id: doc._id });
            await (await getLog()).deleteOne({ _id: doc._id });
            return notFound();
        }
        return res.status(201).json({ id: doc._id, mode, viewsLeft: doc.viewsLeft, expiresAt: doc.expiresAt });
    } catch (error) {
        return fail(res, error);
    }
});

// LIST the sender's live drops (never the blob)
router.get('/', fetchUser, async (req, res) => {
    try {
        const drops = await getDrops();
        const records = await drops.find({ owner: new ObjectId(req.user.id), ...live(new Date()) }).sort({ createdAt: -1 }).toArray();
        return res.json(records.map((d) => ({ id: d._id, login: d.login, label: d.label, mode: d.mode, viewsLeft: d.viewsLeft, expiresAt: d.expiresAt, createdAt: d.createdAt })));
    } catch (error) {
        return fail(res, error);
    }
});

// LIST the sender's ended links (the history): a link that was used up, expired or revoked in the last 30 days. Still no blob.
router.get('/history', fetchUser, async (req, res) => {
    try {
        const log = await getLog();
        const ended = [{ endedAt: { $exists: true } }, { endsAt: { $lte: new Date() } }];
        const records = await log.find({ owner: new ObjectId(req.user.id), $or: ended }).sort({ createdAt: -1 }).limit(HISTORY_LIMIT).toArray();
        return res.json(records.map((d) => ({
            id: d._id, login: d.login, label: d.label, mode: d.mode, createdAt: d.createdAt, opens: d.opens,
            endedAt: d.endedAt ?? d.endsAt, reason: d.endedBy ?? 'expired'
        })));
    } catch (error) {
        return fail(res, error);
    }
});

// CLEAR the sender's history of ended links, all of them or one login's (?login=<record id>), if they want it gone sooner than the
// 30 days. Only ended links: the history of a link that is still live is kept, and it is only ever the caller's own.
router.delete('/history', fetchUser, async (req, res) => {
    const { login } = req.query;
    if (login !== undefined && !(typeof login === 'string' && login.length === 24 && ObjectId.isValid(login))) {
        return res.status(400).json({ success: false, errors: [{ msg: 'That login was not found. Reload the page and try again.' }] });
    }
    try {
        const ended = [{ endedAt: { $exists: true } }, { endsAt: { $lte: new Date() } }];
        const { deletedCount } = await (await getLog()).deleteMany({ owner: new ObjectId(req.user.id), $or: ended, ...(login && { login: new ObjectId(login) }) });
        return res.json({ success: true, deleted: deletedCount });
    } catch (error) {
        return fail(res, error);
    }
});

// LOOK: no sign-in and no key. What is left of a live drop, so the page can show it before anyone opens it. It only reads: it never
// takes a view, so a chat app previewing the link cannot use one up. A views drop answers with its views left; a timer drop with
// when it ends and when it began (a views drop's 7-day backstop is not shown). `now` is the server's clock, so the page
// counts down on the server's time and not on the visitor's. Every kind of "gone" answers the same as opening does.
router.get('/:id', async (req, res) => {
    if (!ID.test(req.params.id)) return gone(res);
    try {
        const now = new Date();
        const drop = await (await getDrops()).findOne({ _id: req.params.id, ...live(now) }, { projection: { mode: 1, viewsLeft: 1, expiresAt: 1, createdAt: 1 } });
        if (!drop) return gone(res);
        res.set('Cache-Control', 'no-store');
        return res.json(drop.mode === 'views'
            ? { mode: 'views', viewsLeft: drop.viewsLeft, now }
            : { mode: 'timer', expiresAt: drop.expiresAt, createdAt: drop.createdAt, now });
    } catch (error) {
        return fail(res, error);
    }
});

// REVOKE: only the sender can, and it deletes the drop at once
router.delete('/:id', fetchUser, async (req, res) => {
    if (!ID.test(req.params.id)) return gone(res);
    try {
        const drops = await getDrops();
        const { deletedCount } = await drops.deleteOne({ _id: req.params.id, owner: new ObjectId(req.user.id) });
        if (!deletedCount) return gone(res);
        await record((await getLog()).updateOne({ _id: req.params.id, endedAt: { $exists: false } }, { $set: endedNow('revoked', new Date()) }));
        return res.json({ success: true });
    } catch (error) {
        return fail(res, error);
    }
});

// OPEN: no sign-in. A POST, so a chat app previewing the link cannot use up a view. One atomic update takes a view, so two
// people cannot both get the last one; missing, expired, revoked and used up all answer the same.
router.post('/:id/open', async (req, res) => {
    if (!ID.test(req.params.id)) return gone(res);
    try {
        const drops = await getDrops();
        const now = new Date(), where = { _id: req.params.id, expiresAt: { $gt: now } };
        const taken = await drops.findOneAndUpdate({ ...where, mode: 'views', viewsLeft: { $gt: 0 } }, { $inc: { viewsLeft: -1 } }, { returnDocument: 'after' });
        let drop = taken?.value ?? taken;
        const lastView = drop && drop.viewsLeft === 0;
        if (lastView) await drops.deleteOne({ _id: drop._id }); // the last view: self-destruct
        if (!drop) drop = await drops.findOne({ ...where, mode: 'timer' });
        if (!drop) return gone(res);
        await record((await getLog()).updateOne({ _id: drop._id }, { $inc: { opens: 1 }, ...(lastView && { $set: endedNow('used', now) }) }));

        res.set('Cache-Control', 'no-store');
        // a views drop's end time is only its 7-day backstop, which is not shown: only a timer drop says when it ends
        return res.json({
            blob: drop.blob, mode: drop.mode, viewsLeft: drop.viewsLeft, now,
            ...(drop.mode === 'timer' && { expiresAt: drop.expiresAt, createdAt: drop.createdAt })
        });
    } catch (error) {
        return fail(res, error);
    }
});

module.exports = router;
