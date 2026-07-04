// models/Transaction.js
// FIX: mysql2 prepared statements require explicit integers for LIMIT/OFFSET.
// Passing JS Number via pool.execute() works for data params but mysql2 can
// silently treat non-integer-typed values incorrectly in some driver versions.
// We now cast limit/offset with Math.floor() and ensure they are integers.

const { pool } = require('../config/db');

const Transaction = {
  async create(
    connOrPool,
    { userId, type, amount, balanceAfter, reason, status = 'success', createdBy = null }
  ) {
    const [result] = await connOrPool.execute(
      `INSERT INTO transactions
        (user_id, type, amount, balance_after, reason, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, type, amount, balanceAfter, reason, status, createdBy]
    );
    return result.insertId;
  },

async findByUser(userId, { limit = 20, offset = 0 } = {}) {
  limit = Number(limit);
  offset = Number(offset);
  userId = Number(userId);

  const [rows] = await pool.query(
    `SELECT id, type, amount, balance_after, reason, status, created_at
     FROM transactions
     WHERE user_id = ${userId}
     ORDER BY created_at DESC
     LIMIT ${limit} OFFSET ${offset}`
  );

  return rows;
},
  async countByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS count FROM transactions WHERE user_id = ?`,
      [userId]
    );
    return Number(rows[0].count);
  },

  async sumByUserAndType(userId, type) {
    const [rows] = await pool.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE user_id = ? AND type = ? AND status = 'success'`,
      [userId, type]
    );
    return Number(rows[0].total);
  },

async findAll({ limit = 50, offset = 0 } = {}) {
  limit = Number(limit);
  offset = Number(offset);

  const [rows] = await pool.query(
    `SELECT t.id,
            t.user_id,
            u.username,
            t.type,
            t.amount,
            t.balance_after,
            t.reason,
            t.status,
            t.created_at
     FROM transactions t
     JOIN users u ON u.id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`
  );

  return rows;
},
  async countAll() {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS count FROM transactions`
    );
    return Number(rows[0].count);
  },
};

module.exports = Transaction;
