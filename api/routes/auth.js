// Fichier: api/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // On importe le vigile
const adminMiddleware = require('../middleware/adminMiddleware'); // On importe le chef

// Admin seulement : Création de compte (On protège la route)
router.post('/register', authMiddleware, adminMiddleware, authController.register);

// Public : Connexion
router.post('/login', authController.login);
    
// Nouvelle route pour l'auto-login
router.post('/login-device', authController.loginByDevice);

// Privé : Il faut être connecté (avoir un token) pour voir son profil
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;