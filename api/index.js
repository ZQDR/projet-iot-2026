const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
require('dotenv').config(); // Pour lire le fichier .env

const app = express();
const port = 3000;

// --- STRUCTURE DE DONNÉES POUR LA CONSOMMATION ---
const plugsData = {}; 

// Création du serveur HTTP pour supporter à la fois Express et Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Autorise les connexions de n'importe où (Dashboards)
        methods: ["GET", "POST"]
    }
});

// Configuration HiveMQ (Utilise les variables d'environnement si présentes)
const options = {
    host: process.env.HIVEMQ_HOST || '8487c77b02c844dbb8bf01681e09f417.s1.eu.hivemq.cloud',
    port: 8883,
    protocol: 'mqtts',
    username: process.env.HIVEMQ_USER || 'etudiant',
    password: process.env.HIVEMQ_PASS || 'Api_client2026',
};

app.use(express.json());
app.use(cors());

// --- ROUTES API ---

app.get('/', (req, res) => {
    res.json({ 
        message: 'Bienvenue sur ton API !',
        status: 'OK',
        websocket_clients: io.engine.clientsCount 
    });
});

// Nouvelle route pour consulter la consommation de toutes les prises
app.get('/consumption', (req, res) => {
    if (Object.keys(plugsData).length === 0) {
        return res.json({ message: "Aucune donnée de prise reçue pour le moment." });
    }
    res.json(plugsData);
});

app.get('/utilisateurs/:id', (req, res) => {
    // Petit calcul pour la physique appliquée (cosinus)
    const val = Math.cos(parseInt(req.params.id));
    res.json({ input: req.params.id, calcul: val, nom: 'Utilisateur Test' });
});

app.post('/data', (req, res) => {
    const donneesRecues = req.body;
    res.status(201).json({
        message: 'Données reçues avec succès',
        data: donneesRecues
    });
});

// --- CONFIGURATION MQTT ---

const client = mqtt.connect(options);

client.on('connect', function () {
    console.log('✅ Connecté au broker HiveMQ !');
    client.subscribe('Shellies/#', function (err) {
        if (!err) {
            console.log('📡 Abonné aux flux Shelly (Shellies/#)');
        }
    });
});

client.on('message', function (topic, message) {
    const payload = message.toString();
    const now = Date.now();
    
    // Extraction de l'identifiant de la prise (ex: shellies/shellyplug-s-1234/relay/0/power)
    const topicParts = topic.split('/');
    const plugId = topicParts[1] || 'unknown_plug';

    // Initialisation des données si c'est la première fois qu'on voit cette prise
    if (!plugsData[plugId]) {
        plugsData[plugId] = { 
            power: 0, 
            energyWh: 0, 
            lastUpdate: now,
            lastTopic: topic 
        };
    }

    // --- LOGIQUE DE CALCUL D'ÉNERGIE (PHYSIQUE APPLIQUÉE) ---
    if (topic.toLowerCase().includes('power')) {
        const currentPower = parseFloat(payload);
        const timeDeltaHours = (now - plugsData[plugId].lastUpdate) / 3600000; // ms vers heures

        // E = P * t (L'énergie ajoutée est basée sur la puissance précédente durant l'intervalle)
        if (timeDeltaHours > 0 && plugsData[plugId].power > 0) {
            const addedEnergy = plugsData[plugId].power * timeDeltaHours;
            plugsData[plugId].energyWh += addedEnergy;
        }

        plugsData[plugId].power = currentPower;
        plugsData[plugId].lastUpdate = now;
    }

    plugsData[plugId].lastTopic = topic;

    // --- TRANSFERT VERS WEBSOCKET (Temps Réel) ---
    io.emit('iot_data', {
        plugId: plugId,
        topic: topic,
        value: payload,
        energy: plugsData[plugId].energyWh.toFixed(4), // On renvoie l'énergie calculée
        time: new Date().toLocaleTimeString()
    });
});

client.on('error', (err) => {
    console.error('❌ Erreur MQTT :', err);
});

// --- GESTION WEBSOCKETS ---

io.on('connection', (socket) => {
    console.log(`🔌 Nouveau dashboard connecté : ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log('❌ Un dashboard s\'est déconnecté');
    });
});

// --- LANCEMENT DU SERVEUR ---
server.listen(port, '0.0.0.0', () => {
    console.log(`🚀 API en ligne sur le port ${port}`);
    console.log(`🌍 Prêt à recevoir des requêtes de Nginx`);
});