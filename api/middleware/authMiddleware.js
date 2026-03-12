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

    // 2. Extraire le secret du payload
    const decodedToken = jwt.decode(token);
    
    if (!decodedToken || !decodedToken.secret) {
        return res.status(403).json({ error: 'Token invalide (Secret manquant).' });
    }

    // 3. Vérifier la signature du token avec le secret extrait
    jwt.verify(token, decodedToken.secret, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide ou expiré.' });
        }
        
        try {
            // 4. On récupère l'utilisateur complet en BDD pour avoir le champ 'balance' à jour
            const user = await UserModel.findById(decoded.id);
            
            if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' });
            
            // 5. Vérification de la version du token (Révocation)
            // On traite le cas où le token n'a pas de version (vieux token) comme étant version 0
            const tokenVersion = decoded.version !== undefined ? decoded.version : 0;

            if (user.token_version !== tokenVersion) {
                return res.status(401).json({ error: 'Session expirée (Nouvelle connexion détectée).' });
            }

            // DEBUG : Vérifier si le rôle est bien présent dans l'objet user
            // console.log(`👤 [Auth] User chargé : ${user.username}, Role DB: ${user.role}`);

            req.user = user;
            next(); // On passe au contrôleur suivant
        } catch (error) {
            return res.status(500).json({ error: 'Erreur serveur.' });
        }
    });
};