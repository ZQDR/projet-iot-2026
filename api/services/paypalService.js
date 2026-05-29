// Utilisation de l'API REST directe (Remplace le SDK déprécié @paypal/checkout-server-sdk)

// Fonction pour nettoyer les guillemets (") ou apostrophes (') que Docker pourrait rajouter par erreur
const cleanEnvVar = (val) => (val || '').replace(/^["']|["']$/g, '').trim();

const PAYPAL_CLIENT_ID = cleanEnvVar(process.env.PAYPAL_CLIENT_ID);
const PAYPAL_CLIENT_SECRET = cleanEnvVar(process.env.PAYPAL_CLIENT_SECRET);

const base = 'https://api-m.sandbox.paypal.com';

// Générer le token d'accès PayPal
const generateAccessToken = async () => {
    try {
        const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
        const response = await fetch(`${base}/v1/oauth2/token`, {
            method: 'POST',
            body: 'grant_type=client_credentials',
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            cache: 'no-store' // Essentiel : force Node.js à ne jamais cacher l'ancien Token
        });
        const data = await response.json();
        
        if (!response.ok) {
            console.error("❌ Erreur API PayPal lors de la génération du token :", data);
            throw new Error(data.error_description || data.error || "Impossible de générer le token d'accès. Vérifiez vos clés PayPal.");
        }
        
        return data.access_token;
    } catch (error) {
        console.error("❌ Exception dans generateAccessToken :", error.message);
        throw error; // On remonte l'erreur pour que createOrder s'arrête
    }
};

module.exports = {
    // Créer une commande PayPal
    createOrder: async (amount) => {
        const accessToken = await generateAccessToken();
        if (!accessToken) throw new Error("Token d'accès manquant.");

        const url = `${base}/v2/checkout/orders`;
        const payload = {
            intent: 'CAPTURE',
            purchase_units: [{ amount: { currency_code: 'EUR', value: parseFloat(amount).toFixed(2) } }],
        };
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken.trim()}`,
            },
            method: 'POST',
            body: JSON.stringify(payload),
            cache: 'no-store'
        });
        
        return response.json();
    },

    // Capturer la commande (Validation du paiement)
    captureOrder: async (orderID) => {
        const accessToken = await generateAccessToken();
        if (!accessToken) throw new Error("Token d'accès manquant.");
        
        const url = `${base}/v2/checkout/orders/${orderID}/capture`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken.trim()}`,
            },
            cache: 'no-store'
        });
        
        return response.json();
    }
};