module.exports = (req, res, next) => {
    // req.user est défini par authMiddleware qui s'exécute avant
    // On vérifie si l'utilisateur existe et s'il a le rôle 'admin'
    if (req.user && req.user.role === 'admin') {
        next(); // C'est un admin, on laisse passer
    } else {
        res.status(403).json({ error: "Accès refusé. Réservé aux administrateurs." });
    }
};