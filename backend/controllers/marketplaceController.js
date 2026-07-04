// controllers/marketplaceController.js
// User-facing marketplace: browse items, purchase with coins, view own purchases.
// Admin-facing management: create/edit/delete items, add digital codes.

const { pool } = require('../config/db');
const Marketplace = require('../models/Marketplace');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// ─── Public / User routes ────────────────────────────────────────────────────

/** GET /api/marketplace — list all active items */
exports.listItems = async (req, res) => {
  try {
    const items = await Marketplace.findAllItems({ activeOnly: true });
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[marketplace.listItems]', err);
    return res.status(500).json({ success: false, message: 'Failed to load marketplace.' });
  }
};

/** POST /api/marketplace/buy — user buys an item, gets a digital code */
exports.buyItem = async (req, res) => {
  const { itemId } = req.body || {};
  if (!itemId) {
    return res.status(400).json({ success: false, message: 'itemId is required.' });
  }

  const item = await Marketplace.findItemById(itemId);
  if (!item || !item.is_active) {
    return res.status(404).json({ success: false, message: 'Item not found or unavailable.' });
  }

  if (Number(item.available_codes) === 0) {
    return res.status(400).json({ success: false, message: 'This item is out of stock.' });
  }

  const frozen = await User.isFrozen(req.user.id);
  if (frozen) {
    return res.status(403).json({ success: false, message: 'Your wallet is frozen.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const result = await Marketplace.purchaseItem(connection, {
      userId: req.user.id,
      item,
      transactionModel: Transaction,
      userModel: User,
    });

    if (!result.success) {
      await connection.rollback();
      if (result.reason === 'insufficient_balance') {
        return res.status(400).json({ success: false, message: 'Not enough coins to purchase this item.' });
      }
      return res.status(400).json({ success: false, message: 'Item is out of stock.' });
    }

    await connection.commit();
    return res.json({
      success: true,
      message: 'Purchase successful!',
      code: result.code,
      balance: result.newBalance,
      purchaseId: result.purchaseId,
    });
  } catch (err) {
    await connection.rollback();
    console.error('[marketplace.buyItem]', err);
    return res.status(500).json({ success: false, message: 'Purchase failed. Please try again.' });
  } finally {
    connection.release();
  }
};

/** GET /api/marketplace/my-purchases — user's purchase history with codes */
exports.myPurchases = async (req, res) => {
  try {
    const purchases = await Marketplace.getUserPurchases(req.user.id);
    return res.json({ success: true, purchases });
  } catch (err) {
    console.error('[marketplace.myPurchases]', err);
    return res.status(500).json({ success: false, message: 'Failed to load purchases.' });
  }
};

// ─── Admin routes ────────────────────────────────────────────────────────────

/** GET /api/admin/marketplace — all items (incl inactive) */
exports.adminListItems = async (req, res) => {
  try {
    const items = await Marketplace.findAllItems({ activeOnly: false });
    return res.json({ success: true, items });
  } catch (err) {
    console.error('[marketplace.adminListItems]', err);
    return res.status(500).json({ success: false, message: 'Failed to load items.' });
  }
};

/** POST /api/admin/marketplace — create a new item */
exports.adminCreateItem = async (req, res) => {
  const { name, description, price, stock } = req.body || {};
  if (!name || !price || isNaN(Number(price)) || Number(price) <= 0) {
    return res.status(400).json({ success: false, message: 'name and a positive price (in coins) are required.' });
  }
  try {
    const itemId = await Marketplace.createItem({
      name: name.trim(),
      description: (description || '').trim(),
      price: Math.floor(Number(price)),
      stock: stock !== undefined ? Math.floor(Number(stock)) : -1,
      createdBy: req.user.id,
    });
    return res.status(201).json({ success: true, message: 'Item created.', itemId });
  } catch (err) {
    console.error('[marketplace.adminCreateItem]', err);
    return res.status(500).json({ success: false, message: 'Failed to create item.' });
  }
};

/** PUT /api/admin/marketplace/:itemId — update an item */
exports.adminUpdateItem = async (req, res) => {
  const { itemId } = req.params;
  const { name, description, price, stock, is_active } = req.body || {};
  try {
    const item = await Marketplace.findItemById(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    await Marketplace.updateItem(itemId, {
      name: (name || item.name).trim(),
      description: description !== undefined ? description.trim() : item.description,
      price: price !== undefined ? Math.floor(Number(price)) : item.price,
      stock: stock !== undefined ? Math.floor(Number(stock)) : item.stock,
      is_active: is_active !== undefined ? Boolean(is_active) : !!item.is_active,
    });
    return res.json({ success: true, message: 'Item updated.' });
  } catch (err) {
    console.error('[marketplace.adminUpdateItem]', err);
    return res.status(500).json({ success: false, message: 'Failed to update item.' });
  }
};

/** DELETE /api/admin/marketplace/:itemId — delete an item */
exports.adminDeleteItem = async (req, res) => {
  try {
    const item = await Marketplace.findItemById(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    await Marketplace.deleteItem(req.params.itemId);
    return res.json({ success: true, message: 'Item deleted.' });
  } catch (err) {
    console.error('[marketplace.adminDeleteItem]', err);
    return res.status(500).json({ success: false, message: 'Failed to delete item.' });
  }
};

/**
 * POST /api/admin/marketplace/:itemId/codes/generate
 * Body: { count: 5 }  — auto-generate N codes (format: 9 random + "1AS")
 */
exports.adminGenerateCodes = async (req, res) => {
  const { itemId } = req.params;
  const count = Math.min(Math.max(parseInt(req.body.count, 10) || 1, 1), 200);
  try {
    const item = await Marketplace.findItemById(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    const codes = await Marketplace.addCodes(itemId, count);
    return res.json({ success: true, message: `${codes.length} code(s) generated.`, codes });
  } catch (err) {
    console.error('[marketplace.adminGenerateCodes]', err);
    return res.status(500).json({ success: false, message: 'Failed to generate codes.' });
  }
};

/**
 * POST /api/admin/marketplace/:itemId/codes/custom
 * Body: { code: "ABCDE12341AS" }  — add a specific admin-supplied code
 */
exports.adminAddCustomCode = async (req, res) => {
  const { itemId } = req.params;
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ success: false, message: 'code is required.' });
  try {
    const item = await Marketplace.findItemById(itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    await Marketplace.addCustomCode(itemId, code.trim().toUpperCase());
    return res.json({ success: true, message: 'Custom code added.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'That code already exists.' });
    }
    console.error('[marketplace.adminAddCustomCode]', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to add code.' });
  }
};

/** GET /api/admin/marketplace/:itemId/codes — list all codes for an item */
exports.adminListCodes = async (req, res) => {
  try {
    const item = await Marketplace.findItemById(req.params.itemId);
    if (!item) return res.status(404).json({ success: false, message: 'Item not found.' });
    const codes = await Marketplace.listCodes(req.params.itemId);
    return res.json({ success: true, codes });
  } catch (err) {
    console.error('[marketplace.adminListCodes]', err);
    return res.status(500).json({ success: false, message: 'Failed to load codes.' });
  }
};
