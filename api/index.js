const express = require('express');
const app = express();
const port = 3000;

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