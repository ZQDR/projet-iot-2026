// Fichier: services/mqttService.js
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt'); // On récupère ta config sécurisée
const socketService = require('./socketService'); // Lien vers le WebSocket
const db = require('../config/db');

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
        client.on('message', async (topic, message) => {
            const payload = message.toString();

            // Analyse du topic pour trouver l'ID de la prise (ex: Shellies/S1-01/status)
            const topicParts = topic.split('/');
            if (topicParts.length < 2) return; // Topic invalide, on ignore
            
            const plugId = topicParts[1];
            if (!plugId) return; // ID de prise vide, on ignore

            // --- NOUVEAU : Filtre pour éviter les faux positifs ---
            // On définit une liste de mots-clés qui sont des parties de topics, mais pas des ID de prises.
            const nonDeviceKeywords = ['online', 'status', 'command', 'announce', 'relay', 'power', 'energy', 'apower', 'test'];
            if (nonDeviceKeywords.includes(plugId)) {
                // Ce message est sur un topic générique (ex: "Shellies/online"), on l'ignore pour l'auto-découverte.
                console.log(`📢 Message sur un topic générique ignoré pour l'auto-découverte : ${topic}`);
                return;
            }

            try {
                // --- AJOUT DYNAMIQUE DE LA PRISE ---
                const [rows] = await db.execute('SELECT id FROM plugs WHERE id = ?', [plugId]);
                if (rows.length === 0) {
                    // C'est une nouvelle prise, on l'ajoute !
                    await db.execute('INSERT INTO plugs (id, status, state) VALUES (?, "libre", 0)', [plugId]);
                    console.log(`🔌 Nouvelle prise détectée et ajoutée à la base de données : ${plugId}`);
                    // On notifie le dashboard pour qu'il se mette à jour
                    socketService.emit('new_plug_added', { id: plugId });
                }
                // ------------------------------------

                console.log(`📩 Message reçu sur [${topic}] : ${payload}`);
                const type = topicParts[2];

                // Si c'est un message de puissance (selon le modèle de la prise)
                if (type === 'relay' || type === 'power') {
                    // Souvent les prises envoient du JSON : {"power": 20.5, "ison": true}
                    const data = JSON.parse(payload);
                    if (data.power !== undefined) {
                        // Envoi immédiat au Dashboard pour l'affichage en temps réel
                        socketService.emit('power_update', { plugId, power: data.power });
                    }
                }
            } catch (e) {
                console.error(`Erreur lors du traitement du message MQTT pour ${plugId}:`, e);
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