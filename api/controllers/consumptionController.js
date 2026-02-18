const db = require('../config/db');

exports.getHistory = async (req, res) => {
    // TODO: Récupérer l'historique depuis la table 'consumption'
    res.json({ history: [] });
};