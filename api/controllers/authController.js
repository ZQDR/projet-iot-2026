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
        const { email, password } = req.body;

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

        // MULTI-SESSION : On n'incrémente plus la version pour ne pas déconnecter les autres sessions
        // await UserModel.incrementTokenVersion(user.id);

        // Générer le Token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'secret_temporaire_secours', // Fallback si .env vide
            { expiresIn: '72h' }
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
        const targetId = req.params.id; // L'ID dont on veut voir l'historique
        const requesterId = req.user.id; // L'ID de celui qui demande (via Token)

        // 1. Si l'utilisateur demande son propre historique, c'est OK
        // (On utilise '==' pour gérer la différence string/number)
        if (requesterId == targetId) {
            const history = await UserModel.getHistory(targetId);
            return res.json(history);
        }

        // 2. Si c'est un ID différent, on vérifie si le demandeur est ADMIN
        const requester = await UserModel.findById(requesterId);
        if (requester && requester.role === 'admin') {
            const history = await UserModel.getHistory(targetId);
            return res.json(history);
        }

        // 3. Sinon, c'est interdit
        return res.status(403).json({ error: "Accès interdit à cet historique." });

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