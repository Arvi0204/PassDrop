const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const port =  process.env.PORT || 3000;

// MongoDB Connection
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not configured in the environment");
}
const client = new MongoClient(uri);

// MongoDB Client
let db;

// Function to connect to the database (reused across requests)
const connectToDb = async () => {
  if (db) {
      // Reuse existing database connection
      return db;
  }
  try {
      await client.connect();
      db = client.db("PassHaven");
      console.log("Connected to MongoDB");
      return db;
  } catch (err) {
      console.error("Database connection error:", err);
      throw err;
  }
};

// Export the function so it can be used in other modules
module.exports = connectToDb;

// Middleware
app.use(cors());
app.use(express.json());

// Available routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/passwords', require('./routes/passwords'));

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello from PassHaven!');
});

// Start a local server while preserving the exported app for Vercel.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`PassHaven backend listening on port http://localhost:${port}`);
  });
}

module.exports = app