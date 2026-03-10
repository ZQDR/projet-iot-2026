// Fichier: api/models/transactionModel.js
const db = require('../config/db');

class TransactionModel {
    
    // Enregistrer un mouvement d'argent
    static async create(userId, type, amount, description) {
        const sql = 'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)';
        const [result] = await db.execute(sql, [userId, type, amount, description]);
        return result.insertId;
    }

    // Récupérer l'historique financier d'un élève (Pour l'appli de Mehdi)
    static async getUserHistory(userId) {
        const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC';
        const [rows] = await db.execute(sql, [userId]);
        return rows;
    }
}

module.exports = TransactionModel;