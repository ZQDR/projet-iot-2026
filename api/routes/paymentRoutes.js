// Fichier: api/routes/payments.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware'); // Sécurité obligatoire

// Route: POST /api/payments/topup
// Il faut être connecté (authMiddleware) pour recharger SON compte
router.post('/topup', authMiddleware, paymentController.topUp);

module.exports = router;