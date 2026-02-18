const db = require('../config/db');
const mqttService = require('../services/mqttService');

exports.getAllPlugs = async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM plugs');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.scanPlug = async (req, res) => {
    // TODO: Vérifier le crédit et envoyer l'ordre MQTT
    res.json({ message: "Scan reçu, traitement en cours..." });
};

exports.stopCharging = async (req, res) => {
    res.json({ message: "Charge arrêtée" });
};