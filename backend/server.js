const dotenv = require('dotenv');
dotenv.config();
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

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'PassDrop API is running' });
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