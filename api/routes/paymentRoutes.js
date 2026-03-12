const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/payment/create-order
router.post('/create-order', authMiddleware, paymentController.createPayPalOrder);

// POST /api/payment/capture-order
router.post('/capture-order', authMiddleware, paymentController.capturePayPalOrder);

module.exports = router;