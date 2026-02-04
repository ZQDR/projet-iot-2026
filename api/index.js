const express = require('express');
const app = express();
const port = 3000;
const mqtt = require('mqtt');

const options = {
    host: '8487c77b02c844dbb8bf01681e09f417.s1.eu.hivemq.cloud', // Ton adresse (copiée de ton image)
    port: 8883,
    protocol: 'mqtts', // Le 's' est CRUCIAL (signifie Sécurisé/SSL), sinon ça ne marchera pas
    username: 'etudiant', // ex: 'etudiant'
    password: 'Api_client2026',  // Le mot de passe que tu as créé
};

// Middleware pour pouvoir lire le JSON entrant (req.body)
app.use(express.json());

// Route GET de base (Accueil)
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur ton API !' });
});

// Route GET avec un paramètre dynamique
app.get('/utilisateurs/:id', (req, res) => {
  const id = Math.cos(parseInt(req.params.id));
  res.json({ id: id, nom: 'Utilisateur Test' });
});

// Route POST (pour recevoir des données)
app.post('/data', (req, res) => {
  const donneesRecues = req.body;
  res.status(201).json({
    message: 'Données reçues avec succès',
    data: donneesRecues
  });
});

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});

const client = mqtt.connect(options);

client.on('connect', function () {
    console.log('✅ Connecté au broker !');
   client.subscribe('#', function (err) {
        if (!err) {
          
        }
    });
});

client.on('message', function (topic, message) {

    console.log(`📩 Message reçu : ${message.toString()}`);
});