const paypal = require('@paypal/checkout-server-sdk');

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
                    value: amount.toString()
                }
            }]
        });
        return request;
    },

    // Helper pour capturer (valider) la commande
    captureOrderRequest: (orderId) => {
        return new paypal.orders.OrdersCaptureRequest(orderId);
    }
};