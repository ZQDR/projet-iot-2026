// Fichier: api/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // On importe le vigile

// Public : Tout le monde peut s'inscrire ou se connecter
router.post('/register', authController.register);
router.post('/login', authController.login);

// Privé : Il faut être connecté (avoir un token) pour voir son profil
router.get('/profile', authMiddleware, authController.getProfile);

module.exports = router;