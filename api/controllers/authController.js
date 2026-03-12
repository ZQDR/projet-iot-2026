// Fichier: api/controllers/authController.js
const UserModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();

// INSCRIPTION
exports.register = async (req, res) => {
    try {
        // On attend 'username' car c'est ton champ SQL
        const { username, email, password, balance } = req.body;

        // Vérif simple (On vérifie undefined pour accepter un solde de 0)
        if (!username || !email || !password || balance === undefined) {
            return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
        }

        // Vérifier si l'email existe déjà
        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé.' });
        }

        // Hasher le mot de passe
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Créer l'utilisateur
        const userId = await UserModel.create(username, email, hash, balance);

        res.status(201).json({ message: 'Utilisateur créé !', userId });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

// CONNEXION
exports.login = async (req, res) => {
    try {
        // CORRECTION ICI : On récupère aussi 'deviceId'
        const { email, password, deviceId } = req.body;

        // Chercher l'utilisateur
        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        // Vérifier le mot de passe
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Identifiants incorrects.' });
        }

        // --- NOUVEAU : Enregistrement du téléphone ---
        if (deviceId) {
            // Si l'utilisateur a envoyé un deviceId, on le sauvegarde en BDD
            await UserModel.updateDeviceId(user.id, deviceId);
        }
        // ----------------------------------------------

        // SÉCURITÉ : On change la version pour invalider les anciens tokens
        await UserModel.incrementTokenVersion(user.id);
        const updatedUser = await UserModel.findById(user.id); // On récupère la nouvelle version

        // Génération d'un secret dynamique aléatoire
        const dynamicSecret = crypto.randomBytes(32).toString('hex');

        // Générer le Token
        const token = jwt.sign(
            { id: user.id, email: user.email, version: updatedUser.token_version, secret: dynamicSecret },
            dynamicSecret,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Connexion réussie',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                balance: user.balance
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

exports.loginByDevice = async (req, res) => {
    try {
        const { deviceId } = req.body;

        if (!deviceId) return res.status(400).json({ error: "Device ID manquant" });

        // On cherche à qui appartient ce téléphone
        const user = await UserModel.findByDeviceId(deviceId);

        if (!user) {
            // Le téléphone n'est pas reconnu, il faut se connecter avec email/mdp
            return res.status(401).json({ error: "Appareil non reconnu, veuillez vous connecter manuellement." });
        }

        // SÉCURITÉ : On change la version
        await UserModel.incrementTokenVersion(user.id);
        const updatedUser = await UserModel.findById(user.id);

        // Génération d'un secret dynamique aléatoire
        const dynamicSecret = crypto.randomBytes(32).toString('hex');

        // Si reconnu, on génère direct un Token !
        const token = jwt.sign(
            { id: user.id, email: user.email, version: updatedUser.token_version, secret: dynamicSecret },
            dynamicSecret,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Reconnexion automatique réussie',
            token: token,
            user: { id: user.id, username: user.username, balance: user.balance }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

// LISTER TOUS LES UTILISATEURS (Admin seulement)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await UserModel.findAll();
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

// ADMIN : Récupérer l'historique de consommation d'un utilisateur
exports.getUserHistory = async (req, res) => {
    try {
        const { id } = req.params;
        const history = await UserModel.getHistory(id);
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

// PROFIL (Sécurisé)
exports.getProfile = async (req, res) => {
    // req.user.id vient du middleware
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    
    res.json(user);
};

// SUPPRESSION DE COMPTE (RGPD - Droit à l'oubli)
exports.deleteAccount = async (req, res) => {
    try {
        // req.user.id vient du token, l'utilisateur ne peut supprimer que SON compte
        const success = await UserModel.delete(req.user.id);

        if (!success) return res.status(404).json({ error: 'Utilisateur introuvable.' });

        res.json({ message: 'Compte et données personnelles supprimés avec succès.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors de la suppression du compte.' });
    }
};

// ADMIN : Supprimer un utilisateur spécifique par son ID
exports.deleteUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const success = await UserModel.delete(id);
        if (!success) return res.status(404).json({ error: 'Utilisateur introuvable.' });
        res.json({ message: 'Utilisateur supprimé avec succès.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};