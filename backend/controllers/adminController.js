// controllers/adminController.js

const { pool } = require('../config/db');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Notice = require('../models/Notice');

function isValidAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && Number.isInteger(amount);
}

exports.searchUsers = async (req, res) => {
  try {
    const query = (req.query.q || '').trim();
    if (!query) {
      const users = await User.listAll({ limit: 50, offset: 0 });
      return res.json({ success: true, users });
    }
    const users = await User.search(query, 50);
    return res.json({ success: true, users });
  } catch (err) {
    console.error('[searchUsers] error:', err);
    return res.status(500).json({ success: false, message: 'Server error searching users.' });
  }
};

exports.addCoins = async (req, res) => {
  const { userId, amount, reason } = req.body || {};

  if (!userId || !isValidAmount(amount)) {
    return res.status(400).json({
      success: false,
      message: 'userId and a positive whole-number amount are required.',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const target = await User.findById(userId);
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    const newBalance = await User.addCoins(connection, userId, amount);
    await Transaction.create(connection, {
      userId,
      type: 'credit',
      amount,
      balanceAfter: newBalance,
      reason: reason || 'Admin coin grant',
      createdBy: req.user.id,
    });

    await connection.commit();
    return res.json({ success: true, message: 'Coins added.', balance: newBalance });
  } catch (err) {
    await connection.rollback();
    console.error('[admin.addCoins] error:', err);
    return res.status(500).json({ success: false, message: 'Server error adding coins.' });
  } finally {
    connection.release();
  }
};

exports.deductCoins = async (req, res) => {
  const { userId, amount, reason } = req.body || {};

  if (!userId || !isValidAmount(amount)) {
    return res.status(400).json({
      success: false,
      message: 'userId and a positive whole-number amount are required.',
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const target = await User.findById(userId);
    if (!target) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Target user not found.' });
    }

    const newBalance = await User.deductCoins(connection, userId, amount);
    if (newBalance === null) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'User does not have enough coins to deduct.' });
    }

    await Transaction.create(connection, {
      userId,
      type: 'debit',
      amount,
      balanceAfter: newBalance,
      reason: reason || 'Admin coin deduction',
      createdBy: req.user.id,
    });

    await connection.commit();
    return res.json({ success: true, message: 'Coins deducted.', balance: newBalance });
  } catch (err) {
    await connection.rollback();
    console.error('[admin.deductCoins] error:', err);
    return res.status(500).json({ success: false, message: 'Server error deducting coins.' });
  } finally {
    connection.release();
  }
};

exports.freezeWallet = async (req, res) => {
  try {
    const { userId, frozen } = req.body || {};
    if (!userId || typeof frozen !== 'boolean') {
      return res.status(400).json({ success: false, message: 'userId and boolean frozen are required.' });
    }
    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    await User.setFrozen(userId, frozen);
    return res.json({ success: true, message: frozen ? 'Wallet frozen.' : 'Wallet unfrozen.' });
  } catch (err) {
    console.error('[freezeWallet] error:', err);
    return res.status(500).json({ success: false, message: 'Server error updating freeze status.' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const target = await User.findById(userId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (target.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete an admin account via this endpoint.' });
    }
    await User.deleteById(userId);
    return res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('[deleteUser] error:', err);
    return res.status(500).json({ success: false, message: 'Server error deleting user.' });
  }
};

exports.getAllTransactions = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.findAll({ limit, offset }),
      Transaction.countAll(),
    ]);

    return res.json({
      success: true,
      transactions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[admin.getAllTransactions] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching transactions.' });
  }
};

exports.createNotice = async (req, res) => {
  try {
    const { title, message } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message are required.' });
    }
    const id = await Notice.create({ title, message, createdBy: req.user.id });
    return res.status(201).json({ success: true, message: 'Notice created.', noticeId: id });
  } catch (err) {
    console.error('[createNotice] error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating notice.' });
  }
};

exports.getNotices = async (req, res) => {
  try {
    const notices = await Notice.findAll({ limit: 20, offset: 0 });
    return res.json({ success: true, notices });
  } catch (err) {
    console.error('[getNotices] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching notices.' });
  }
};

exports.getStatistics = async (req, res) => {
  try {
    const [userCount, totalCoins, txCount] = await Promise.all([
      User.countAll(),
      User.sumAllCoins(),
      Transaction.countAll(),
    ]);
    return res.json({
      success: true,
      statistics: {
        totalUsers: userCount,
        totalCoinsInCirculation: totalCoins,
        totalTransactions: txCount,
      },
    });
  } catch (err) {
    console.error('[getStatistics] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching statistics.' });
  }
};
