// api/config/mqtt.js
require('dotenv').config();

const mqttConfig = {
    host: process.env.HIVEMQ_HOST,
    port: parseInt(process.env.HIVEMQ_PORT) || 8883,
    protocol: process.env.HIVEMQ_PROTOCOL || 'mqtts',
    username: process.env.HIVEMQ_USER,
    password: process.env.HIVEMQ_PASS,
};

// Sécurité : Si le host est vide, on arrête tout
if (!mqttConfig.host) {
    console.error("❌ ERREUR : HIVEMQ_HOST est indéfini. Vérifiez le fichier .env");
}

module.exports = mqttConfig;