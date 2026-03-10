// Fichier: services/mqttService.js
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt'); // On récupère ta config sécurisée
const socketService = require('./socketService'); // Lien vers le WebSocket

let client = null;

const mqttService = {
    connect: () => {
        // Connexion au Broker HiveMQ
        client = mqtt.connect(mqttConfig);

        client.on('connect', () => {
            console.log('✅ Connecté au broker MQTT HiveMQ !');
            
            // On s'abonne à tous les messages des prises
            // Topic exemple : "Shellies/+/status" (+ remplace n'importe quel ID)
            client.subscribe('Shellies/#', (err) => {
                if (!err) {
                    console.log('📡 Abonné au topic : Shellies/#');
                }
            });
        });

        // QUAND ON REÇOIT UN MESSAGE D'UNE PRISE
        client.on('message', (topic, message) => {
            const payload = message.toString();
            // console.log(`📩 Message reçu sur [${topic}] : ${payload}`);

            // Analyse du topic pour trouver l'ID de la prise (ex: Shellies/S1-01/status)
            const topicParts = topic.split('/');
            const plugId = topicParts[1]; // "S1-01"
            const type = topicParts[2];   // "status" ou "command" ou "power"

            // Si c'est un message de puissance (selon le modèle de la prise)
            if (type === 'relay' || type === 'power') {
                try {
                    // Souvent les prises envoient du JSON : {"power": 20.5, "ison": true}
                    const data = JSON.parse(payload);

                    if (data.power !== undefined) {
                        // Envoi immédiat au Dashboard pour l'affichage en temps réel
                        socketService.emit('power_update', { plugId, power: data.power });
                    }
                } catch (e) {
                    // Ce n'était pas du JSON, on ignore
                }
            }
        });

        client.on('error', (err) => {
            console.error('❌ Erreur MQTT :', err);
        });
    },

    // Raccourci pour allumer
    turnOn: (plugId) => {
        mqttService.sendCommand(plugId, 'ON');
    },

    // Raccourci pour éteindre
    turnOff: (plugId) => {
        mqttService.sendCommand(plugId, 'OFF');
    },

    // Fonction pour envoyer un ordre à une prise (ON/OFF)
    // Utilisée par le contrôleur quand l'élève scanne le QR Code
    sendCommand: (plugId, action) => {
        if (client && client.connected) {
            // Exemple de topic : Shellies/S1-01/command
            const topic = `Shellies/${plugId}/command`; 
            const message = action; // "ON" ou "OFF"
            
            client.publish(topic, message);
            console.log(`📤 Commande envoyée : ${message} -> ${topic}`);
        } else {
            console.error("⚠️ Impossible d'envoyer la commande : Client MQTT déconnecté.");
        }
    }
};

module.exports = mqttService;