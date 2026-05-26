const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

// POST /api/payment/create-order
router.post('/create-order', authMiddleware, paymentController.createPayPalOrder);

// GET /api/payment/config (Pour le Frontend)
router.get('/config', authMiddleware, paymentController.getPayPalConfig);

// POST /api/payment/capture-order
router.post('/capture-order', authMiddleware, paymentController.capturePayPalOrder);

// POST /api/payment/create-stripe-session
router.post('/create-stripe-session', authMiddleware, paymentController.createStripeSession);

// POST /api/payment/verify-stripe-session
router.post('/verify-stripe-session', authMiddleware, paymentController.verifyStripeSession);

module.exports = router;