const UserModel = require('../models/userModel');
const TransactionModel = require('../models/transactionModel'); // <-- NOUVEAU
const paypalService = require('../services/paypalService');
const socketService = require('../services/socketService');
const stripe = require('../services/stripeService');
const db = require('../config/db'); // Nécessaire pour vérifier les doublons

// ÉTAPE 1 : Le Front demande la permission de payer (Appelé par createOrder dans paypalManager.js)
exports.createPayPalOrder = async (req, res) => {
    try {
        const { amount, returnUrl } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: "Montant invalide ou manquant dans la requête. Attendu : { 'amount': '10.00' }" });
        }

        // Vérification de la limite de 100€
        const user = await UserModel.findById(req.user.id);
        if (parseFloat(user.balance) + parseFloat(amount) > 100) {
            return res.status(400).json({ error: "Le solde maximum autorisé est de 100€. Vous ne pouvez pas recharger ce montant." });
        }

        // PayPal exige un format de prix très strict (chaîne de caractères avec 2 décimales, ex: "10.00")
        const formattedAmount = parseFloat(amount).toFixed(2).toString();

        // --- GESTION INTELLIGENTE WEB VS MOBILE POUR PAYPAL ---
        let finalReturnUrl = 'https://recharge.cielnewton.fr/';
        let finalCancelUrl = 'https://recharge.cielnewton.fr/';
        
        if (returnUrl) {
            // 1. C'est l'App Mobile (Elle a fourni son propre Deep Link type newtoncharge://)
            finalReturnUrl = returnUrl;
            const separator = returnUrl.includes('?') ? '&' : '?';
            finalCancelUrl = `${returnUrl}${separator}cancel=true`;
        } else if (req.headers.origin) {
            // 2. C'est le Dashboard Web (On utilise l'URL du navigateur, ex: http://localhost:8080)
            finalReturnUrl = `${req.headers.origin}/`;
            finalCancelUrl = `${req.headers.origin}/`;
        }

        // Création de la commande via notre nouveau service basé sur fetch
        const orderData = await paypalService.createOrder(formattedAmount, finalReturnUrl, finalCancelUrl);

        // VÉRIFICATION : Si PayPal n'a pas renvoyé d'ID (ex: problème d'identifiants ou de réseau)
        if (!orderData || !orderData.id) {
            console.error(`❌ [PayPal] Erreur retournée par l'API PayPal :`, orderData);
            return res.status(500).json({ error: "Erreur de communication avec l'API PayPal", details: orderData });
        }

        console.log(`✅ [PayPal] Commande créée avec succès sur le Backend !`);
        console.log(`👉 ID envoyé au Frontend : ${orderData.id}`);
        console.log(`⚠️ Si la popup plante maintenant, vérifiez que le HTML contient bien "&currency=EUR" et le bon client-id.`);

        // On renvoie l'ID unique (ex: '5K...') au Front pour qu'il ouvre la popup PayPal
        res.json({ id: orderData.id });

    } catch (err) {
        console.error("❌ ERREUR PAYPAL (Create Order) :");
        console.error("- Message :", err.message);
        if (err.statusCode) console.error("- Code HTTP :", err.statusCode);
        res.status(500).json({ error: err.message || "Erreur lors de la création du paiement PayPal" });
    }
};

// ÉTAPE 2 : Le Front dit "C'est payé !", le Back vérifie et livre le crédit
exports.capturePayPalOrder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { orderId } = req.body; // L'ID que PayPal a donné

        // VÉRIFICATION NOUVELLE : Si Mehdi oublie d'envoyer l'ID ou se trompe de nom de variable
        if (!orderId) {
            return res.status(400).json({ error: "ID de commande manquant. Le body doit contenir { 'orderId': 'ID_DE_PAYPAL' }." });
        }

        // SÉCURITÉ : On demande directement à PayPal si l'argent est bien là
        const captureData = await paypalService.captureOrder(orderId);

        // Si PayPal répond "COMPLETED", c'est que l'argent est sur ton compte
        if (captureData.status === 'COMPLETED') {
            
            // On récupère le montant réel payé (sécurité)
            const amountPaid = captureData.purchase_units[0].payments.captures[0].amount.value;
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

                // Notifier les dashboards du changement de solde
                socketService.emit('user_data_updated', { userId: userId });

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

// --- STRIPE : CRÉATION DE LA SESSION DE PAIEMENT ---
exports.createStripeSession = async (req, res) => {
    try {
        if (!stripe) return res.status(500).json({ error: "Stripe n'est pas configuré sur le serveur (Clé manquante)." });

        const { amount, returnUrl } = req.body;
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: "Montant invalide." });
        }

        // Vérification de la limite de 100€
        const user = await UserModel.findById(req.user.id);
        if (parseFloat(user.balance) + parseFloat(amount) > 100) {
            return res.status(400).json({ error: "Le solde maximum autorisé est de 100€. Vous ne pouvez pas recharger ce montant." });
        }

        // Définition de l'URL de retour : 
        // Priorité 1: Mobile (returnUrl) | Priorité 2: Web (origin) | Priorité 3: Fallback serveur
        let baseUrl = returnUrl || req.headers.origin || 'https://recharge.cielnewton.fr';

        // SÉCURITÉ : Stripe exige une URL absolue (doit contenir "://").
        // Si le front-end envoie "localhost:3000" sans "http://" ou la string "null", on le corrige.
        if (baseUrl === 'null' || baseUrl === 'undefined' || !baseUrl.includes('://')) {
            console.warn(`[Stripe] URL invalide reçue du client (${baseUrl}), utilisation de l'URL de secours.`);
            baseUrl = 'https://recharge.cielnewton.fr';
        }

        // GESTION DES DEEP LINKS (Natif / Expo) vs WEB
        // On supprime le slash final s'il y en a un pour harmoniser
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        let successUrl, cancelUrl;

        if (cleanBaseUrl.startsWith('http')) {
            // Environnement Web (https://...)
            successUrl = `${cleanBaseUrl}/?stripe_session_id={CHECKOUT_SESSION_ID}`;
            cancelUrl = `${cleanBaseUrl}/`;
        } else {
            // Environnement Mobile (Deep Link natif type newtoncharge:// ou exp://)
            // On ajoute les paramètres à l'URL Scheme sans forcer de chemin web classique
            const separator = cleanBaseUrl.includes('?') ? '&' : '?';
            successUrl = `${cleanBaseUrl}${separator}stripe_session_id={CHECKOUT_SESSION_ID}`;
            cancelUrl = cleanBaseUrl;
        }

        // On demande à Stripe de créer une page de paiement temporaire
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], // Accepte CB, Google Pay, Apple Pay
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: 'Recharge Crédit Lycée Newton',
                        description: 'Rechargement du compte étudiant',
                    },
                    unit_amount: Math.round(amount * 100), // Stripe exige des centimes (ex: 10€ -> 1000)
                },
                quantity: 1,
            }],
            mode: 'payment',
            // Redirection intelligente en fonction de l'environnement (Web vs Mobile)
            success_url: successUrl,
            cancel_url: cancelUrl,
            client_reference_id: req.user.id.toString(), // On garde l'ID de l'élève en mémoire
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error("Erreur Stripe Create:", err);
        // On renvoie l'erreur exacte à l'application de Mehdi pour faciliter le débogage
        res.status(500).json({ error: "Erreur d'initialisation : " + err.message });
    }
};

// --- STRIPE : VÉRIFICATION AU RETOUR DE L'ÉLÈVE ---
exports.verifyStripeSession = async (req, res) => {
    try {
        if (!stripe) return res.status(500).json({ error: "Stripe non configuré." });
        const { sessionId } = req.body;
        const userId = req.user.id;
        if (!sessionId) return res.status(400).json({ error: "Session invalide." });

        // On interroge les serveurs de Stripe pour vérifier si l'argent a bien été versé
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid' && session.client_reference_id === userId.toString()) {
            // Vérification de sécurité : On s'assure qu'on n'a pas déjà crédité cette transaction
            const [existingTx] = await db.execute('SELECT id FROM transactions WHERE description LIKE ?', [`%${sessionId}%`]);
            if (existingTx.length > 0) return res.json({ message: "Paiement déjà validé." });

            const amountFloat = session.amount_total / 100; // Centimes -> Euros
            const user = await UserModel.findById(userId);
            
            if (!user) return res.status(404).json({ error: "Utilisateur introuvable en base de données." });

            const newBalance = parseFloat(user.balance) + amountFloat;

            if (await UserModel.updateBalance(userId, newBalance)) {
                // Sécurisation : on enregistre l'historique sans bloquer le crédit si ça échoue
                try {
                    await TransactionModel.create(userId, 'recharge', amountFloat, `Rechargement Stripe CB (${sessionId})`);
                } catch (txErr) {
                    console.error("⚠️ Erreur log transaction Stripe :", txErr.message);
                }
                socketService.emit('user_data_updated', { userId: userId });

                return res.json({ message: 'Paiement Stripe validé !', newBalance: newBalance.toFixed(2) });
            }
        }

        res.status(400).json({ error: "Paiement non validé par la banque." });
    } catch (err) {
        console.error("Erreur Stripe Verify:", err);
        // Renvoyer l'erreur exacte au front pour le débogage
        res.status(500).json({ error: "Erreur serveur : " + err.message });
    }
};

// --- PAYPAL : RÉCUPÉRER LE CLIENT ID POUR LE FRONTEND ---
exports.getPayPalConfig = (req, res) => {
    res.json({ clientId: process.env.PAYPAL_CLIENT_ID || '' });
};