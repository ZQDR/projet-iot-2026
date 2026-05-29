/**
 * SCRIPT DE TEST AUTONOME POUR L'API
 * -----------------------------------
 * Ce script simule un client (comme ton frontend ou ton application mobile).
 * Il fait de vraies requêtes HTTP vers ton API en cours d'exécution.
 * 
 * Utilisation : node test-api.js
 */

const API_URL = 'https://recharge.cielnewton.fr/api'; // Modifie le port si ton API tourne sur un autre

// ⚠️ Remplace par des identifiants valides présents dans ta base de données MySQL
const TEST_USER = {
    email: 'testprod@gmail.com',
    password: 'admin123'
};

async function runTests() {
    console.log("🚀 Lancement des tests de l'API...\n");
    
    let token = "";

    // ==========================================
    // TEST 1 : Authentification (Login)
    // ==========================================
    try {
        console.log(`➡️ TEST 1 : Authentification avec ${TEST_USER.email}`);
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        
        const loginData = await loginRes.json();
        
        if (loginRes.ok) {
            console.log("  ✅ Succès: Utilisateur connecté !");
            console.log(`  👤 ID: ${loginData.user.id} | Solde: ${loginData.user.balance}€`);
            token = loginData.token;
        } else {
            console.error("  ❌ Échec:", loginData.error);
            console.log("  💡 Astuce : Assure-toi que cet utilisateur existe dans ta base de données avec ce mot de passe.");
            return; // On arrête les tests si on n'a pas de token
        }
    } catch (e) {
        console.error("  ❌ Erreur réseau :", e.message);
        console.log("  💡 Astuce : Vérifie que ton serveur API est bien lancé (ex: npm start).");
        return;
    }

    // ==========================================
    // TEST 2 : Récupérer les prises (Protégé)
    // ==========================================
    if (token) {
        console.log("\n➡️ TEST 2 : Récupération des prises (Route protégée par Token)");
        try {
            const plugsRes = await fetch(`${API_URL}/plugs`, {
                method: 'GET',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (plugsRes.ok) {
                const plugsData = await plugsRes.json();
                console.log(`  ✅ Succès: ${plugsData.length} prises récupérées.`);
            } else {
                const errorData = await plugsRes.json();
                console.error("  ❌ Échec:", errorData.error || 'Erreur inconnue');
            }
        } catch (e) {
            console.error("  ❌ Erreur lors de la requête :", e.message);
        }
    }
    
    console.log("\n🏁 Fin des tests.");
}

runTests();