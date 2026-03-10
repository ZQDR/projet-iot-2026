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


socketService.init(server);
mqttService.connect(); 

app.use('/api/auth', require('./routes/auth'));
app.use('/api/plugs', require('./routes/plugs'));
app.use('/api/consumption', require('./routes/consumption'));
app.use('/api/payments', require('./routes/paymentRoutes'));

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