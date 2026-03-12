// Fichier: api/models/userModel.js
const db = require('../config/db');

class UserModel {

    // Créer un utilisateur (L'ID et le 'balance' de 10.00 sont gérés par MySQL)
    static async create(username, email, passwordHash, balance) {
        const sql = 'INSERT INTO users (username, email, password,balance) VALUES (?, ?, ?, ?)';
        const [result] = await db.execute(sql, [username, email, passwordHash, balance]);
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
        const sql = 'SELECT id, username, email, balance, created_at, role FROM users WHERE id = ?';
        const [rows] = await db.execute(sql, [id]);
        return rows[0];
    }

    // Mettre à jour le solde (Pour la consommation ou recharge PayPal)
    static async updateBalance(id, newBalance) {
        const sql = 'UPDATE users SET balance = ? WHERE id = ?';
        const [result] = await db.execute(sql, [newBalance, id]);
        return result.affectedRows > 0;
    }

    // Récupérer tous les utilisateurs (Pour Admin)
    // On ne sélectionne que 'username' et 'balance' comme demandé
    static async findAll() {
        const sql = 'SELECT id, username, balance FROM users';
        const [rows] = await db.execute(sql);
        return rows;
    }

    // Récupérer l'historique de consommation d'un utilisateur
    static async getHistory(userId) {
        const sql = 'SELECT start_time, energy_kwh, cost, plug_id FROM consumption WHERE user_id = ? ORDER BY start_time DESC';
        const [rows] = await db.execute(sql, [userId]);
        return rows || []; // Retourne un tableau vide si null
    }

    // Supprimer un utilisateur (RGPD - Droit à l'oubli)
    static async delete(id) {
        // Nettoyage préalable pour éviter les erreurs de contraintes SQL (Foreign Keys)
        await db.execute('DELETE FROM consumption WHERE user_id = ?', [id]);
        await db.execute('DELETE FROM transactions WHERE user_id = ?', [id]);
        
        const sql = 'DELETE FROM users WHERE id = ?';
        const [result] = await db.execute(sql, [id]);
        return result.affectedRows > 0;
    }
    
}



module.exports = UserModel;