const PlugModel = require('../models/plugModel');
const ConsumptionModel = require('../models/consumptionModel');
const UserModel = require('../models/userModel');
const TransactionModel = require('../models/transactionModel'); // <-- NOUVEAU
const qrcode = require('qrcode');
const mqttService = require('../services/mqttService');
const socketService = require('../services/socketService');
const db = require('../config/db');
const pushService = require('../services/pushService'); // <-- Import du nouveau service

// --- QUAND MEHDI SCANNE LE QR CODE ---
exports.scanAndStart = async (req, res) => {
    try {
        console.log(`[CONTROLLER] Appel de scanAndStart reçu. Body:`, req.body);
        const userId = req.user.id; 
        const { plugId } = req.body; // C'est le texte issu du QR Code (ex: "S1-01")

        const plug = await PlugModel.findById(plugId);
        if (!plug) return res.status(404).json({ error: 'Prise inconnue.' });
        if (plug.status === 'occupied') return res.status(400).json({ error: 'Prise déjà utilisée.' });

        const user = await UserModel.findById(userId);
        if (user.balance < 1.00) return res.status(403).json({ error: 'Solde insuffisant (1€ minimum).' });

        // 1. On récupère l'index actuel de la prise AVANT de démarrer (compteur kilométrique)
        const plugData = await PlugModel.findById(plugId);
        const startIndex = parseFloat(plugData.last_index) || 0;

        // On allume le courant et on démarre le chrono
        mqttService.turnOn(plugId);
        await ConsumptionModel.startSession(userId, plugId);
        await PlugModel.updateStatus(plugId, 'occupied');
        console.log(`🟢 [CONTROLLER] Prise ${plugId} démarrée. Déclenchement du WebSocket...`);
        socketService.emit('status_update', { plugId, status: 'occupied', username: user.username });

        // 2. On sauvegarde cet index de départ dans la session créée
        const session = await ConsumptionModel.getActiveSession(userId, plugId);
        if (session) {
            // Mise à jour manuelle de la colonne index_start
            await db.execute('UPDATE consumption SET index_start = ? WHERE id = ?', [startIndex, session.id]);
        }

        // --- NOUVEAU : On prévient l'admin qu'une session a commencé pour rafraîchir le graph ---
        socketService.emit('user_data_updated', { userId: userId });

        res.json({ message: 'Session démarrée ! Le courant est activé.', plugId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors du scan.' });
    }
};

// --- QUAND MEHDI CLIQUE SUR "ARRÊTER" ---
exports.stopCharge = async (req, res) => {
    try {
        const userId = req.user.id;
        const { plugId } = req.body;

        const session = await ConsumptionModel.getActiveSession(userId, plugId);
        if (!session) return res.status(404).json({ error: "Aucune session active." });

        // 1. Récupération de la consommation RÉELLE
        const plugData = await PlugModel.findById(plugId);
        const currentIndex = parseFloat(plugData.last_index) || 0;
        const startIndex = parseFloat(session.index_start) || 0;

        // Calcul du delta (Fin - Début) en Wh, puis conversion en kWh
        let realEnergyWh = currentIndex - startIndex;
        if (realEnergyWh < 0) realEnergyWh = 0; // Sécurité si reset compteur
        const energyKwh = realEnergyWh / 1000;
        
        // Calcul du prix basé sur le tarif réglementé en France (~0.2516€ / kWh)
        const PRICE_PER_KWH = 0.2516;
        //let cost = energyKwh * PRICE_PER_KWH;
        let cost = energyKwh * 1000000;
        // 2. Paiement
        const user = await UserModel.findById(userId);
        const newBalance = Math.max(0, parseFloat(user.balance) - cost);
        await UserModel.updateBalance(userId, newBalance);

        // 3. Création de la transaction (en négatif)
        await TransactionModel.create(userId, 'payment', -cost, `Charge sur ${plugId} (${energyKwh.toFixed(3)} kWh)`);

        // 4. Clôture physique et logicielle
        await ConsumptionModel.closeSession(session.id, energyKwh, cost);
        await PlugModel.updateStatus(plugId, 'libre');
        socketService.emit('status_update', { plugId, status: 'libre' });
        mqttService.turnOff(plugId);

        // On prévient les dashboards que les données d'un utilisateur (solde, historique) ont changé
        socketService.emit('user_data_updated', { userId: userId });

        res.json({
            message: "Session terminée",
            energy_kwh: energyKwh.toFixed(4), // 4 décimales pour voir les micro-consommations
            cost: `${cost.toFixed(2)}€`,
            newBalance: `${newBalance.toFixed(2)}€`
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de l'arrêt." });
    }
};

// --- POUR L'ADMIN : GÉNÉRER UN QR CODE ---
exports.generateQrCode = async (req, res) => {
    try {
        const { plugId } = req.params;

        // Amélioration : On vérifie que la prise existe avant de générer l'image
        const plug = await PlugModel.findById(plugId);
        if (!plug) {
            return res.status(404).send("Prise non trouvée");
        }

        // Génère le QR code sous forme de buffer PNG
        const buffer = await qrcode.toBuffer(plugId, { type: 'png' });

        // On envoie l'image directement en réponse
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);

    } catch (err) {
        console.error("Erreur lors de la génération du QR code:", err);
        res.status(500).json({ error: "Erreur serveur." });
    }
};

// --- POUR LE DASHBOARD : LISTER TOUTES LES PRISES ---
exports.getAllPlugs = async (req, res) => {
    try {
        const sql = `
            SELECT p.*, u.username 
            FROM plugs p 
            LEFT JOIN consumption c ON p.id = c.plug_id AND c.end_time IS NULL 
            LEFT JOIN users u ON c.user_id = u.id
        `;
        const [rows] = await db.execute(sql);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Impossible de récupérer les prises." });
    }
};

// --- POUR L'ADMIN : AJOUTER UNE NOUVELLE PRISE ---
exports.createPlug = async (req, res) => {
    try {
        const { plugId } = req.body;
        if (!plugId) return res.status(400).json({ error: "L'ID de la prise est requis." });

        // On insère la prise (si elle n'existe pas déjà, sinon erreur SQL gérée par le catch ou on pourrait vérifier avant)
        // On initialise à 'libre' et 'FALSE' (éteint)
        await db.execute('INSERT INTO plugs (id, status, state) VALUES (?, "libre", 0)', [plugId]);

        // Avertir le dashboard admin et les clients
        socketService.emit('new_plug_added', { id: plugId });

        res.status(201).json({ message: "Prise ajoutée avec succès.", plugId });
    } catch (err) {
        console.error("Erreur création prise:", err);
        res.status(500).json({ error: "Erreur lors de la création (ID déjà existant ?)." });
    }
};

// --- POUR L'ADMIN : SUPPRIMER UNE PRISE ---
exports.deletePlug = async (req, res) => {
    try {
        const { plugId } = req.params;

        // --- NOUVEAU : On détache l'historique avant de supprimer ---
        // Met à NULL le plug_id dans la table consumption pour conserver
        // les données de facturation des utilisateurs sans bloquer la suppression.
        await db.execute('UPDATE consumption SET plug_id = NULL WHERE plug_id = ?', [plugId]);

        // Suppression SQL
        await db.execute('DELETE FROM plugs WHERE id = ?', [plugId]);

        // Avertir le dashboard admin et les clients pour recharger la liste
        socketService.emit('new_plug_added', { id: plugId });

        res.json({ message: "Prise supprimée avec succès." });
    } catch (err) {
        console.error("Erreur suppression prise:", err);
        // Ce bloc catch sert toujours de sécurité au cas où une autre contrainte bloque
        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: "Impossible de supprimer cette prise car elle possède un historique de consommation." });
        }
        res.status(500).json({ error: "Erreur serveur lors de la suppression." });
    }
};

// --- POUR L'ADMIN : FORCER L'ARRÊT D'UNE SESSION ---
exports.forceStopCharge = async (req, res) => {
    try {
        const { plugId } = req.params;
        const plug = await PlugModel.findById(plugId);
        if (!plug) return res.status(404).json({ error: "Prise introuvable." });

        if (plug.status !== 'occupied') {
            return res.status(400).json({ error: "Aucune session en cours sur cette prise." });
        }

        // 1. Chercher et clôturer la session active
        const [sessions] = await db.execute('SELECT * FROM consumption WHERE plug_id = ? AND end_time IS NULL', [plugId]);
        if (sessions.length > 0) {
            const session = sessions[0];
            const userId = session.user_id;

            const currentIndex = parseFloat(plug.last_index) || 0;
            const startIndex = parseFloat(session.index_start) || 0;
            let realEnergyWh = Math.max(0, currentIndex - startIndex);
            const energyKwh = realEnergyWh / 1000;
            let cost = energyKwh * 0.2516; // Prix du kWh en France

            const user = await UserModel.findById(userId);
            const newBalance = Math.max(0, parseFloat(user.balance) - cost);

            await UserModel.updateBalance(userId, newBalance);
            await TransactionModel.create(userId, 'payment', -cost, `Arrêt forcé (Admin) sur ${plugId}`);
            await ConsumptionModel.closeSession(session.id, energyKwh, cost);
            socketService.emit('user_data_updated', { userId: userId });
            
            socketService.emit('session_auto_stopped', {
                userId: userId,
                plugId: plugId,
                reason: 'admin_force_stop',
                message: `Un administrateur a forcé l'arrêt de votre session sur la prise ${plugId}.`
            });
            
            // Notification Push (App fermée)
            pushService.sendPushAlert(userId, '🛑 Arrêt forcé', `Un administrateur a coupé votre prise ${plugId}.`);
        }

        // 2. Extinction et libération de la prise
        await db.execute('UPDATE plugs SET status = "libre", state = 0 WHERE id = ?', [plugId]);
        mqttService.turnOff(plugId);
        socketService.emit('status_update', { plugId, status: 'libre' });

        res.json({ message: "Session arrêtée avec succès." });
    } catch (err) {
        console.error("Erreur forceStopCharge:", err);
        res.status(500).json({ error: "Erreur lors de l'arrêt forcé." });
    }
};

// --- POUR L'ADMIN : BASCULER LE MODE MAINTENANCE ---
exports.toggleMaintenance = async (req, res) => {
    try {
        const { plugId } = req.params;
        const plug = await PlugModel.findById(plugId);
        if (!plug) return res.status(404).json({ error: "Prise introuvable." });

        if (plug.status !== 'hs') {
            // 1. Vérifier s'il y a une session en cours pour l'arrêter
            const [sessions] = await db.execute('SELECT * FROM consumption WHERE plug_id = ? AND end_time IS NULL', [plugId]);
            if (sessions.length > 0) {
                const session = sessions[0];
                const userId = session.user_id;
                
                const currentIndex = parseFloat(plug.last_index) || 0;
                const startIndex = parseFloat(session.index_start) || 0;
                let realEnergyWh = Math.max(0, currentIndex - startIndex);
                const energyKwh = realEnergyWh / 1000;
                
                let cost = energyKwh * 0.2516; // Prix du kWh en France

                const user = await UserModel.findById(userId);
                const newBalance = Math.max(0, parseFloat(user.balance) - cost);
                
                await UserModel.updateBalance(userId, newBalance);
                await TransactionModel.create(userId, 'payment', -cost, `Arrêt forcé (Maintenance) sur ${plugId}`);
                await ConsumptionModel.closeSession(session.id, energyKwh, cost);
                
                socketService.emit('user_data_updated', { userId: userId });

                socketService.emit('session_auto_stopped', {
                    userId: userId,
                    plugId: plugId,
                    reason: 'maintenance',
                    message: `La prise ${plugId} a été mise en maintenance. Votre session est arrêtée.`
                });
                
                // Notification Push (App fermée)
                pushService.sendPushAlert(userId, '🔧 Maintenance', `La prise ${plugId} a été mise en maintenance. Votre session est interrompue.`);
            }

            // 2. Mettre en maintenance et éteindre électriquement
            await db.execute('UPDATE plugs SET status = "hs", state = 0 WHERE id = ?', [plugId]);
            mqttService.turnOff(plugId);
            socketService.emit('status_update', { plugId, status: 'hs' });
            
            res.json({ message: "Prise mise en maintenance." });
        } else {
            // Sortie de maintenance
            await db.execute('UPDATE plugs SET status = "libre" WHERE id = ?', [plugId]);
            socketService.emit('status_update', { plugId, status: 'libre' });
            
            res.json({ message: "Prise de nouveau libre." });
        }
    } catch (err) {
        console.error("Erreur toggleMaintenance:", err);
        res.status(500).json({ error: "Erreur lors du changement de maintenance." });
    }
};

// --- POUR LA MAINTENANCE : ALERTES PROACTIVES ---
exports.getMaintenanceAlerts = async (req, res) => {
    try {
        // On cherche :
        // 1. Les prises marquées 'hs'
        // 2. Les prises qui n'ont pas donné signe de vie (ping) depuis 5 minutes
        // 3. Les prises avec une tension anormale (ex: < 210V ou > 250V) alors qu'elles communiquent
        const sql = `
            SELECT *, 
            TIMESTAMPDIFF(MINUTE, last_ping, NOW()) as minutes_since_last_ping,
            CASE 
                WHEN voltage > 0 AND (voltage < 210 OR voltage > 250) THEN 'Tension Anormale'
                WHEN last_ping < (NOW() - INTERVAL 5 MINUTE) THEN 'Perte Communication'
                ELSE 'HS Manuel'
            END as alert_reason
            FROM plugs 
            WHERE last_ping < (NOW() - INTERVAL 5 MINUTE) 
            OR status = 'hs'
            OR (voltage > 0 AND (voltage < 210 OR voltage > 250))
        `;
        const [rows] = await db.execute(sql);

        res.json({
            alert_count: rows.length,
            devices: rows
        });
    } catch (err) {
        console.error("Erreur alertes maintenance:", err);
        res.status(500).json({ error: "Erreur lors de l'analyse du réseau." });
    }
};

// --- POUR L'ADMIN : CONFIGURER LA PRISE (PUISSANCE MAX) ---
exports.configurePlug = async (req, res) => {
    try {
        const { plugId } = req.params;
        const { powerLimit } = req.body;
        const plug = await PlugModel.findById(plugId);
        if (!plug) return res.status(404).json({ error: "Prise introuvable." });

        if (powerLimit !== undefined && !isNaN(powerLimit)) {
            mqttService.sendRPC(plugId, "Switch.SetConfig", {
                id: 0,
                config: { power_limit: parseInt(powerLimit) }
            });
        }
        
        res.json({ message: "Configuration envoyée à la prise." });
    } catch (err) {
        console.error("Erreur configurePlug:", err);
        res.status(500).json({ error: "Erreur lors de la configuration." });
    }
};

// --- POUR L'ADMIN : REDÉMARRER PHYSIQUEMENT LA PRISE ---
exports.rebootPlug = async (req, res) => {
    try {
        const { plugId } = req.params;
        mqttService.sendRPC(plugId, "Shelly.Reboot");
        res.json({ message: "Ordre de redémarrage envoyé à la prise." });
    } catch (err) {
        console.error("Erreur rebootPlug:", err);
        res.status(500).json({ error: "Erreur lors du redémarrage." });
    }
};