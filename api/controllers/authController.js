const db = require('../config/db');

exports.register = async (req, res) => {
    // TODO: Implémenter la création de compte (Hash password, INSERT into users)
    res.json({ message: "Endpoint d'inscription (À coder)" });
};

exports.login = async (req, res) => {
    // TODO: Vérifier le mot de passe et renvoyer un token JWT
    res.json({ message: "Endpoint de connexion (À coder)" });
};

exports.getProfile = async (req, res) => {
    res.json({ message: "Profil utilisateur (À coder)" });
};