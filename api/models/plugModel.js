const db = require('../config/db');

class PlugModel {

    // Récupérer les infos d'une prise par son ID (ex: 'S1-01')
    static async findById(id) {
        const sql = 'SELECT * FROM plugs WHERE id = ?';
        const [rows] = await db.execute(sql, [id]);
        return rows[0];
    }

    // Mettre à jour le statut (libre / occupied)
    static async updateStatus(id, status) {
        const sql = 'UPDATE plugs SET status = ? WHERE id = ?';
        const [result] = await db.execute(sql, [status, id]);
        return result.affectedRows > 0;
    }
}

module.exports = PlugModel;