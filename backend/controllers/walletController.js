// controllers/walletController.js
// CHANGE: /wallet/add (self-service coin top-up) is REMOVED.
// Coins can now ONLY be added by an admin via /api/admin/addcoins.
// Users can only spend/deduct coins and view their balance & history.

const { pool } = require('../config/db');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

function isValidAmount(amount) {
  return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && Number.isInteger(amount);
}

exports.getWallet = async (req, res) => {
  try {
    const coins = await User.getCoins(req.user.id);
    if (coins === null) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.json({ success: true, coins });
  } catch (err) {
    console.error('[getWallet] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching wallet.' });
  }
};

// NOTE: addCoins endpoint intentionally REMOVED.
// Only admin can credit coins — see adminController.addCoins.

exports.deductCoins = async (req, res) => {
  const { amount, reason } = req.body || {};

  if (!isValidAmount(amount)) {
    return res.status(400).json({ success: false, message: 'Amount must be a positive whole number.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const frozen = await User.isFrozen(req.user.id);
    if (frozen) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Wallet is frozen.' });
    }

    const newBalance = await User.deductCoins(connection, req.user.id, amount);

    if (newBalance === null) {
      await Transaction.create(connection, {
        userId: req.user.id,
        type: 'debit',
        amount,
        balanceAfter: await User.getCoins(req.user.id),
        reason: reason || 'Coins deducted',
        status: 'failed',
      });
      await connection.commit();
      return res.status(400).json({ success: false, message: 'Not enough coins.' });
    }

    await Transaction.create(connection, {
      userId: req.user.id,
      type: 'debit',
      amount,
      balanceAfter: newBalance,
      reason: reason || 'Coins deducted',
    });

    await connection.commit();
    return res.json({ success: true, message: 'Coins deducted.', balance: newBalance });
  } catch (err) {
    await connection.rollback();
    console.error('[deductCoins] error:', err);
    return res.status(500).json({ success: false, message: 'Server error deducting coins.' });
  } finally {
    connection.release();
  }
};

exports.getHistory = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page,  10) || 1,   1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.findByUser(req.user.id, { limit, offset }),
      Transaction.countByUser(req.user.id),
    ]);

    return res.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('[getHistory] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching history.' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [received, spent, coins, txCount] = await Promise.all([
      Transaction.sumByUserAndType(req.user.id, 'credit'),
      Transaction.sumByUserAndType(req.user.id, 'debit'),
      User.getCoins(req.user.id),
      Transaction.countByUser(req.user.id),
    ]);
    return res.json({
      success: true,
      stats: {
        totalReceived: received,
        totalSpent: spent,
        currentBalance: coins,
        transactionCount: txCount,
      },
    });
  } catch (err) {
    console.error('[getStats] error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching stats.' });
  }
};
