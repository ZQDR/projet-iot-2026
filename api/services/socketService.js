// Fichier: services/socketService.js
const { Server } = require('socket.io');

let io = null;

module.exports = {
    // 1. Initialisation (Appelée une seule fois par index.js au démarrage)
    init: (httpServer) => {
        io = new Server(httpServer, {
            cors: {
                origin: "*", // En production, remplace "*" par l'URL de ton dashboard pour la sécurité
                methods: ["GET", "POST"]
            }
        });

        io.on('connection', (socket) => {
            console.log(`⚡ Nouveau client WebSocket connecté : ${socket.id}`);
            
            socket.on('disconnect', () => {
                console.log(`Client déconnecté : ${socket.id}`);
            });
        });
        
        console.log("✅ Service WebSocket (Socket.io) initialisé.");
    },

    // 2. Fonction pour envoyer des données à TOUT LE MONDE (Broadcast)
    // Exemple : socketService.emit('update_prise', { id: 'S1-01', state: 'ON' })
    emit: (event, data) => {
        if (io) {
            io.emit(event, data);
        } else {
            console.error("❌ Erreur : Socket.io n'est pas encore initialisé !");
        }
    }
};