const UserModel = require('../models/userModel');
const db = require('../config/db');

// Chargement différé et dynamique de expo-server-sdk (Module ES)
let ExpoClass = null;
let expoInstance = null;

const initExpo = async () => {
    if (!ExpoClass) {
        // Polyfill pour Node.js 18 : expo-server-sdk utilise 'undici' qui nécessite la classe 'File'
        if (!globalThis.File) {
            globalThis.File = require('node:buffer').File;
        }

        const expoModule = await import('expo-server-sdk');
        ExpoClass = expoModule.Expo;
        expoInstance = new ExpoClass();
    }
};

const pushService = {
    sendPushAlert: async (userId, title, messageBody, dataPayload = {}) => {
        console.log(`\n[PushService] 🔔 Début de l'envoi pour l'utilisateur ${userId}...`);
        try {
            // On s'assure que le SDK Expo est bien chargé avant de l'utiliser
            await initExpo();
            
            const user = await UserModel.findById(userId);
            
            if (!user || !user.expo_push_token) {
                console.log(`[PushService] ⚠️ Annulé : L'utilisateur ${userId} n'a pas de token Push enregistré en BDD.`);
                return; // Pas de token Push pour cet utilisateur, on ignore.
            }

            const pushToken = user.expo_push_token;

            if (!ExpoClass.isExpoPushToken(pushToken)) {
                console.error(`[PushService] ❌ Token Push invalide pour l'utilisateur ${userId} : ${pushToken}`);
                return;
            }

            let messages = [{
                to: pushToken,
                sound: 'default',
                title: title || '🔌 Alerte Newton',
                body: messageBody,
                data: dataPayload
            }];
            
            console.log(`[PushService] 📤 Envoi de la requête aux serveurs Expo pour le token ${pushToken}...`);

            let chunks = expoInstance.chunkPushNotifications(messages);
            let ticketChunk = await expoInstance.sendPushNotificationsAsync(chunks[0]);
            
            console.log(`[PushService] 📥 Réponse d'Expo reçue :`, JSON.stringify(ticketChunk, null, 2));

            // Vérification des retours d'Expo pour nettoyer les tokens invalides
            for (let ticket of ticketChunk) {
                if (ticket.status === 'error') {
                    if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                        console.log(`[PushService] 🧹 Nettoyage : Token inactif/expiré pour l'utilisateur ${userId}. Suppression en BDD.`);
                        await db.execute('UPDATE users SET expo_push_token = NULL WHERE id = ?', [userId]);
                    } else {
                        console.error(`[PushService] ⚠️ Erreur d'envoi Push pour l'utilisateur ${userId} :`, ticket.message);
                    }
                } else if (ticket.status === 'ok') {
                    console.log(`[PushService] ✅ Succès ! Notification envoyée à l'utilisateur ${userId}. Ticket ID: ${ticket.id}`);
                }
            }
        } catch (error) {
            console.error("[PushService] ❌ Erreur fatale lors de l'envoi de la Notification Push :", error);
        }
    }
};

module.exports = pushService;