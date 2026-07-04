// routes/admin.js

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const marketplaceController = require('../controllers/marketplaceController');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');

router.use(authenticate, requireAdmin);

// User management
router.get('/users',                adminController.searchUsers);
router.post('/addcoins',            adminController.addCoins);       // ONLY way coins are added
router.post('/deductcoins',         adminController.deductCoins);
router.post('/freeze',              adminController.freezeWallet);
router.delete('/users/:userId',     adminController.deleteUser);

// Transactions & notices & stats
router.get('/transactions',         adminController.getAllTransactions);
router.post('/notices',             adminController.createNotice);
router.get('/notices',              adminController.getNotices);
router.get('/statistics',           adminController.getStatistics);

// Marketplace management
router.get('/marketplace',                              marketplaceController.adminListItems);
router.post('/marketplace',                             marketplaceController.adminCreateItem);
router.put('/marketplace/:itemId',                      marketplaceController.adminUpdateItem);
router.delete('/marketplace/:itemId',                   marketplaceController.adminDeleteItem);
router.post('/marketplace/:itemId/codes/generate',      marketplaceController.adminGenerateCodes);
router.post('/marketplace/:itemId/codes/custom',        marketplaceController.adminAddCustomCode);
router.get('/marketplace/:itemId/codes',                marketplaceController.adminListCodes);

module.exports = router;
