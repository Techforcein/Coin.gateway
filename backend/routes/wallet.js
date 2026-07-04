// routes/wallet.js
// CHANGE: /wallet/add (user self-service top-up) is REMOVED.
// Coins can only be added by an admin via /api/admin/addcoins.

const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authenticate = require('../middleware/auth');

router.use(authenticate);

router.get('/wallet',          walletController.getWallet);
router.post('/wallet/deduct',  walletController.deductCoins);
router.get('/history',         walletController.getHistory);
router.get('/stats',           walletController.getStats);

// Marketplace (user-facing)
const marketplaceController = require('../controllers/marketplaceController');
router.get('/marketplace',              marketplaceController.listItems);
router.post('/marketplace/buy',         marketplaceController.buyItem);
router.get('/marketplace/my-purchases', marketplaceController.myPurchases);

module.exports = router;
