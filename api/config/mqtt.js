// Fichier: api/config/db.js
const mysql = require('mysql2');

// On ne charge dotenv QUE si on est en local (hors Docker)
// Dans Docker, c'est docker-compose qui fournit les variables, pas le fichier .env
if (process.env.DB_HOST !== 'db') {
    require('dotenv').config();
    const path = require('path');
    require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

console.log("----------------------------------------------------------------");
console.log("🔍 DIAGNOSTIC BDD (Démarrage du script db.js)");
console.log("----------------------------------------------------------------");
console.log(`1. ENVIRONNEMENT DÉTECTÉ : ${process.env.DB_HOST === 'db' ? 'DOCKER 🐳' : 'LOCAL 💻'}`);
console.log("2. VALEURS REÇUES :");
console.log(`   - HOST: '${process.env.DB_HOST}'`);
console.log(`   - USER: '${process.env.DB_USER}'`);
console.log(`   - PASS: '${process.env.DB_PASS ? '****** (Masquer)' : '❌ ABSENT'}'`);
console.log(`   - NAME: '${process.env.DB_NAME}'`);
console.log(`   - PORT: '${process.env.DB_PORT}'`);

// Logique de configuration robuste
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root', 
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'iot_project',
    // Si on est dans Docker (host="db"), on force 3306. Sinon (Local), on prend 3310.
    port: process.env.DB_HOST === 'db' ? 3306 : 3310,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log("3. CONFIGURATION FINALE UTILISÉE :");
console.log(`   -> Connexion vers : ${dbConfig.host}:${dbConfig.port}`);
console.log(`   -> Utilisateur : ${dbConfig.user}`);
console.log("----------------------------------------------------------------");

const pool = mysql.createPool(dbConfig);

// Test immédiat
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ ÉCHEC CONNEXION FINAL :');
        console.error(`   Code erreur: ${err.code}`);
        console.error(`   Message: ${err.message}`);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   👉 Problème de mot de passe ou nom d\'utilisateur.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('   👉 La base de données est injoignable (Vérifie le port et le host).');
        } else if (err.code === 'ER_BAD_DB_ERROR') {
            console.error('   👉 La base de données "iot_project" n\'existe pas.');
        }
    } else {
        console.log('✅ SUCCÈS : Base de données connectée et prête !');
        connection.release();
    }
});

module.exports = pool.promise();