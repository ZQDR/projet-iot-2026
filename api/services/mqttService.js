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

                let currentPower = undefined;
                let energyVal = undefined;
                let ison = undefined;

                // --- CAS A : Valeurs brutes (Gen 1) ---
                const subTopic = topicParts[topicParts.length - 1];
                if (subTopic === 'power') currentPower = parseFloat(payload);
                else if (subTopic === 'energy') energyVal = parseFloat(payload) / 60; // Wmin -> Wh
                else if (type === 'relay' && topicParts.length === 4) {
                    if (payload === 'on') ison = true;
                    if (payload === 'off') ison = false;
                }

                // --- CAS B : Valeurs JSON complexes (Gen 1 & Gen 2) ---
                let plugData = null;
                try { plugData = JSON.parse(payload); } catch (e) { /* Ne plante pas si ce n'est pas du JSON */ }
                
                if (plugData && typeof plugData === 'object') {
                    // Normalisation Gen 2
                    if (plugData.method === 'NotifyStatus' && plugData.params && plugData.params['switch:0']) {
                        plugData = plugData.params['switch:0'];
                    }

                    if (plugData.power !== undefined) currentPower = plugData.power;
                    else if (plugData.apower !== undefined) currentPower = plugData.apower;

                    if (plugData.energy !== undefined) energyVal = plugData.energy / 60;
                    else if (plugData.total !== undefined) energyVal = plugData.total;
                    else if (plugData.total_wh !== undefined) energyVal = plugData.total_wh;
                    else if (plugData.aenergy !== undefined && plugData.aenergy.total !== undefined) energyVal = plugData.aenergy.total;

                    if (plugData.state !== undefined) ison = (plugData.state === 'on');
                    else if (plugData.output !== undefined) ison = (plugData.output === true);
                    else if (plugData.status !== undefined) ison = (plugData.status === 'on');

                    if (plugData.voltage !== undefined) {
                        await db.execute('UPDATE plugs SET voltage = ? WHERE id = ?', [plugData.voltage, plugId]);
                    }
                }

                // --- EMISSION DES DONNEES ---
                if (currentPower !== undefined) {
                    socketService.emit('power_update', { plugId, power: currentPower });
                }

                if (energyVal !== undefined) {
                    console.log(`💾 [DEBUG BDD] Énergie lue : ${energyVal.toFixed(2)} Wh`);
                    await db.execute('UPDATE plugs SET last_index = ? WHERE id = ?', [energyVal, plugId]);

                    try {
                        const [sessions] = await db.execute('SELECT id, user_id, index_start FROM consumption WHERE plug_id = ? AND end_time IS NULL', [plugId]);
                        if (sessions.length > 0) {
                            const activeSession = sessions[0];
                            const userId = activeSession.user_id;
                            const indexStart = parseFloat(activeSession.index_start) || 0;
                            
                            let currentEnergyWh = energyVal - indexStart;
                            if (currentEnergyWh < 0) currentEnergyWh = 0;
                            
                            const energyKwh = currentEnergyWh / 1000;
                            let currentCost = Math.max(0.05, energyKwh * 0.50); // Calcul du coût réel (minimum 5 centimes)

                            // Récupération du solde initial de l'utilisateur
                            const [users] = await db.execute('SELECT balance FROM users WHERE id = ?', [userId]);
                            if (users.length > 0) {
                                const initialBalance = parseFloat(users[0].balance);
                                const currentBalance = initialBalance - currentCost;

                                console.log(`🔌 [WS] Envoi live_consumption: User=${userId}, Wh=${currentEnergyWh}, Solde=${currentBalance.toFixed(2)}`);
                                socketService.emit('live_consumption', {
                                    userId: userId,
                                    plugId: plugId,
                                    sessionId: activeSession.id,
                                    energyWh: currentEnergyWh,
                                    cost: currentCost,
                                    newBalance: currentBalance
                                });

                                // --- VÉRIFICATION DU SOLDE (AUTO-STOP) ---
                                if (currentBalance <= 0) {
                                    console.log(`🛑 Solde épuisé pour user ${userId}. Arrêt automatique de la prise ${plugId}.`);

                                    // 1. Mise à jour en BDD (Transactions, Utilisateurs, Conso)
                                    await db.execute('UPDATE users SET balance = ? WHERE id = ?', [currentBalance, userId]);
                                    await db.execute('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)', [userId, 'payment', -currentCost, `Coupure auto sur ${plugId} (Solde épuisé)`]);
                                    await db.execute('UPDATE consumption SET end_time = NOW(), energy_kwh = ?, cost = ? WHERE id = ?', [energyKwh, currentCost, activeSession.id]);

                                    // 2. Extinction physique
                                    await db.execute('UPDATE plugs SET status = "libre", state = 0 WHERE id = ?', [plugId]);
                                    mqttService.turnOff(plugId);

                                    // 3. Notification générale (Dashboard Admin & Client)
                                    socketService.emit('status_update', { plugId: plugId, status: 'libre' });
                                    socketService.emit('user_data_updated', { userId: userId });
                                    
                                    // 4. Notification ciblée pour afficher la Popup chez l'utilisateur
                                    socketService.emit('session_auto_stopped', {
                                        userId: userId,
                                        plugId: plugId,
                                        reason: 'solde_epuise',
                                        message: "Votre solde est épuisé. La session a été arrêtée automatiquement."
                                    });
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Erreur calcul conso:", err);
                    }
                }

                if (ison !== undefined) {
                    await db.execute('UPDATE plugs SET state = ? WHERE id = ?', [ison, plugId]);
                    socketService.emit('state_update', { plugId, state: ison });

                    if (ison) {
                        const [statusRows] = await db.execute('SELECT status FROM plugs WHERE id = ?', [plugId]);
                        if (statusRows.length > 0 && statusRows[0].status === 'libre') {
                            console.log(`⚠️ Prise ${plugId} allumée mais libre -> Extinction forcée.`);
                            mqttService.turnOff(plugId);
                        }
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
        if (client && client.connected) {
            // Le topic EXACT pour contrôler une prise Shelly Gen 2 (Gamme Plus/Pro)
            const topic = `Shellies/${plugId}/command/switch:0`; 
            
            // On envoie "on" ou "off" en minuscules
            const message = action.toLowerCase(); 
            
            client.publish(topic, message);
            console.log(`📤 Commande Gen 2 envoyée : ${message} -> ${topic}`);
        } else {
            console.error("⚠️ Impossible d'envoyer la commande : Client MQTT déconnecté.");
        }
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