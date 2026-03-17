class PriseManager {

    constructor(apiUrl, userManager) {
        this.apiUrl = apiUrl;
        this.userManager = userManager; // Pour récupérer le token
        this.prises = []
        this.tableBody = document.getElementById("priseTableBody")
        this.btnAddPrise = document.getElementById("btnAddPrise")
        this.btnDeletePrise = document.getElementById("btnDeletePrise")
        this.selectedPrise = null
        this.init()
        this.initSocket() // Démarrage des WebSockets
    }

    init() {

        this.btnAddPrise.addEventListener("click", () => {
            const nom = prompt("Identifiant de la prise (ex: S1-01)")
            if (nom) {
                this.addPrise(nom)
            }
        })

        // Gestion du bouton Supprimer
        if (this.btnDeletePrise) {
            this.btnDeletePrise.addEventListener("click", () => {
                if (this.selectedPrise) {
                    this.deletePrise(this.selectedPrise);
                } else {
                    alert("Veuillez sélectionner une prise dans la liste.");
                }
            });
        }

        this.loadPrises()
    }

    // --- GESTION WEBSOCKETS (Temps réel) ---
    initSocket() {
        // On suppose que socket.io est chargé globalement via le script HTML
        if (typeof io !== 'undefined') {
            // Connexion à la racine du serveur (là où tourne l'API)
            const socketUrl = this.apiUrl.replace('/api', ''); 
            this.socket = io(socketUrl, {
                path: "/api/socket.io" // On se connecte au chemin spécifique
            });

            console.log("📡 Initialisation WebSocket sur", socketUrl);
            
            // DEBUG : Vérifier la connexion
            this.socket.on('connect', () => console.log("✅ WebSocket connecté avec ID:", this.socket.id));
            this.socket.on('connect_error', (err) => console.error("❌ Erreur connexion WebSocket:", err));

            // 1. Mise à jour de la puissance ou de l'état
            this.socket.on('power_update', (data) => this.updateRowUI(data.plugId, { power: data.power }));
            this.socket.on('state_update', (data) => this.updateRowUI(data.plugId, { state: data.state }));
            this.socket.on('status_update', (data) => {
                // --- TEST DE DÉBOGAGE DÉFINITIF ---
                // Si cette alerte s'affiche, la communication est BONNE.
                alert(`TEST: Événement 'status_update' reçu pour ${data.plugId} -> nouveau statut : ${data.status}`);
                this.updateRowUI(data.plugId, { status: data.status });
            });
            
            // 1.5 Rafraîchissement des données utilisateur (solde)
            this.socket.on('user_data_updated', () => {
                if (this.userManager) {
                    this.userManager.fetchAllUsers();
                }
            });
            
            // 2. Nouvelle prise détectée
            this.socket.on('new_plug_added', () => {
                console.log("Nouvelle prise détectée, rechargement...");
                this.loadPrises();
            });
        } else {
            console.warn("Socket.io non chargé. Le temps réel est désactivé.");
        }
    }

    // Met à jour une ligne spécifique sans tout recharger
    updateRowUI(plugId, data) {
        const row = document.getElementById(`row-${plugId}`);
        if (row) {
            const cellState = row.querySelector(".state-cell");
            
            // 1. Mise à jour des données en mémoire (data-attributes)
            if (data.state !== undefined) row.dataset.state = data.state;
            if (data.power !== undefined) row.dataset.power = data.power;
            if (data.status !== undefined) row.dataset.status = data.status;

            // 2. Récupération de l'état actuel pour affichage
            // CORRECTION CRITIQUE : MySQL renvoie 1/0, le WebSocket renvoie true/false.
            const rawState = row.dataset.state;
            const currentState = rawState === "true" || rawState === true || rawState === "1" || rawState == 1;
            const currentPower = row.dataset.power || 0;
            
            if (cellState) {
                // 3. Construction du texte d'état
                const textState = currentState ? "⚡ ON" : "OFF";
                const currentStatus = row.dataset.status || "Inconnu";
                
                let displayText = `${currentStatus} (${textState})`;

                // Si c'est allumé et qu'on a de la puissance, on l'affiche
                if (currentState && currentPower > 0) {
                    displayText += ` - ${currentPower} W`;
                }

                cellState.textContent = displayText;
                
                // Changement de couleur dynamique
                cellState.style.color = currentState ? "#27ae60" : "#7f8c8d";
                cellState.style.fontWeight = currentState ? "bold" : "normal";
            }
        }
    }

    async loadPrises() {
        // S'assurer qu'on est connecté avant de charger les prises (Route protégée)
        if (!this.userManager.token) {
            const logged = await this.userManager.loginAdmin();
            if (!logged) return; // Si l'utilisateur annule, on arrête
        }

        try {
            // ROUTE API : RECUPERER LES PRISES
            const response = await fetch(`${this.apiUrl}/plugs`, {
                headers: {
                    "Authorization": `Bearer ${this.userManager.token}`
                }
            })
            const data = await response.json()
            
            if (Array.isArray(data)) {
                this.prises = data
                this.render()
            } else {
                console.error("Format de données invalide reçu pour les prises:", data);
            }
        } catch (error) {
            console.error("Erreur chargement prises :", error)
        }
    }

    async addPrise(nom) {
        // On s'assure d'être connecté
        if (!this.userManager.token) await this.userManager.loginAdmin();

        try {
            // ROUTE API : AJOUTER UNE PRISE
            const response = await fetch(`${this.apiUrl}/plugs`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.userManager.token}`
                },
                // L'API attend "plugId"
                body: JSON.stringify({ plugId: nom })
            })

            if (response.ok) {
                alert("Prise ajoutée !");
                this.loadPrises(); // Recharger la liste
            } else {
                alert("Erreur lors de l'ajout (ID déjà existant ?)");
            }
        } catch (error) {
            console.error("Erreur ajout prise :", error)
        }
    }

    async deletePrise(plugId) {
        if (!confirm(`Voulez-vous vraiment supprimer la prise ${plugId} ?`)) return;

        // On s'assure d'être connecté
        if (!this.userManager.token) await this.userManager.loginAdmin();

        try {
            const response = await fetch(`${this.apiUrl}/plugs/${plugId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${this.userManager.token}` }
            });

            const data = await response.json();
            if (response.ok) {
                this.selectedPrise = null; // Reset sélection
                this.loadPrises(); // Recharger la liste
            } else {
                alert("Erreur : " + (data.error || "Impossible de supprimer."));
            }
        } catch (error) {
            console.error("Erreur suppression prise :", error);
        }
    }

    render() {
        this.tableBody.innerHTML = ""

        this.prises.forEach(prise => {

            const tr = document.createElement("tr")
            // Ajout d'un ID unique et de data-attributes pour le WebSocket
            tr.id = `row-${prise.id}`;
            tr.dataset.status = prise.status;
            tr.dataset.state = prise.state; // Pour le suivi WebSocket
            tr.dataset.power = 0; // Init à 0

            // Gestion de la sélection (Click sur la ligne)
            tr.style.cursor = "pointer";
            tr.addEventListener("click", () => {
                // Retirer la surbrillance des autres
                document.querySelectorAll("#priseTableBody tr").forEach(row => row.style.backgroundColor = "");
                // Sélectionner celle-ci
                tr.style.backgroundColor = "#d0eaff";
                this.selectedPrise = prise.id;
            });

            // Colonne ID
            const tdNom = document.createElement("td")
            tdNom.textContent = prise.id

            // Colonne État
            const tdEtat = document.createElement("td")
            tdEtat.className = "state-cell"; // Classe pour ciblage facile
            // On affiche le status (libre/occupied) et l'état électrique (ON/OFF)
            const elecState = prise.state ? "⚡ ON" : "OFF";
            tdEtat.textContent = `${prise.status} (${elecState})`;
            
            if(prise.state) {
                tdEtat.style.color = "#27ae60";
                tdEtat.style.fontWeight = "bold";
            }
            
            // Colonne Actions (QR Code)
            const tdAction = document.createElement("td")
            const btnQr = document.createElement("button")
            btnQr.textContent = "🖨️ QR";
            btnQr.className = "btn-qr"; // Pour le CSS si besoin
            btnQr.onclick = (e) => {
                e.stopPropagation();
                // Ouvre une fenêtre d'impression propre avec le QR Code
                const url = `${this.apiUrl}/plugs/${prise.id}/qrcode`;
                const printWindow = window.open('', '_blank', 'width=500,height=600');
                if (printWindow) {
                    printWindow.document.write(`
                        <html>
                            <head><title>QR Code - ${prise.id}</title></head>
                            <body style="text-align:center; font-family:sans-serif; margin-top:50px;">
                                <h1>Prise : ${prise.id}</h1>
                                <img src="${url}" style="width:300px; height:300px; border:2px solid #333;" onload="window.print();">
                                <p>Scannez ce code pour démarrer la recharge.</p>
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                }
            };
            tdAction.appendChild(btnQr);

            tr.appendChild(tdNom)
            tr.appendChild(tdEtat)
            tr.appendChild(tdAction)

            this.tableBody.appendChild(tr)
        })
    }
}

//instanciation
document.addEventListener("DOMContentLoaded", () => {
    // On passe l'URL et l'instance userManager existante (créée dans UserManager.js)
    // Assure-toi que userManager est accessible globalement ou passé ici
    if (typeof userManager !== 'undefined') {
        new PriseManager("https://recharge.cielnewton.fr/api", userManager);
    } else {
        console.error("UserManager non trouvé. L'ordre des scripts dans index.html est important.");
    }
})