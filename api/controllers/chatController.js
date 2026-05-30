const db = require('../config/db');

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

        // --- MODE LOCAL 100% GRATUIT ---
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
            reply = `🤖 <b>Mode Automatique</b> : Mon intelligence artificielle externe a été désactivée.<br><br>Posez-moi des questions simples comme :<br>- <i>"Quel est l'état des prises ?"</i><br>- <i>"Combien d'élèves sont inscrits ?"</i><br>- <i>"Combien de sessions en cours ?"</i>`;
        }

        return res.json({ reply });

    } catch (error) {
        console.error("Erreur ChatController :", error);
        res.status(500).json({ error: "Erreur de communication avec l'IA.", reply: `⚠️ Erreur locale : ${error.message}` });
    }
};