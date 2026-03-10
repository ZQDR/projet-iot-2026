const db = require('../config/db');

class TransactionModel {

    /**
     * Crée un enregistrement de transaction (recharge, dépense, etc.)
     * @param {number} userId - ID de l'utilisateur
     * @param {string} type - 'recharge' ou 'payment'
     * @param {number} amount - Montant de la transaction
     * @param {string} description - Description (ex: 'Rechargement PayPal (ID_ORDER)')
     */
    static async create(userId, type, amount, description) {
        const sql = 'INSERT INTO transactions (user_id, type, amount, description, created_at) VALUES (?, ?, ?, ?, NOW())';
        const [result] = await db.execute(sql, [userId, type, amount, description]);
        return result.insertId;
    }
}

module.exports = TransactionModel;