const UserModel = require('../models/userModel');
const TransactionModel = require('../models/transactionModel'); // <-- NOUVEAU
const paypalService = require('../services/paypalService');

// 1. CRÉER L'ORDRE (Appelé quand l'utilisateur clique sur "Payer 10€")
exports.createPayPalOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide" });

        // On prépare la demande à PayPal
        const request = paypalService.createOrderRequest(amount);
        const order = await paypalService.client.execute(request);

        // On renvoie l'ID de commande au téléphone pour qu'il affiche la fenêtre PayPal
        res.json({ id: order.result.id });

    } catch (err) {
        console.error("Erreur Create Order:", err.message || err);
        res.status(500).json({ error: "Erreur lors de la création du paiement PayPal" });
    }
};

// 2. CAPTURER LE PAIEMENT (Appelé quand l'utilisateur a fini de payer sur PayPal)
exports.capturePayPalOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.body; // L'ID que PayPal a donné

        // On demande à PayPal de valider la transaction
        const request = paypalService.captureOrderRequest(orderId);
        const capture = await paypalService.client.execute(request);

        // Si PayPal dit "COMPLETED", c'est bon !
        if (capture.result.status === 'COMPLETED') {
            
            // On récupère le montant réel payé (sécurité)
            const amountPaid = capture.result.purchase_units[0].payments.captures[0].amount.value;
            const amountFloat = parseFloat(amountPaid);

            // --- LOGIQUE MÉTIER ---
            const user = await UserModel.findById(userId);
            const newBalance = parseFloat(user.balance) + amountFloat;

            // 1. Mise à jour du solde
            const success = await UserModel.updateBalance(userId, newBalance);

            if (success) {
                // 2. Historique
                await TransactionModel.create(userId, 'recharge', amountFloat, `Rechargement PayPal (${orderId})`);

                res.json({
                    message: 'Paiement réussi ! Solde mis à jour.',
                    newBalance: newBalance.toFixed(2)
                });
            } else {
                res.status(500).json({ error: "Erreur lors de la mise à jour du solde utilisateur." });
            }
        } else {
            res.status(400).json({ error: "Le paiement n'a pas été validé par PayPal." });
        }

    } catch (err) {
        console.error("Erreur Capture Order:", err.message || err);
        res.status(500).json({ error: "Erreur lors de la validation du paiement." });
    }
};