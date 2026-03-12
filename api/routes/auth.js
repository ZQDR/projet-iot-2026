// Fichier: api/routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware'); // On importe le vigile
const adminMiddleware = require('../middleware/adminMiddleware'); // On importe le chef

// Admin seulement : Création de compte (On protège la route)
router.post('/register', authMiddleware, adminMiddleware, authController.register);

// Admin seulement : Liste des utilisateurs (Username + Solde)
router.get('/users', authMiddleware, adminMiddleware, authController.getAllUsers);

// Admin seulement : Historique de consommation d'un utilisateur
// IMPORTANT : Si cette ligne est absente, vous aurez une Erreur 404
router.get('/users/:id/history', authMiddleware, adminMiddleware, authController.getUserHistory);

// Admin seulement : Supprimer un utilisateur spécifique
router.delete('/users/:id', authMiddleware, adminMiddleware, authController.deleteUserById);

// Public : Connexion
router.post('/login', authController.login);
    
// Nouvelle route pour l'auto-login
router.post('/login-device', authController.loginByDevice);

// Privé : Il faut être connecté (avoir un token) pour voir son profil
router.get('/profile', authMiddleware, authController.getProfile);

// Privé : Route pour supprimer son propre compte (RGPD)
router.delete('/delete', authMiddleware, authController.deleteAccount);

module.exports = router;