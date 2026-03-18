const express = require('express');
const router = express.Router();
const plugController = require('../controllers/plugController');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Route pour démarrer une charge (protégée)
// POST /api/plugs/start
router.post('/start', authMiddleware, plugController.scanAndStart);

// Route pour arrêter une charge (protégée)
// POST /api/plugs/stop
router.post('/stop', authMiddleware, plugController.stopCharge);

// Route pour récupérer toutes les prises (Publique pour les utilisateurs connectés)
// GET /api/plugs
router.get('/', authMiddleware, plugController.getAllPlugs);

// Route pour ajouter une nouvelle prise (Admin)
// POST /api/plugs
router.post('/', authMiddleware, adminMiddleware, plugController.createPlug);

// Route de Maintenance (Alertes réseau)
// GET /api/plugs/alerts
router.get('/alerts', authMiddleware, adminMiddleware, plugController.getMaintenanceAlerts);

// Route pour supprimer une prise (Admin)
// DELETE /api/plugs/:plugId
router.delete('/:plugId', authMiddleware, adminMiddleware, plugController.deletePlug);

// Route pour basculer le mode maintenance d'une prise (Admin)
// POST /api/plugs/:plugId/maintenance
router.post('/:plugId/maintenance', authMiddleware, adminMiddleware, plugController.toggleMaintenance);

// Route pour forcer l'arrêt d'une prise occupée (Admin)
// POST /api/plugs/:plugId/force-stop
router.post('/:plugId/force-stop', authMiddleware, adminMiddleware, plugController.forceStopCharge);

// Route pour générer le QR code d'une prise (publique/administrative)
// GET /api/plugs/S1-01/qrcode
router.get('/:plugId/qrcode', plugController.generateQrCode);

module.exports = router;