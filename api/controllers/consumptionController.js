const db = require('../config/db');

exports.getMyHistory = async (req, res) => {
    try {
        // On suppose que le middleware d'auth a ajouté req.user
        const userId = req.user.id;
        
        const sql = 'SELECT id, start_time, plug_id, cost, energy_kwh FROM consumption WHERE user_id = ? ORDER BY start_time DESC';
        const [rows] = await db.execute(sql, [userId]);
        
        // Formatage pour le frontend (plug_id -> plugId)
        const history = rows.map(row => ({
            id: row.id,
            start_time: row.start_time,
            plugId: row.plug_id,
            cost: row.cost,
            energy_kwh: row.energy_kwh
        }));

        res.json(history);
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
        // Sécurité : on renvoie un tableau vide si aucun résultat n'est trouvé
        res.json(rows || []);
    } catch (err) {
        console.error("Erreur historique transactions:", err);
        res.status(500).json({ error: "Impossible de récupérer les transactions." });
    }
};