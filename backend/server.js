const dotenv = require('dotenv');
dotenv.config();

// The server holds no key that can read a vault: logins are encrypted in the browser. The only secret left is the one
// that signs sign-in tokens.
// With no secret every sign-in fails with a 500 and sign-up half-saves an account, so stop here. A short one only warns:
// the value in production cannot be checked from here, and refusing it could take the live site down.
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set; add a long random value to the environment');
if (process.env.JWT_SECRET.length < 32) {
    console.warn('JWT_SECRET is shorter than 32 characters; use a long random value');
}
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
// In production the web app and API share one origin, so CORS is only needed for local dev
// (frontend on :5173, API on :3000).
if (process.env.NODE_ENV !== 'production') app.use(require('cors')());
app.disable('x-powered-by');
app.use(express.json());

// Available routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/passwords', require('./routes/passwords'));
app.use('/api/drops', require('./routes/drops'));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PassDrop API is running' });
});

// Keep stack traces out of responses (a malformed JSON body ends up here too)
app.use((err, req, res, next) => {
    if (err.type !== 'entity.parse.failed' && err.type !== 'entity.too.large') console.error('Unhandled error:', err.message);
    const status = err.status >= 400 && err.status < 500 ? err.status : 500;
    res.status(status).json({ success: false, error: status === 500 ? 'Internal Server Error' : 'Bad request' });
});

// Start a local server while preserving the exported app for Vercel.
if (require.main === module) {
  // Some local networks cannot resolve the mongodb+srv record; production uses the platform resolver.
  require('dns').setServers(['8.8.8.8', '1.1.1.1']);
  app.listen(port, () => {
    console.log(`PassDrop backend listening on port http://localhost:${port}`);
  });
}

module.exports = app;