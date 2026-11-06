const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
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
  app.listen(port, () => {
    console.log(`PassDrop backend listening on port http://localhost:${port}`);
  });
}

module.exports = app;