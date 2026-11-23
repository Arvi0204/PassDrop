// Ends drops together with the thing they belong to (a login, or the whole account): the live drops and their history,
// which is looked up the same way (`owner`, and `login` when it is one login's). Used by routes/passwords.js and routes/auth.js.
module.exports = async function removeDrops(db, filter) {
    await db.collection('drops').deleteMany(filter);
    await db.collection('droplog').deleteMany(filter);
};
