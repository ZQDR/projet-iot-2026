const express = require('express');
const router = express.Router();
const plugController = require('../controllers/plugController');
const authMiddleware = require('../middleware/authMiddleware');

// Route pour démarrer une charge (protégée)
// POST /api/plugs/start
router.post('/start', authMiddleware, plugController.scanAndStart);

// Route pour arrêter une charge (protégée)
// POST /api/plugs/stop
router.post('/stop', authMiddleware, plugController.stopCharge);

// Route pour générer le QR code d'une prise (publique/administrative)
// GET /api/plugs/S1-01/qrcode
router.get('/:plugId/qrcode', plugController.generateQrCode);

module.exports = router;