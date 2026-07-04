// models/Notice.js
// Data-access layer for admin-created notices/announcements.

const { pool } = require('../config/db');

const Notice = {
  async create({ title, message, createdBy }) {
    const [result] = await pool.execute(
      `INSERT INTO notices (title, message, created_by)
       VALUES (?, ?, ?)`,
      [title, message, createdBy]
    );

    return result.insertId;
  },

  async findAll({ limit = 20, offset = 0 } = {}) {
    limit = Number(limit);
    offset = Number(offset);

    const [rows] = await pool.query(
      `SELECT id,
              title,
              message,
              created_by,
              created_at
       FROM notices
       ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${offset}`
    );

    return rows;
  },

  async deleteById(id) {
    await pool.execute(
      `DELETE FROM notices WHERE id = ?`,
      [id]
    );
  },
};

module.exports = Notice;