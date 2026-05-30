const nodemailer = require('nodemailer');

// Configuration du transporteur SMTP
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true pour 465, false pour les autres (587)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const emailService = {
    sendWelcomeEmail: async (email, username, initialBalance) => {
        try {
            // Si la configuration SMTP n'est pas remplie dans le .env, on simule l'envoi (pour éviter de planter)
            if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
                console.warn(`[Email] ⚠️ Identifiants SMTP manquants dans le .env. Simulation de l'email pour ${email}`);
                return true;
            }

            const mailOptions = {
                from: `"Newton Charge" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to: email,
                subject: '🎉 Votre compte Newton Charge a été validé !',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                        <h2 style="color: #3498db; text-align: center;">Bienvenue sur Newton Charge ! ⚡</h2>
                        <p>Bonjour <b>${username}</b>,</p>
                        <p>Bonne nouvelle ! Votre demande d'inscription a été validée par un administrateur du Lycée Isaac Newton.</p>
                        <p>Votre compte a été crédité d'un solde initial de <b>${parseFloat(initialBalance).toFixed(2)} €</b>.</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://recharge.cielnewton.fr" style="background-color: #27ae60; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Accéder à mon tableau de bord</a>
                        </div>
                        <p>Vous pouvez dès à présent vous connecter et utiliser les prises du lycée.</p>
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 0.8em; color: #7f8c8d; text-align: center;">Ceci est un message automatique, merci de ne pas y répondre.</p>
                    </div>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`[Email] ✅ Email de bienvenue envoyé à ${email} (Message ID: ${info.messageId})`);
            return true;
        } catch (error) {
            console.error(`[Email] ❌ Erreur lors de l'envoi de l'email à ${email} :`, error);
            return false;
        }
    }
};

module.exports = emailService;