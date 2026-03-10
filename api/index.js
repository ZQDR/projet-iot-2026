require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');


const db = require('./config/db');            
const mqttService = require('./services/mqttService'); 
const socketService = require('./services/socketService');


const app = express();
const server = http.createServer(app); 
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());


// Fonction d'attente de la BDD
const waitForDb = async () => {
    let retries = 30; // 30 tentatives * 2s = 60 secondes max
    while (retries > 0) {
        try {
            await db.execute('SELECT 1');
            console.log('✅ Base de données connectée !');
            return;
        } catch (err) {
            console.log(`⏳ Base de données indisponible (${err.message}). Nouvelle tentative dans 2s...`);
            retries--;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
    console.error('❌ Impossible de se connecter à la BDD après plusieurs tentatives.');
    process.exit(1);
};

// Démarrage asynchrone
(async () => {
    await waitForDb();

    socketService.init(server);
    mqttService.connect(); 

    app.use('/auth', require('./routes/auth'));
    app.use('/plugs', require('./routes/plugs'));
    app.use('/consumption', require('./routes/consumption'));
    app.use('/payments', require('./routes/paymentRoutes'));

    app.get('/', (req, res) => {
        res.json({ 
            message: 'API Projet Location Prise 2026 - En ligne', 
            status: 'OK',
            timestamp: new Date()
        });
    });

    server.listen(port, '0.0.0.0', () => {
        console.log(`🚀 API Master lancée sur le port ${port}`);
        console.log(`🌍 Prêt à recevoir des requêtes (Reverse Proxy Nginx actif)`);
    });
})();