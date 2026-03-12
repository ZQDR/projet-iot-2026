const db = require('../config/db');

exports.getHistory = async (req, res) => {
    try {
        // On suppose que le middleware d'auth a ajouté req.user
        const userId = req.user.id;
        
        const sql = 'SELECT * FROM consumption WHERE user_id = ? ORDER BY start_time DESC';
        const [rows] = await db.execute(sql, [userId]);
        
        res.json(rows);
    } catch (err) {
        console.error("Erreur historique:", err);
        res.status(500).json({ error: "Impossible de récupérer l'historique." });
    }
};

// --- NOUVEAU : HISTORIQUE FINANCIER ---
exports.getTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC';
        const [rows] = await db.execute(sql, [userId]);
        res.json(rows);
    } catch (err) {
        console.error("Erreur historique transactions:", err);
        res.status(500).json({ error: "Impossible de récupérer les transactions." });
    }
};