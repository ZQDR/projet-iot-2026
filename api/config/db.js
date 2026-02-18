const mysql = require('mysql2');
require('dotenv').config(); 

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    // Le port est maintenant correctement fourni par l'environnement
    // (3306 via Docker Compose, ou 3310 via le .env en local)
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

console.log(`🔌 Connexion MySQL vers : ${dbConfig.host}:${dbConfig.port} (User: ${dbConfig.user})`);

const pool = mysql.createPool(dbConfig);

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ ERREUR BDD :', err.code);
        if (err.code === 'ECONNREFUSED') {
            console.error(`   -> Impossible de joindre ${dbConfig.host}:${dbConfig.port}`);
        }
    } else {
        console.log('✅ Base de données connectée avec succès !');
        connection.release();
    }
});

module.exports = pool.promise();