const express = require('express');
const router = express.Router();
const consumptionController = require('../controllers/consumptionController');
const authMiddleware = require('../middleware/authMiddleware');

// Route pour récupérer l'historique de l'utilisateur connecté
// GET /api/consumption
router.get('/', authMiddleware, consumptionController.getHistory);

module.exports = router;