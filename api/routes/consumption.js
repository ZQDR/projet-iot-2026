const express = require('express');
const router = express.Router();
const consumptionController = require('../controllers/consumptionController');
const authMiddleware = require('../middleware/authMiddleware');

// Route pour récupérer l'historique de l'utilisateur connecté
// GET /api/consumption/me
router.get('/me', authMiddleware, consumptionController.getMyHistory);

// Route pour récupérer l'historique financier (recharges + paiements)
// GET /api/consumption/transactions
router.get('/transactions', authMiddleware, consumptionController.getTransactions);

module.exports = router;