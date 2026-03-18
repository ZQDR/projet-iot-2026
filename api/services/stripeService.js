// Fichier: api/services/stripeService.js
const Stripe = require('stripe');

// On initialise Stripe uniquement si la clé secrète est présente dans le .env
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

if (!stripe) {
    console.error("\n⚠️  ATTENTION : La clé STRIPE_SECRET_KEY n'est pas définie dans le fichier .env ! Le paiement par carte ne fonctionnera pas.\n");
}

module.exports = stripe;