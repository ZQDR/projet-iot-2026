// Fichier: api/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware'); // Sécurité obligatoire

// Route: POST /api/payments/create-order
// 1. Créer la commande (L'utilisateur veut payer X euros)
router.post('/create-order', authMiddleware, paymentController.createPayPalOrder);

// 2. Valider la commande (L'utilisateur a payé, on crédite son compte)
router.post('/capture-order', authMiddleware, paymentController.capturePayPalOrder);

module.exports = router;