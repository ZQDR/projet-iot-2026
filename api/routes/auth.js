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

// Historique de consommation (Mixte : Admin ou Soi-même)
// On retire 'adminMiddleware' ici, le contrôle se fera dans le contrôleur
router.get('/users/:id/history', authMiddleware, authController.getUserHistory);

// Admin seulement : Supprimer un utilisateur spécifique
router.delete('/users/:id', authMiddleware, adminMiddleware, authController.deleteUserById);

// Public : Connexion (C'est ici que le POST est défini)
router.post('/login', authController.login);

// Aide Debug : Si on essaie d'accéder à /login via le navigateur (GET)
router.get('/login', (req, res) => {
    res.status(405).json({ 
        error: "Méthode non autorisée.", 
        message: "Ceci est une API. Utilisez une requête POST avec email et mot de passe pour vous connecter." 
    });
});
    
// Privé : Il faut être connecté (avoir un token) pour voir son profil
router.get('/profile', authMiddleware, authController.getProfile);

// Privé : Route pour supprimer son propre compte (RGPD)
router.delete('/delete', authMiddleware, authController.deleteAccount);

module.exports = router;