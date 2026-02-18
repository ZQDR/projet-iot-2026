// Fichier: api/config/db.js
const mysql = require('mysql2');

// Pas besoin de refaire dotenv.config() ici si index.js est lancé, 
// mais on le garde par sécurité au cas où ce fichier serait testé seul.
require('dotenv').config(); 

// Détection de l'environnement :
// Si DB_HOST est défini (par Docker ou .env), on l'utilise.
// Sinon, on utilise 'localhost' par défaut.
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS, // Doit correspondre à ton docker-compose
    database: process.env.DB_NAME,
    // ASTUCE : Si on est sur 'localhost', on utilise le port 3310 (ton mapping Docker), 
    // sinon (dans Docker container), on utilise le port standard 3306.
    port: process.env.DB_PORT || (process.env.DB_HOST === 'db' ? 3306 : 3310),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log(`🔌 Tentative de connexion MySQL vers : ${dbConfig.host}:${dbConfig.port}`);

const pool = mysql.createPool(dbConfig);

// On teste la connexion immédiatement pour éviter de chercher le bug plus tard
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ ERREUR DE CONNEXION BDD :', err.code);
        console.error('   -> Vérifie que le conteneur Docker "db" est bien lancé.');
        if (dbConfig.host === 'localhost') {
            console.error('   -> En local, vérifie que le port 3310 est bien accessible.');
        }
    } else {
        console.log('✅ Base de données connectée avec succès !');
        connection.release();
    }
});

// On exporte la version "Promise" pour pouvoir faire des "await" propres dans les contrôleurs
module.exports = pool.promise();