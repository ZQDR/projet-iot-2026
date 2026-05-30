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

// Admin seulement : Mettre à jour un utilisateur
router.put('/users/:id', authMiddleware, adminMiddleware, authController.updateUser);

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

// Privé : Route pour exporter ses propres données (RGPD)
router.get('/export', authMiddleware, authController.exportUserData);

// Privé : Sauvegarder le token Expo Push (Mobile)
router.post('/push-token', authMiddleware, authController.savePushToken);

// --- NOUVEAU : SYSTÈME DE DEMANDE D'INSCRIPTION (Salles d'attente) ---
router.post('/request-registration', authController.requestRegistration); // Accessible à tous
router.get('/pending-requests', authMiddleware, adminMiddleware, authController.getPendingRequests);
router.post('/pending-requests/:id/approve', authMiddleware, adminMiddleware, authController.approveRequest);
router.delete('/pending-requests/:id/reject', authMiddleware, adminMiddleware, authController.rejectRequest);

module.exports = router;