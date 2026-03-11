module.exports = (req, res, next) => {
    // req.user est défini par authMiddleware qui s'exécute avant
    // DEBUG : On affiche qui tente de passer
    console.log(`🛡️ [AdminCheck] Tentative par : ${req.user?.username} (ID: ${req.user?.id}) - Rôle: '${req.user?.role}'`);

    // On vérifie si l'utilisateur existe et s'il a le rôle 'admin'
    if (req.user && req.user.role === 'admin') {
        next(); // C'est un admin, on laisse passer
    } else {
        console.log(`⛔ [AdminCheck] BLOQUÉ : L'utilisateur n'est pas admin.`);
        res.status(403).json({ error: "Accès refusé. Réservé aux administrateurs." });
    }
};