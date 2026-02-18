const express = require('express');
const router = express.Router();
const consumptionController = require('../controllers/consumptionController');

router.get('/', consumptionController.getHistory);

module.exports = router;