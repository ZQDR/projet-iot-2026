const paypal = require('@paypal/checkout-server-sdk');

// Vérification de sécurité au démarrage
if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    console.error("\n⚠️  ATTENTION : Les identifiants PayPal (CLIENT_ID / SECRET) ne sont pas définis dans le fichier .env ! Le paiement ne fonctionnera pas.\n");
}

// Configuration de l'environnement (Sandbox pour les tests, Live pour la vraie vie)
const environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID,
    process.env.PAYPAL_CLIENT_SECRET
);
const client = new paypal.core.PayPalHttpClient(environment);

module.exports = {
    client,
    
    // Helper pour créer une requête de commande standard
    createOrderRequest: (amount) => {
        const request = new paypal.orders.OrdersCreateRequest();
        request.prefer("return=representation");
        request.requestBody({
            intent: 'CAPTURE',
            purchase_units: [{
                amount: {
                    currency_code: 'EUR',
                    value: parseFloat(amount).toFixed(2)
                }
            }]
        });
        return request;
    },

    // Helper pour capturer (valider) la commande
    captureOrderRequest: (orderId) => {
        const request = new paypal.orders.OrdersCaptureRequest(orderId);
        request.requestBody({});
        return request;
    }
};