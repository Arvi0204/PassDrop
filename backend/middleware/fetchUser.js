const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
require('dotenv').config()
const connectToDb = require('../db');
const JWT_SECRET = process.env.JWT_SECRET

const fetchUser = async (req, res, next) => {
    // Get user from the JWT token and append and add id to req object
    const token  = req.header('auth-token');
    if(!token)
        return res.status(401).send({success: false, error: "Please authenticate using a valid token"})

    let data;
    try {
        data = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })
        new ObjectId(data.user.id); // a token without a usable id is no token
    } catch (error) {
        return res.status(401).send({success: false, error: "Please authenticate using a valid token"})
    }

    try {
        // A token dies when its account is deleted or its password changes (tokenVersion moves on)
        const db = await connectToDb();
        const user = await db.collection('users').findOne(
            { _id: new ObjectId(data.user.id) },
            { projection: { tokenVersion: 1 } }
        );
        if (!user || (user.tokenVersion || 0) !== (data.v || 0))
            return res.status(401).send({success: false, error: "Please authenticate using a valid token"})

        req.user = data.user;
        next();
    } catch (error) {
        // A database failure is not a bad token: 401 would sign the user out
        console.error('Token check error:', error.message);
        res.status(500).send({success: false, error: 'Internal Server Error'})
    }
}

module.exports = fetchUser;
