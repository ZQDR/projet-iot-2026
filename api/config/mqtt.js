// Fichier: api/config/mqtt.js
require('dotenv').config(); 

const options = {
    host: process.env.HIVEMQ_HOST,
    port: process.env.HIVEMQ_PORT || 8883,
    protocol: process.env.HIVEMQ_PROTOCOL || 'mqtts',
    username: process.env.HIVEMQ_USER,
    password: process.env.HIVEMQ_PASS,
};

// Vérification de sécurité
if (!options.host || !options.username || !options.password) {
    console.error("❌ ERREUR FATALE : Les identifiants MQTT manquent dans le fichier .env");
    process.exit(1); 
}

module.exports = options;