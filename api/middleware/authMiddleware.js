// Fichier: api/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
    // 1. Récupérer le token dans le header "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // On enlève le mot "Bearer"

    if (!token) {
        return res.status(401).json({ error: 'Accès refusé. Token manquant.' });
    }

    // 2. Vérifier la signature du token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide ou expiré.' });
        }
        
        // 3. Si tout est bon, on colle les infos de l'utilisateur dans la requête
        req.user = user;
        next(); // On passe au contrôleur suivant
    });
};