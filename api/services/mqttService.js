// Fichier: services/mqttService.js
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt'); // On récupère ta config sécurisée
const socketService = require('./socketService'); // Pour prévenir le dashboard

let client = null;

const mqttService = {
    connect: () => {
        // Connexion au Broker HiveMQ
        client = mqtt.connect(mqttConfig);

        client.on('connect', () => {
            console.log('✅ Connecté au broker MQTT HiveMQ !');
            
            // On s'abonne à tous les messages des prises
            // Topic exemple : "prises/+/status" (+ remplace n'importe quel ID)
            client.subscribe('Shellies/#', (err) => {
                if (!err) {
                    console.log('📡 Abonné au topic : prises/#');
                }
            });
        });

        // QUAND ON REÇOIT UN MESSAGE D'UNE PRISE
        client.on('message', (topic, message) => {
            const payload = message.toString();
            console.log(`📩 Message reçu sur [${topic}] : ${payload}`);

            // 1. On prévient le Dashboard immédiatement (Temps réel)
            // Le dashboard recevra un événement 'mqtt_message'
            socketService.emit('mqtt_message', {
                topic: topic,
                data: payload,
                timestamp: Date.now()
            });

            // TODO : Ici, tu pourrais ajouter une fonction pour sauvegarder 
            // la consommation en Base de Données (via un contrôleur ou un modèle)
        });

        client.on('error', (err) => {
            console.error('❌ Erreur MQTT :', err);
        });
    },

    // Fonction pour envoyer un ordre à une prise (ON/OFF)
    // Utilisée par le contrôleur quand l'élève scanne le QR Code
    sendCommand: (plugId, action) => {
        if (client && client.connected) {
            // Exemple de topic : prises/S1-01/command
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