// config/db.js
// Creates and exports a MySQL connection pool using mysql2/promise.
// Using a pool (rather than a single connection) lets Express handle
// many concurrent requests safely.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'wallet_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

// Quick startup check so connection problems fail loudly instead of
// surfacing as confusing errors on the first API request.
async function verifyConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('[db] MySQL connection pool established successfully.');
  } catch (err) {
    console.error('[db] Failed to connect to MySQL:', err.message);
    console.error(
      '[db] Check your .env DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME values.'
    );
    process.exit(1);
  }
}

module.exports = { pool, verifyConnection };
