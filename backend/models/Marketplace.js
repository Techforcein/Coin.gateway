// models/Marketplace.js
// Data-access layer for marketplace_items, digital_codes, and purchases.
// Digital codes are always 12 chars with last 3 = "1AS".

const { pool } = require('../config/db');

// ─── Code generation ────────────────────────────────────────────────────────
const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SUFFIX   = '1AS';   // last 3 chars are always exactly "1AS"
const PREFIX_LEN = 9;     // 9 + 3 = 12 total

function generateCode() {
  let prefix = '';
  for (let i = 0; i < PREFIX_LEN; i++) {
    prefix += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return prefix + SUFFIX;
}

// ─── Marketplace Items ───────────────────────────────────────────────────────
const Marketplace = {

  // ---------- Items ----------

  async createItem({ name, description, price, stock = -1, createdBy }) {
    const [result] = await pool.execute(
      `INSERT INTO marketplace_items (name, description, price, stock, is_active, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [name, description || '', price, stock, createdBy]
    );
    return result.insertId;
  },

  async updateItem(itemId, { name, description, price, stock, is_active }) {
    await pool.execute(
      `UPDATE marketplace_items
       SET name=?, description=?, price=?, stock=?, is_active=?
       WHERE id=?`,
      [name, description || '', price, stock, is_active ? 1 : 0, itemId]
    );
  },

  async deleteItem(itemId) {
    await pool.execute(`DELETE FROM marketplace_items WHERE id=?`, [itemId]);
  },

  async findAllItems({ activeOnly = false } = {}) {
    const where = activeOnly ? `WHERE is_active = 1` : '';
    const [rows] = await pool.execute(
      `SELECT m.*, u.username AS created_by_name,
              (SELECT COUNT(*) FROM digital_codes d WHERE d.item_id = m.id AND d.is_used = 0) AS available_codes
       FROM marketplace_items m
       LEFT JOIN users u ON u.id = m.created_by
       ${where}
       ORDER BY m.created_at DESC`
    );
    return rows;
  },

  async findItemById(itemId) {
    const [rows] = await pool.execute(
      `SELECT m.*,
              (SELECT COUNT(*) FROM digital_codes d WHERE d.item_id = m.id AND d.is_used = 0) AS available_codes
       FROM marketplace_items m WHERE m.id = ?`,
      [itemId]
    );
    return rows[0] || null;
  },

  // ---------- Digital Codes ----------

  /**
   * Add N generated codes to an item.
   * Generates codes with the required format: 9 random alphanum + "1AS"
   * Skips on duplicate (retries up to 5× per slot).
   */
  async addCodes(itemId, count = 1) {
    const added = [];
    for (let i = 0; i < count; i++) {
      let inserted = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        try {
          const [res] = await pool.execute(
            `INSERT INTO digital_codes (item_id, code) VALUES (?, ?)`,
            [itemId, code]
          );
          if (res.affectedRows > 0) {
            added.push(code);
            inserted = true;
            break;
          }
        } catch (e) {
          if (e.code !== 'ER_DUP_ENTRY') throw e;
          // duplicate — retry with a new code
        }
      }
      if (!inserted) throw new Error('Failed to generate a unique code after 5 attempts.');
    }
    return added;
  },

  /**
   * Add a specific custom code (admin-supplied). Validates format.
   * Must be exactly 12 alphanum chars ending in "1AS".
   */
  async addCustomCode(itemId, code) {
    if (!/^[A-Z0-9]{9}1AS$/.test(code)) {
      throw new Error('Code must be exactly 12 uppercase alphanumeric characters ending in "1AS".');
    }
    await pool.execute(
      `INSERT INTO digital_codes (item_id, code) VALUES (?, ?)`,
      [itemId, code]
    );
  },

  async listCodes(itemId) {
    const [rows] = await pool.execute(
      `SELECT d.id, d.code, d.is_used, d.used_at, u.username AS used_by_name
       FROM digital_codes d
       LEFT JOIN users u ON u.id = d.used_by
       WHERE d.item_id = ?
       ORDER BY d.created_at DESC`,
      [itemId]
    );
    return rows;
  },

  async countAvailableCodes(itemId) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM digital_codes WHERE item_id = ? AND is_used = 0`,
      [itemId]
    );
    return Number(rows[0].cnt);
  },

  // ---------- Purchase (atomic) ----------

  /**
   * Atomically:
   *   1. Check wallet balance >= item price
   *   2. Deduct coins from wallet
   *   3. Mark one available code as used
   *   4. Insert transaction log row
   *   5. Insert purchase row
   * Returns { newBalance, code, purchaseId }
   */
  async purchaseItem(connOrPool, { userId, item, transactionModel, userModel }) {
    // 1. Check & deduct balance
    const newBalance = await userModel.deductCoins(connOrPool, userId, item.price);
    if (newBalance === null) {
      return { success: false, reason: 'insufficient_balance' };
    }

    // 2. Claim one unused code (SELECT ... FOR UPDATE prevents race conditions)
    const [codes] = await connOrPool.execute(
      `SELECT id, code FROM digital_codes
       WHERE item_id = ? AND is_used = 0
       LIMIT 1 FOR UPDATE`,
      [item.id]
    );
    if (!codes.length) {
      return { success: false, reason: 'out_of_stock' };
    }
    const { id: codeId, code } = codes[0];

    // 3. Mark code as used
    await connOrPool.execute(
      `UPDATE digital_codes SET is_used=1, used_by=?, used_at=NOW() WHERE id=?`,
      [userId, codeId]
    );

    // 4. Log transaction
    await transactionModel.create(connOrPool, {
      userId,
      type: 'debit',
      amount: item.price,
      balanceAfter: newBalance,
      reason: `Marketplace: ${item.name}`,
    });

    // 5. Record purchase
    const [pRes] = await connOrPool.execute(
      `INSERT INTO purchases (user_id, item_id, code_id, coins_spent) VALUES (?, ?, ?, ?)`,
      [userId, item.id, codeId, item.price]
    );

    // 6. Update purchase_id on code
    await connOrPool.execute(
      `UPDATE digital_codes SET purchase_id=? WHERE id=?`,
      [pRes.insertId, codeId]
    );

    return { success: true, newBalance, code, purchaseId: pRes.insertId };
  },

  // ---------- User purchase history ----------

  async getUserPurchases(userId) {
    const [rows] = await pool.execute(
      `SELECT p.id, p.coins_spent, p.created_at,
              m.name AS item_name, m.description AS item_description,
              d.code
       FROM purchases p
       JOIN marketplace_items m ON m.id = p.item_id
       JOIN digital_codes d     ON d.id  = p.code_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC`,
      [userId]
    );
    return rows;
  },
};

module.exports = Marketplace;
