const db = require('../config/db');

class TransactionModel {
    // Ajouter une ligne dans l'historique des transactions
    static async create(userId, type, amount, description) {
        try {
            const [result] = await db.execute(
                'INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
                [userId, type, amount, description]
            );
            return result.insertId;
        } catch (error) {
            console.error("Erreur DB TransactionModel :", error);
            throw error;
        }
    }
}

module.exports = TransactionModel;