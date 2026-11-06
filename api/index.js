// Vercel runs this file as the serverless function for every /api/* request (see vercel.json).
// The Express app is the same one `npm run dev:backend` starts locally.
module.exports = require('../backend/server');
