const db = require('../config/db');
const Groq = require('groq-sdk');

// Initialisation de l'API Groq (Vraie IA 100% gratuite, sans CB)
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

exports.handleChat = async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: "Message manquant." });
        }

        // --- RÉCUPÉRATION DU CONTEXTE LOCAL ---
        const [plugs] = await db.execute('SELECT id, status, state, voltage, last_index FROM plugs');
        const [users] = await db.execute('SELECT COUNT(*) as total_users, SUM(balance) as total_money FROM users');
        const [activeSessions] = await db.execute('SELECT COUNT(*) as active FROM consumption WHERE end_time IS NULL');

        // --- MODE LOCAL DE SECOURS (Si pas de clé) ---
        if (!groq) {
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
                reply = `🤖 <b>Mode Local</b> : Pas de clé API configurée.<br><br>Posez-moi des questions simples comme :<br>- <i>"Quel est l'état des prises ?"</i>`;
            }
            return res.json({ reply });
        }

        // --- VRAIE INTELLIGENCE ARTIFICIELLE (GROQ / LLAMA 3) ---
        let systemPrompt = `Tu es "Copilote Newton", l'assistant IA d'administration de "Newton Charge". Tu réponds de manière brève, professionnelle et tu tutois l'admin.\n\nÉtat actuel:\n- Élèves: ${users[0].total_users}\n- Sessions: ${activeSessions[0].active}\n- Prises:\n`;
        
        plugs.forEach(p => {
            const etatElec = p.state ? 'Allumé' : 'Éteint';
            systemPrompt += `  * ${p.id} : Statut=${p.status}, Relais=${etatElec}\n`;
        });

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            model: "llama3-8b-8192", // Modèle ultra-rapide et gratuit
        });

        return res.json({ reply: chatCompletion.choices[0].message.content });

    } catch (error) {
        console.error("Erreur ChatController :", error);
        res.status(500).json({ error: "Erreur de communication avec l'IA.", reply: `⚠️ Erreur locale : ${error.message}` });
    }
};