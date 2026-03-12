// Fichier: api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const UserModel = require('../models/userModel');
require('dotenv').config();

module.exports = (req, res, next) => {
    // 1. Récupérer le token dans le header "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // On enlève le mot "Bearer"

    if (!token) {
        return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
    }

    // 2. Vérifier la signature du token avec le secret du serveur (comme dans authController)
    const secret = process.env.JWT_SECRET || 'secret_temporaire_secours';

    jwt.verify(token, secret, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide ou expiré.' });
        }
        
        try {
            // 3. On récupère l'utilisateur en BDD
            const user = await UserModel.findById(decoded.id);
            
            if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
            
            // Sécurité : on retire le mot de passe de l'objet utilisateur
            delete user.password;

            req.user = user;
            next(); // On passe au contrôleur suivant
        } catch (error) {
            return res.status(500).json({ error: 'Erreur serveur.' });
        }
    });
};