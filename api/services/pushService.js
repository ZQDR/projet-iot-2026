const UserModel = require('../models/userModel');

// Chargement différé et dynamique de expo-server-sdk (Module ES)
let ExpoClass = null;
let expoInstance = null;

const initExpo = async () => {
    if (!ExpoClass) {
        const expoModule = await import('expo-server-sdk');
        ExpoClass = expoModule.Expo;
        expoInstance = new ExpoClass();
    }
};

const pushService = {
    sendPushAlert: async (userId, title, messageBody) => {
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
                body: messageBody
            }];

            let chunks = expoInstance.chunkPushNotifications(messages);
            await expoInstance.sendPushNotificationsAsync(chunks[0]);
        } catch (error) {
            console.error("❌ Erreur d'envoi de la Notification Push :", error);
        }
    }
};

module.exports = pushService;