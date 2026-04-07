// Utilisation de l'API REST directe (Remplace le SDK déprécié @paypal/checkout-server-sdk)

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || 'AVwXN3Rbd66-P2JW76cuG91VMscS0E-g66mwyQQUbjiJqpkpTQOh-VRmx_E8TkwfRArQpAdygkkTeZBJ';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || 'EIg_lhXpnia2gSFf46ywj-LSofC4r-Ry9kATXUGOiI5_mlmbos6FbxunvnEuNgmIdxAqf1V17CNxlUe-';
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
            },
        });
        const data = await response.json();
        return data.access_token;
    } catch (error) {
        console.error("Erreur de génération du token PayPal:", error);
    }
};

module.exports = {
    // Créer une commande PayPal
    createOrder: async (amount) => {
        const accessToken = await generateAccessToken();
        const url = `${base}/v2/checkout/orders`;
        const payload = {
            intent: 'CAPTURE',
            purchase_units: [{ amount: { currency_code: 'EUR', value: parseFloat(amount).toFixed(2) } }],
        };
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            method: 'POST',
            body: JSON.stringify(payload),
        });
        return response.json();
    },

    // Capturer la commande (Validation du paiement)
    captureOrder: async (orderID) => {
        const accessToken = await generateAccessToken();
        const url = `${base}/v2/checkout/orders/${orderID}/capture`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return response.json();
    }
};