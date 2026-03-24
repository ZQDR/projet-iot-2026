const { Expo } = require('expo-server-sdk');
const UserModel = require('../models/userModel');

// Création d'une nouvelle instance Expo
let expo = new Expo();

const pushService = {
    sendPushAlert: async (userId, title, messageBody) => {
        try {
            const user = await UserModel.findById(userId);
            
            if (!user || !user.expo_push_token) {
                return; // Pas de token Push pour cet utilisateur, on ignore.
            }

            const pushToken = user.expo_push_token;

            if (!Expo.isExpoPushToken(pushToken)) {
                console.error(`Token Push invalide pour l'utilisateur ${userId} : ${pushToken}`);
                return;
            }

            let messages = [{
                to: pushToken,
                sound: 'default',
                title: title || '🔌 Alerte Newton',
                body: messageBody
            }];

            let chunks = expo.chunkPushNotifications(messages);
            await expo.sendPushNotificationsAsync(chunks[0]);
        } catch (error) {
            console.error("❌ Erreur d'envoi de la Notification Push :", error);
        }
    }
};

module.exports = pushService;