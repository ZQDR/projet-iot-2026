const db = require('../config/db');

class ConsumptionModel {

    /**
     * Démarre une nouvelle session de consommation
     * @param {number} userId - ID de l'utilisateur
     * @param {string} plugId - ID de la prise (ex: 'S1-01')
     */
    static async startSession(userId, plugId) {
        const sql = 'INSERT INTO consumption (user_id, plug_id, start_time) VALUES (?, ?, NOW())';
        const [result] = await db.execute(sql, [userId, plugId]);
        return result.insertId;
    }

    /**
     * Récupère la session active d'un utilisateur sur une prise précise
     * Utile pour vérifier si l'utilisateur est bien celui qui utilise la prise
     */
    static async getActiveSession(userId, plugId) {
        const sql = 'SELECT * FROM consumption WHERE user_id = ? AND plug_id = ? AND end_time IS NULL';
        const [rows] = await db.execute(sql, [userId, plugId]);
        return rows[0];
    }

    /**
     * Vérifie si une prise est déjà en cours d'utilisation (par n'importe qui)
     */
    static async isPlugInUse(plugId) {
        const sql = 'SELECT * FROM consumption WHERE plug_id = ? AND end_time IS NULL';
        const [rows] = await db.execute(sql, [plugId]);
        return rows.length > 0;
    }

    /**
     * Clôture une session en enregistrant l'heure de fin, l'énergie et le coût
     */
    static async closeSession(sessionId, energy, cost) {
        const sql = `
            UPDATE consumption 
            SET end_time = NOW(), 
                energy_kwh = ?, 
                cost = ? 
            WHERE id = ?
        `;
        const [result] = await db.execute(sql, [energy, cost, sessionId]);
        return result.affectedRows > 0;
    }

    /**
     * Récupère l'historique complet d'un utilisateur
     */
    static async getUserHistory(userId) {
        const sql = 'SELECT * FROM consumption WHERE user_id = ? ORDER BY start_time DESC';
        const [rows] = await db.execute(sql, [userId]);
        return rows;
    }
}

module.exports = ConsumptionModel;