const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: "Route Consommation fonctionnelle !" });
});

module.exports = router;