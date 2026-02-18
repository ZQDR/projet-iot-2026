// Fichier: api/models/userModel.js
const db = require('../config/db');

class UserModel {

    // Créer un utilisateur (L'ID et le 'balance' de 10.00 sont gérés par MySQL)
    static async create(username, email, passwordHash) {
        const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        const [result] = await db.execute(sql, [username, email, passwordHash]);
        return result.insertId;
    }

    // Trouver par Email (Pour le Login)
    static async findByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ?';
        const [rows] = await db.execute(sql, [email]);
        return rows[0];
    }

    // Trouver par ID (Pour le Profil - On ne renvoie jamais le mot de passe !)
    static async findById(id) {
        const sql = 'SELECT id, username, email, balance, created_at FROM users WHERE id = ?';
        const [rows] = await db.execute(sql, [id]);
        return rows[0];
    }

    // Mettre à jour le solde (Pour la consommation ou recharge PayPal)
    static async updateBalance(id, newBalance) {
        const sql = 'UPDATE users SET balance = ? WHERE id = ?';
        const [result] = await db.execute(sql, [newBalance, id]);
        return result.affectedRows > 0;
    }

    static async updateDeviceId(userId, deviceId) {
    const sql = 'UPDATE users SET device_id = ? WHERE id = ?';
    await db.execute(sql, [deviceId, userId]);
}

// Ajoute aussi cette méthode pour chercher par DeviceID
static async findByDeviceId(deviceId) {
    const sql = 'SELECT * FROM users WHERE device_id = ?';
    const [rows] = await db.execute(sql, [deviceId]);
    return rows[0];
}
    
}



module.exports = UserModel;