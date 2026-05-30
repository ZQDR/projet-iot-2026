const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../config/db');
const mqttService = require('../services/mqttService');

// Initialisation de l'API Google Gemini (Si la clé est absente, on passe en mode hors-ligne)
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

exports.handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: "Message manquant." });
        }

        // --- 1. RÉCUPÉRATION DU CONTEXTE (RAG) ---
        // On récupère l'état exact du système à la seconde près pour informer l'IA
        const [plugs] = await db.execute('SELECT id, status, state, voltage, last_index FROM plugs');
        const [users] = await db.execute('SELECT COUNT(*) as total_users, SUM(balance) as total_money FROM users');
        const [activeSessions] = await db.execute('SELECT COUNT(*) as active FROM consumption WHERE end_time IS NULL');

        // --- 1.5. MODE HORS-LIGNE (Bot local 100% Gratuit) ---
        if (!genAI) {
            const msgLower = message.toLowerCase();
            let reply = "";

            if (msgLower.includes("état") || msgLower.includes("prise") || msgLower.includes("réseau") || msgLower.includes("résumé")) {
                const libres = plugs.filter(p => p.status === 'libre').length;
                const occupees = plugs.filter(p => p.status === 'occupied').length;
                const hs = plugs.filter(p => p.status === 'hs').length;
                reply = `🔌 <b>État du parc :</b><br>- 🟢 ${libres} prises libres<br>- ⚡ ${occupees} prises en cours d'utilisation<br>- 🔴 ${hs} prises en maintenance.`;
            } 
            else if (msgLower.includes("élève") || msgLower.includes("utilisateur") || msgLower.includes("inscrit")) {
                reply = `🎓 Il y a actuellement <b>${users[0].total_users} élèves</b> inscrits dans le système.`;
            }
            else if (msgLower.includes("solde") || msgLower.includes("argent") || msgLower.includes("total") || msgLower.includes("euro")) {
                reply = `💰 Le total des soldes de tous les élèves s'élève à <b>${parseFloat(users[0].total_money || 0).toFixed(2)} €</b>.`;
            }
            else if (msgLower.includes("session") || msgLower.includes("en cours") || msgLower.includes("charge")) {
                reply = `⚡ Il y a <b>${activeSessions[0].active} session(s)</b> de charge en cours en ce moment.`;
            }
            else {
                reply = `🤖 <b>Mode Automatique</b> : Mon intelligence artificielle externe n'est pas activée.<br><br>Posez-moi des questions simples comme :<br>- <i>"Quel est l'état des prises ?"</i><br>- <i>"Combien d'élèves sont inscrits ?"</i><br>- <i>"Combien de sessions en cours ?"</i>`;
            }

            return res.json({ reply });
        }

        let systemPrompt = `Tu es "Copilote Newton", l'assistant d'administration du système de recharge "Newton Charge" du Lycée Isaac Newton.
Ton rôle est d'aider l'administrateur à superviser le système. Sois professionnel, concis et tutois l'administrateur.

Voici l'état en direct du lycée :
- Élèves inscrits : ${users[0].total_users} (Total des soldes : ${parseFloat(users[0].total_money || 0).toFixed(2)}€)
- Sessions de charge en cours : ${activeSessions[0].active}
- État des prises électriques :
`;

        plugs.forEach(p => {
            const etatElec = p.state ? 'Allumé' : 'Éteint';
            systemPrompt += `  * ${p.id} : Statut=${p.status}, Relais=${etatElec}, Tension=${p.voltage || 0}V, Index=${p.last_index || 0}Wh\n`;
        });

        systemPrompt += `\nRéponds brièvement et utilise des emojis. Si on te pose une question sur les prises, base-toi uniquement sur les données ci-dessus. Si on te demande de faire une action, dis que tu n'as pas encore les droits d'écriture pour l'instant.`;

        // --- 2. REQUÊTE À GEMINI ---
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt
        });

        const result = await model.generateContent(message);
        const responseText = result.response.text();

        // --- 3. RETOUR AU DASHBOARD ---
        res.json({ reply: responseText });

    } catch (error) {
        console.error("Erreur ChatController :", error);
        res.status(500).json({ error: "Erreur de communication avec l'IA.", reply: "Désolé, j'ai eu un problème de connexion avec mes serveurs neuraux 🧠." });
    }
};