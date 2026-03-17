require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');

// Services
const socketService = require('./services/socketService');
const mqttService = require('./services/mqttService');

// Routes
const authRoutes = require('./routes/auth');
const plugRoutes = require('./routes/plugs');
const consumptionRoutes = require('./routes/consumption');
const paymentRoutes = require('./routes/paymentRoutes'); // <-- C'est ici qu'on ajoute le paiement

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: '*', // En production, remplace par ton domaine (ex: https://dashboard.cielnewton.fr)
    methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
app.use(express.json());

// Initialisation des Services
socketService.init(server); // Démarrage WebSocket
mqttService.connect();      // Connexion au broker MQTT HiveMQ

// Montage des Routes
// CORRECTION CRITIQUE : On écoute sur les deux chemins (avec et sans /api) car le proxy supprime le préf
app.use(['/api/auth', '/auth'], authRoutes);
app.use(['/api/plugs', '/plugs'], plugRoutes);
app.use(['/api/consumption', '/consumption'], consumptionRoutes);
app.use(['/api/payment', '/payment'], paymentRoutes);

// Route de test (Ping)
app.get('/', (req, res) => {
    res.send('API Lycée Newton - En ligne 🚀');
});

// Gestion des erreurs globale
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Une erreur interne est survenue !' });
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(`🚀 Serveur API démarré sur le port ${PORT}`);
    console.log(`==========================================`);
});