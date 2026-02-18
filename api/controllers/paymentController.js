// Fichier: api/controllers/paymentController.js
const UserModel = require('../models/userModel');

// Fonction pour recharger le compte (Simulateur ou suite à succès PayPal)
exports.topUp = async (req, res) => {
    try {
        // req.user.id est fourni par le middleware (le token JWT)
        const userId = req.user.id;
        const { amount } = req.body;

        // Validation basique
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: 'Montant invalide.' });
        }

        // 1. Récupérer l'utilisateur pour connaître son solde actuel
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur introuvable.' });
        }

        // 2. Calculer le nouveau solde
        // parseFloat est important pour éviter de concaténer des chaines de caractères
        const newBalance = parseFloat(user.balance) + parseFloat(amount);

        // 3. Mettre à jour en base de données
        const success = await UserModel.updateBalance(userId, newBalance);

        if (success) {
            res.json({
                message: 'Rechargement effectué avec succès !',
                previousBalance: user.balance,
                newBalance: newBalance.toFixed(2), // On renvoie 2 chiffres après la virgule
                addedAmount: amount
            });
        } else {
            res.status(500).json({ error: 'Erreur lors de la mise à jour du solde.' });
        }

    } catch (error) {
        console.error('Erreur topUp:', error);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};