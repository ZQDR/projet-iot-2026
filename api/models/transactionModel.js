const db = require('../config/db');

class TransactionModel {
    // Enregistre une transaction (positive pour recharge, négative pour consommation)
    static async create(userId, type, amount, description) {
        const sql = 'INSERT INTO transactions (user_id, type, amount, description, created_at) VALUES (?, ?, ?, ?, NOW())';
        const [result] = await db.execute(sql, [userId, type, amount, description]);
        return result.insertId;
    }

    // Récupère l'historique financier d'un utilisateur
    static async getByUserId(userId) {
        const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC';
        const [rows] = await db.execute(sql, [userId]);
        return rows;
    }
}

module.exports = TransactionModel;