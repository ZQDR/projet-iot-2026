const express = require('express');
const router = express.Router();
const plugController = require('../controllers/plugController');

router.get('/', plugController.getAllPlugs);
router.post('/scan', plugController.scanPlug);
router.post('/stop', plugController.stopCharging);

module.exports = router;