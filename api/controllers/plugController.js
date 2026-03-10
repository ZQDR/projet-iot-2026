const PlugModel = require('../models/plugModel');
const ConsumptionModel = require('../models/consumptionModel');
const UserModel = require('../models/userModel');
const TransactionModel = require('../models/transactionModel'); // <-- NOUVEAU
const qrcode = require('qrcode');
const mqttService = require('../services/mqttService');
const db = require('../config/db');

// --- QUAND MEHDI SCANNE LE QR CODE ---
exports.scanAndStart = async (req, res) => {
    try {
        const userId = req.user.id; 
        const { plugId } = req.body; // C'est le texte issu du QR Code (ex: "S1-01")

        const plug = await PlugModel.findById(plugId);
        if (!plug) return res.status(404).json({ error: 'Prise inconnue.' });
        if (plug.status === 'occupied') return res.status(400).json({ error: 'Prise déjà utilisée.' });

        const user = await UserModel.findById(userId);
        if (user.balance < 1.00) return res.status(403).json({ error: 'Solde insuffisant (1€ minimum).' });

        // On allume le courant et on démarre le chrono
        mqttService.turnOn(plugId);
        await ConsumptionModel.startSession(userId, plugId);
        await PlugModel.updateStatus(plugId, 'occupied');

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

        // 1. Calcul de l'énergie et du coût (ex: 0.40€ / kWh)
        const PRICE_PER_KWH = 0.40;
        const startTime = new Date(session.start_time);
        const endTime = new Date();
        const durationHours = (endTime - startTime) / (1000 * 60 * 60); // Durée en heures
        
        // NOTE: On estime une consommation moyenne (ex: 60W pour un PC portable).
        const averagePowerKW = 0.060; 
        const energyKwh = durationHours * averagePowerKW;
        const cost = energyKwh * PRICE_PER_KWH;

        // 2. Paiement
        const user = await UserModel.findById(userId);
        const newBalance = parseFloat(user.balance) - cost;
        await UserModel.updateBalance(userId, newBalance);

        // 3. Création de la transaction (en négatif)
        await TransactionModel.create(userId, 'payment', -cost, `Charge sur ${plugId} (${energyKwh.toFixed(3)} kWh)`);

        // 4. Clôture physique et logicielle
        await ConsumptionModel.closeSession(session.id, energyKwh, cost);
        await PlugModel.updateStatus(plugId, 'libre');
        mqttService.turnOff(plugId);

        res.json({
            message: "Session terminée",
            energy_kwh: energyKwh.toFixed(3),
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
        const [rows] = await db.execute('SELECT * FROM plugs');
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Impossible de récupérer les prises." });
    }
};