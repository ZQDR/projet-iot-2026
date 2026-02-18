const express = require('express');
const router = express.Router();

// Route test pour éviter que le fichier soit vide
router.get('/', (req, res) => {
    res.json({ message: "Route Prises (Plugs) fonctionnelle !" });
});

module.exports = router; // <--- C'EST CETTE LIGNE QUI MANQUAIT