// Fichier: api/controllers/authController.js
const UserModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const db = require('../config/db');
const mqttService = require('../services/mqttService');
const socketService = require('../services/socketService');
const emailService = require('../services/emailService');

// INSCRIPTION
exports.register = async (req, res) => {
    try {
        // On attend 'username' car c'est ton champ SQL
        const { username, email, password, balance } = req.body;

        // Vérif simple (On vérifie undefined pour accepter un solde de 0)
        if (!username || !email || !password || balance === undefined) {
            return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
        }

        if (balance < 0 || balance > 100) {
            return res.status(400).json({ error: 'Le solde doit être compris entre 0€ et 100€.' });
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

        // Notifier les dashboards de l'apparition d'un nouvel utilisateur
        socketService.emit('user_data_updated', { userId: userId });

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

        if (!process.env.JWT_SECRET) {
            console.error("[AuthController] Erreur critique : JWT_SECRET n'est pas défini dans l'environnement !");
            return res.status(500).json({ error: 'Erreur de configuration du serveur.' });
        }

        // Générer le Token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
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

        let isAllowed = false;
        
        if (requesterId == targetId) {
            isAllowed = true;
        } else {
            const requester = await UserModel.findById(requesterId);
            if (requester && requester.role === 'admin') isAllowed = true;
        }

        if (!isAllowed) return res.status(403).json({ error: "Accès interdit à cet historique." });

        // Récupération de toutes les infos pour l'Admin (Historique, Transactions, Profil)
        const targetUser = await UserModel.findById(targetId);
        const history = await UserModel.getHistory(targetId);
        const [transactions] = await db.execute('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 15', [targetId]);

        return res.json({
            history: history,
            transactions: transactions,
            user: {
                username: targetUser.username,
                email: targetUser.email,
                balance: targetUser.balance,
                created_at: targetUser.created_at
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

// ADMIN : Mettre à jour les informations d'un utilisateur
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password, balance } = req.body;

        if (!username || !email || balance === undefined) {
            return res.status(400).json({ error: 'Tous les champs (sauf mot de passe) sont obligatoires.' });
        }

        if (balance < 0 || balance > 100) {
            return res.status(400).json({ error: 'Le solde doit être compris entre 0€ et 100€.' });
        }

        let hash = null;
        if (password && password.trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            hash = await bcrypt.hash(password, salt);
        }

        const success = await UserModel.update(id, username, email, hash, balance);
        if (!success) return res.status(404).json({ error: 'Utilisateur introuvable.' });

        socketService.emit('user_data_updated', { userId: id });
        res.json({ message: 'Utilisateur mis à jour avec succès.' });

    } catch (err) {
        console.error(err);
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre compte.' });
        res.status(500).json({ error: 'Erreur lors de la mise à jour.' });
    }
};

// PROFIL (Sécurisé)
exports.getProfile = async (req, res) => {
    // req.user.id vient du middleware
    const user = await UserModel.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
    
    // Sécurité : on retire le mot de passe avant d'envoyer
    if (user.password) delete user.password;

    res.json(user);
};

// SUPPRESSION DE COMPTE (RGPD - Droit à l'oubli)
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // --- FERMETURE DE LA PRISE SI UNE SESSION ÉTAIT EN COURS ---
        const [activeSessions] = await db.execute('SELECT plug_id FROM consumption WHERE user_id = ? AND end_time IS NULL', [userId]);
        for (const session of activeSessions) {
            const plugId = session.plug_id;
            mqttService.turnOff(plugId);
            await db.execute('UPDATE plugs SET status = "libre" WHERE id = ?', [plugId]);
            socketService.emit('status_update', { plugId, status: 'libre' });
        }

        // L'utilisateur ne peut supprimer que SON compte
        const success = await UserModel.delete(userId);

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

        // --- FERMETURE DE LA PRISE SI UNE SESSION ÉTAIT EN COURS ---
        const [activeSessions] = await db.execute('SELECT plug_id FROM consumption WHERE user_id = ? AND end_time IS NULL', [id]);
        for (const session of activeSessions) {
            const plugId = session.plug_id;
            mqttService.turnOff(plugId);
            await db.execute('UPDATE plugs SET status = "libre" WHERE id = ?', [plugId]);
            socketService.emit('status_update', { plugId, status: 'libre' });
        }

        const success = await UserModel.delete(id);
        if (!success) return res.status(404).json({ error: 'Utilisateur introuvable.' });
        socketService.emit('user_data_updated', { userId: id }); // Notifier la disparition
        res.json({ message: 'Utilisateur supprimé avec succès.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// SAUVEGARDE DU TOKEN PUSH EXPO (Mobile)
exports.savePushToken = async (req, res) => {
    try {
        const userId = req.user.id;
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Le champ "token" est manquant dans le corps de la requête.' });
        }

        // Sécurité : S'assurer que c'est bien un token Expo valide avant de polluer la BDD
        if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
            return res.status(400).json({ error: 'Format de token invalide. Attendu: ExponentPushToken[...]' });
        }

        await UserModel.savePushToken(userId, token);
        
        console.log(`✅ [Push Token] Sauvegardé avec succès pour l'utilisateur ID: ${userId}`);
        res.json({ message: 'Token Push sauvegardé avec succès.' });
    } catch (err) {
        console.error("Erreur savePushToken:", err);
        res.status(500).json({ error: 'Erreur lors de la sauvegarde du token.' });
    }
};

// EXPORT DES DONNÉES (RGPD - Droit à la portabilité)
exports.exportUserData = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
        if (user.password) delete user.password; // Sécurité

        const history = await UserModel.getHistory(userId);
        const [transactions] = await db.execute('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', [userId]);

        const exportData = {
            profile: user,
            consumption_history: history,
            transactions: transactions,
            exported_at: new Date().toISOString()
        };

        // Force le navigateur à télécharger un fichier JSON
        res.setHeader('Content-disposition', `attachment; filename=export_donnees_newton_${userId}.json`);
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (err) {
        console.error("Erreur lors de l'export RGPD:", err);
        res.status(500).json({ error: 'Erreur lors de l\'export des données.' });
    }
};

// --- NOUVEAU : SYSTÈME DE DEMANDE D'INSCRIPTION (Salles d'attente) ---

// 1. Soumettre une demande (Public - Dashboard Client)
exports.requestRegistration = async (req, res) => {
    try {
        const { firstName, lastName, email, password, rgpdConsent } = req.body;

        if (!firstName || !lastName || !email || !password || !rgpdConsent) {
            return res.status(400).json({ error: 'Tous les champs et le consentement RGPD sont obligatoires.' });
        }

        const username = `${firstName} ${lastName}`;

        // Vérifier si l'email existe déjà dans les utilisateurs actifs
        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ error: 'Cet email est déjà utilisé par un compte actif.' });
        }

        // Vérifier si une demande est déjà en attente pour cet email
        const [existingRequest] = await db.execute('SELECT id FROM registration_requests WHERE email = ?', [email]);
        if (existingRequest.length > 0) {
            return res.status(400).json({ error: 'Une demande est déjà en cours pour cet email.' });
        }

        // Hasher le mot de passe avant même de le stocker en salle d'attente (Sécurité absolue)
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Insérer la demande
        await db.execute(
            'INSERT INTO registration_requests (username, email, password, rgpd_consent) VALUES (?, ?, ?, ?)',
            [username, email, hash, rgpdConsent ? 1 : 0]
        );

        // Crier dans le WebSocket pour réveiller le Dashboard Admin en temps réel
        socketService.emit('new_registration_request', { message: 'Nouvelle demande de création de compte', username });

        res.status(201).json({ message: 'Demande envoyée avec succès. En attente de validation par un administrateur.' });
    } catch (err) {
        console.error("Erreur requestRegistration:", err);
        res.status(500).json({ error: 'Erreur serveur lors de la demande.' });
    }
};

// 2. Lister les demandes en attente (Admin seulement)
exports.getPendingRequests = async (req, res) => {
    try {
        const [requests] = await db.execute('SELECT id, username, email, created_at FROM registration_requests ORDER BY created_at ASC');
        res.json(requests);
    } catch (err) {
        console.error("Erreur getPendingRequests:", err);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};

// 3. Approuver une demande (Admin seulement)
exports.approveRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { initialBalance } = req.body;
        const balance = initialBalance !== undefined ? parseFloat(initialBalance) : 67.00;

        // Récupérer la demande
        const [requests] = await db.execute('SELECT * FROM registration_requests WHERE id = ?', [id]);
        if (requests.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });
        const request = requests[0];

        // Transfert officiel dans la table `users` (Le mot de passe est déjà hashé)
        const userId = await UserModel.create(request.username, request.email, request.password, balance);

        // Supprimer de la salle d'attente
        await db.execute('DELETE FROM registration_requests WHERE id = ?', [id]);

        // Mettre à jour les dashboards
        socketService.emit('user_data_updated', { userId });
        socketService.emit('registration_request_handled', { id });

        // 📧 Envoyer l'email de bienvenue
        await emailService.sendWelcomeEmail(request.email, request.username, balance);

        res.json({ message: 'Compte validé et créé avec succès !', userId });
    } catch (err) {
        console.error("Erreur approveRequest:", err);
        if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Cet email a déjà été validé.' });
        res.status(500).json({ error: 'Erreur serveur lors de la validation.' });
    }
};

// 4. Refuser une demande (Admin seulement)
exports.rejectRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute('DELETE FROM registration_requests WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Demande introuvable.' });

        socketService.emit('registration_request_handled', { id });
        res.json({ message: 'Demande refusée et supprimée.' });
    } catch (err) {
        console.error("Erreur rejectRequest:", err);
        res.status(500).json({ error: 'Erreur serveur lors du rejet.' });
    }
};