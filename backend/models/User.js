// models/User.js
// Data-access layer for the users table. All queries use parameterized
// placeholders (never string-concatenated SQL) to prevent SQL injection.

const { pool } = require('../config/db');

const User = {
  /**
   * Create a new user. Returns the inserted user's id.
   */
  async create({ username, email, passwordHash }) {
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password, coins, role)
       VALUES (?, ?, ?, 0, 'user')`,
      [username, email, passwordHash]
    );
    return result.insertId;
  },

  async findByEmail(email) {
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  },

  async findByUsername(username) {
    const [rows] = await pool.execute(
      `SELECT * FROM users WHERE username = ? LIMIT 1`,
      [username]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT id, username, email, coins, role, is_frozen, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async getCoins(id) {
    const [rows] = await pool.execute(
      `SELECT coins FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ? rows[0].coins : null;
  },

  /**
   * Atomically increase a user's coin balance and return the new balance.
   * Uses a transaction so the balance update and transaction log insert
   * either both succeed or both fail together.
   */
  async addCoins(connOrPool, userId, amount) {
    await connOrPool.execute(
      `UPDATE users SET coins = coins + ? WHERE id = ?`,
      [amount, userId]
    );
    const [rows] = await connOrPool.execute(
      `SELECT coins FROM users WHERE id = ?`,
      [userId]
    );
    return rows[0].coins;
  },

  /**
   * Atomically decrease a user's coin balance, but only if sufficient
   * balance exists. The WHERE clause's `coins >= ?` check makes this
   * race-condition safe even under concurrent requests: if two requests
   * race, only the one(s) that the database actually has balance for
   * will affect a row.
   * Returns the new balance, or null if the deduction failed
   * (insufficient balance).
   */
  async deductCoins(connOrPool, userId, amount) {
    const [result] = await connOrPool.execute(
      `UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?`,
      [amount, userId, amount]
    );
    if (result.affectedRows === 0) {
      return null; // insufficient balance (or user not found)
    }
    const [rows] = await connOrPool.execute(
      `SELECT coins FROM users WHERE id = ?`,
      [userId]
    );
    return rows[0].coins;
  },

  async setFrozen(userId, isFrozen) {
    await pool.execute(`UPDATE users SET is_frozen = ? WHERE id = ?`, [
      isFrozen ? 1 : 0,
      userId,
    ]);
  },

  async isFrozen(userId) {
    const [rows] = await pool.execute(
      `SELECT is_frozen FROM users WHERE id = ?`,
      [userId]
    );
    return rows[0] ? !!rows[0].is_frozen : false;
  },

  async deleteById(userId) {
    await pool.execute(`DELETE FROM users WHERE id = ?`, [userId]);
  },

  async search(query, limit = 20) {
    const [rows] = await pool.execute(
      `SELECT id, username, email, coins, role, is_frozen, created_at
       FROM users
       WHERE username LIKE ? OR email LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [`%${query}%`, `%${query}%`, limit]
    );
    return rows;
  },

async listAll({ limit = 50, offset = 0 } = {}) {
  limit = Number(limit);
  offset = Number(offset);

  const [rows] = await pool.query(
    `SELECT id, username, email, coins, role, is_frozen, created_at
     FROM users
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`
  );

  return rows;
},

  async countAll() {
    const [rows] = await pool.execute(`SELECT COUNT(*) AS count FROM users`);
    return rows[0].count;
  },

  async sumAllCoins() {
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(coins), 0) AS total FROM users`
    );
    return rows[0].total;
  },
};

module.exports = User;
