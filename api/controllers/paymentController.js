const UserModel = require('../models/userModel');
const TransactionModel = require('../models/transactionModel'); // <-- NOUVEAU
const paypalService = require('../services/paypalService');

// ÉTAPE 1 : Le Front demande la permission de payer (Appelé par createOrder dans paypalManager.js)
exports.createPayPalOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) return res.status(400).json({ error: "Montant invalide" });

        // On prépare la demande à PayPal
        const request = paypalService.createOrderRequest(amount);
        const order = await paypalService.client.execute(request);

        // On renvoie l'ID unique (ex: '5K...') au Front pour qu'il ouvre la popup PayPal
        res.json({ id: order.result.id });

    } catch (err) {
        console.error("Erreur Create Order:", err.message || err);
        res.status(500).json({ error: "Erreur lors de la création du paiement PayPal" });
    }
};

// ÉTAPE 2 : Le Front dit "C'est payé !", le Back vérifie et livre le crédit
exports.capturePayPalOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.body; // L'ID que PayPal a donné

        // SÉCURITÉ : On demande directement à PayPal si l'argent est bien là
        const request = paypalService.captureOrderRequest(orderId);
        const capture = await paypalService.client.execute(request);

        // Si PayPal répond "COMPLETED", c'est que l'argent est sur ton compte
        if (capture.result.status === 'COMPLETED') {
            
            // On récupère le montant réel payé (sécurité)
            const amountPaid = capture.result.purchase_units[0].payments.captures[0].amount.value;
            const amountFloat = parseFloat(amountPaid);

            // --- LOGIQUE MÉTIER ---
            const user = await UserModel.findById(userId); // On récupère l'élève
            const newBalance = parseFloat(user.balance) + amountFloat; // On calcule son nouveau solde

            // 1. On met à jour la base de données
            const success = await UserModel.updateBalance(userId, newBalance);

            if (success) {
                // 2. Historique
                try {
                    await TransactionModel.create(userId, 'recharge', amountFloat, `Rechargement PayPal (${orderId})`);
                } catch (logErr) {
                    // Si le log échoue, on ne bloque pas la réponse client, mais on l'affiche côté serveur
                    console.error("⚠️ Erreur log transaction :", logErr.message);
                }

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