// Fichier: services/mqttService.js
const mqtt = require('mqtt');
const mqttConfig = require('../config/mqtt'); // On récupère ta config sécurisée
const socketService = require('./socketService'); // Lien vers le WebSocket
const PlugModel = require('../models/plugModel'); // <-- On importe le modèle
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
                    // Au démarrage, on éteint toutes les prises qui ne sont pas utilisées pour économiser l'énergie
                    mqttService.turnOffUnusedPlugs();
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
            const nonDeviceKeywords = ['online', 'status', 'command', 'announce', 'relay', 'power', 'energy', 'apower', 'test', 'events', 'debug'];
            if (nonDeviceKeywords.includes(plugId)) {
                // On ignore immédiatement les mots-clés techniques génériques
                return;
            }

            try {
                // 1. Vérification si la prise existe DÉJÀ en BDD
                const plug = await PlugModel.findById(plugId);
                
                // --- FILTRE STRICT : Doit contenir "Prise" OU exister déjà en BDD ---
                if (!plugId.includes("Prise") && !plug) {
                    return; // On ignore : Ce n'est pas une "Prise" ET elle n'est pas connue dans la base
                }

                // --- AJOUT DYNAMIQUE ---
                if (!plug) {
                    // 2. Tentative d'insertion (isolée dans un try/catch pour ne pas tout bloquer)
                    try {
                        await db.execute('INSERT INTO plugs (id, status, state) VALUES (?, "libre", 0)', [plugId]);
                        console.log(`🔌 Nouvelle prise détectée et ajoutée : ${plugId}`);
                        socketService.emit('new_plug_added', { id: plugId });
                    } catch (insertErr) {
                        console.error(`❌ ERREUR CRITIQUE : Impossible d'ajouter la prise ${plugId}. La base de données refuse cet ID (trop long ?).`, insertErr.message);
                        return; // Stop ici, on ne peut pas mettre à jour une prise qui n'existe pas
                    }
                }

                // 3. Mise à jour du Last Ping
                await db.execute('UPDATE plugs SET last_ping = NOW() WHERE id = ?', [plugId]);

                console.log(`📩 Message reçu sur [${topic}] : ${payload}`);
                const type = topicParts[2];

                // Si c'est un message de données (relay, power, emeter ou status)
                if (type === 'relay' || type === 'power' || type === 'emeter' || type === 'status') {
                    try {
                        const data = JSON.parse(payload);

                        // 1. Gestion de la Puissance (Script 1 & 2)
                        if (data.power !== undefined) {
                            socketService.emit('power_update', { plugId, power: data.power });
                        }

                        // 1.bis Gestion de l'Énergie (On sauvegarde l'index en base)
                        if (data.energy !== undefined || data.total !== undefined) {
                            // On suppose que la valeur est en Wh (Watt-heure)
                            const energyVal = data.energy || data.total;
                            await db.execute('UPDATE plugs SET last_index = ? WHERE id = ?', [energyVal, plugId]);
                        }

                        // 1.bis Gestion de la Tension (Pour la maintenance proactive)
                        if (data.voltage !== undefined) {
                            await db.execute('UPDATE plugs SET voltage = ? WHERE id = ?', [data.voltage, plugId]);
                        }

                        // 2. Gestion de l'État ON/OFF (Script 3 : { "state": "on" })
                        if (data.state !== undefined) {
                            const ison = (data.state === 'on');
                            await db.execute('UPDATE plugs SET state = ? WHERE id = ?', [ison, plugId]);

                            // WEBSOCKET : On prévient le dashboard immédiatement
                            socketService.emit('state_update', { plugId, state: ison });

                            // SÉCURITÉ : Si la prise s'allume alors qu'elle est libre, on l'éteint immédiatement
                            if (ison) {
                                const [statusRows] = await db.execute('SELECT status FROM plugs WHERE id = ?', [plugId]);
                                if (statusRows.length > 0 && statusRows[0].status === 'libre') {
                                    console.log(`⚠️ Prise ${plugId} allumée mais libre -> Extinction forcée.`);
                                    mqttService.turnOff(plugId);
                                }
                            }
                        }
                    } catch (jsonErr) {
                        // Ce n'était pas du JSON valide, on ignore silencieusement
                    }
                }
            } catch (globalErr) {
                console.error(`Erreur générale traitement MQTT pour ${plugId}:`, globalErr);
            }
        });

        client.on('error', (err) => {
            console.error('❌ Erreur MQTT :', err);
        });
    },

    // Raccourci pour allumer
   turnOn: (plugId) => {
    mqttService.sendCommand(plugId, 'on'); // Minuscule
},
turnOff: (plugId) => {
    mqttService.sendCommand(plugId, 'off'); // Minuscule
},

    // Fonction pour envoyer un ordre à une prise (ON/OFF)
    // Utilisée par le contrôleur quand l'élève scanne le QR Code
sendCommand: (plugId, action) => {
        if (!client || !client.connected) return;

        const actionMin = action.toLowerCase(); // "off"
        const actionMaj = action.toUpperCase(); // "OFF"
        const actionJson = JSON.stringify({ state: actionMin }); // {"state":"off"}
        const actionTasmota = JSON.stringify({ power: actionMaj }); // {"power":"OFF"}

        // Une liste des topics les plus utilisés dans le monde IoT
        const tests = [
            { topic: `Shellies/${plugId}/command`, payload: actionMin },
            { topic: `Shellies/${plugId}/command`, payload: actionMaj },
            { topic: `Shellies/${plugId}/command`, payload: actionJson },
            { topic: `Shellies/${plugId}/relay/0/command`, payload: actionMin },
            { topic: `Shellies/${plugId}/relay/0/command`, payload: actionJson },
            { topic: `cmnd/Shellies/${plugId}/POWER`, payload: actionMaj }, // Tasmota
            { topic: `Shellies/${plugId}/set`, payload: actionMin },
            { topic: `Shellies/${plugId}/set`, payload: actionJson },
            { topic: `Shellies/${plugId}/rpc`, payload: JSON.stringify({id:1, src:"node", method:"Switch.Set", params:{id:0, on: (actionMin === 'on')}}) } // Shelly Gen 2
        ];

        console.log("🧨 Lancement du Brute Force MQTT...");
        tests.forEach(test => {
            client.publish(test.topic, test.payload);
            console.log(`Essai -> Topic: [${test.topic}] | Payload: ${test.payload}`);
        });
    },

    // Fonction pour éteindre toutes les prises marquées comme "libre"
    turnOffUnusedPlugs: async () => {
        try {
            console.log("🧹 Nettoyage : Extinction des prises inutilisées...");
            const [rows] = await db.execute("SELECT id FROM plugs WHERE status = 'libre'");
            
            for (const plug of rows) {
                mqttService.turnOff(plug.id);
                // On force l'état à 0 en base de données par précaution
                await db.execute('UPDATE plugs SET state = 0 WHERE id = ?', [plug.id]);
            }
        } catch (err) {
            console.error("Erreur lors du nettoyage des prises:", err);
        }
    }
};

module.exports = mqttService;