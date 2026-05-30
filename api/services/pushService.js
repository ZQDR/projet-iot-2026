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
        try {
            // On s'assure que le SDK Expo est bien chargé avant de l'utiliser
            await initExpo();
            
            const user = await UserModel.findById(userId);
            
            if (!user || !user.expo_push_token) {
                return; // Pas de token Push pour cet utilisateur, on ignore.
            }

            const pushToken = user.expo_push_token;

            if (!ExpoClass.isExpoPushToken(pushToken)) {
                console.error(`Token Push invalide pour l'utilisateur ${userId} : ${pushToken}`);
                return;
            }

            let messages = [{
                to: pushToken,
                sound: 'default',
                title: title || '🔌 Alerte Newton',
                body: messageBody,
                data: dataPayload
            }];

            let chunks = expoInstance.chunkPushNotifications(messages);
            let ticketChunk = await expoInstance.sendPushNotificationsAsync(chunks[0]);
            
            // Vérification des retours d'Expo pour nettoyer les tokens invalides
            for (let ticket of ticketChunk) {
                if (ticket.status === 'error') {
                    if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
                        console.log(`🧹 Nettoyage : Token inactif/expiré pour l'utilisateur ${userId}. Suppression en BDD.`);
                        await db.execute('UPDATE users SET expo_push_token = NULL WHERE id = ?', [userId]);
                    } else {
                        console.error(`⚠️ Erreur d'envoi Push pour l'utilisateur ${userId} :`, ticket.message);
                    }
                }
            }
        } catch (error) {
            console.error("❌ Erreur d'envoi de la Notification Push :", error);
        }
    }
};

module.exports = pushService;