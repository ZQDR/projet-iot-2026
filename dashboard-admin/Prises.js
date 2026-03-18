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

        this.btnAddPrise.addEventListener("click", async () => {
            const { value: nom } = await Swal.fire({
                title: 'Ajouter une prise',
                input: 'text',
                inputLabel: 'Identifiant de la prise (ex: S1-01)',
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value) return 'Veuillez entrer un identifiant !'
                }
            });
            if (nom) {
                this.addPrise(nom);
            }
        })

        // Gestion du bouton Supprimer
        if (this.btnDeletePrise) {
            this.btnDeletePrise.addEventListener("click", () => {
                if (this.selectedPrise) {
                    this.deletePrise(this.selectedPrise);
                } else {
                    Swal.fire('Attention', 'Veuillez sélectionner une prise dans la liste.', 'warning');
                }
            });
        }

        this.loadPrises()
    }

    // --- GESTION WEBSOCKETS (Temps réel) ---
    initSocket() {
        // On suppose que socket.io est chargé globalement via le script HTML
        if (typeof io !== 'undefined') {
            if (!window.appSocket) {
                const socketUrl = this.apiUrl.replace('/api', '');
                window.appSocket = io(socketUrl, { path: "/api/socket.io", transports: ['websocket', 'polling'] });
            }
            this.socket = window.appSocket;

            console.log("📡 Écoute WebSocket initialisée pour les prises");
            
            // DEBUG : Vérifier la connexion
            this.socket.on('connect', () => console.log("✅ WebSocket connecté avec ID:", this.socket.id));
            this.socket.on('connect_error', (err) => console.error("❌ Erreur connexion WebSocket:", err));

            // 📡 ÉCOUTE ABSOLUE : Affiche TOUS les messages reçus du serveur
            this.socket.onAny((eventName, ...args) => {
                console.log(`📥 [SOCKET REÇU] Événement: ${eventName}`, args);
            });

            // 1. Mise à jour de la puissance ou de l'état
            this.socket.on('power_update', (data) => this.updateRowUI(data.plugId, { power: data.power }));
            this.socket.on('state_update', (data) => this.updateRowUI(data.plugId, { state: data.state }));
            this.socket.on('status_update', (data) => {
                this.updateRowUI(data.plugId, { status: data.status, username: data.username });
            });

            // 1.5. Afficher la consommation en direct sur la ligne de la prise
            this.socket.on('live_consumption', (data) => {
                this.updateRowUI(data.plugId, { energyWh: data.energyWh, cost: data.cost, username: data.username });
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
            if (data.energyWh !== undefined) row.dataset.energyWh = data.energyWh;
            if (data.cost !== undefined) row.dataset.cost = data.cost;
            if (data.username !== undefined) row.dataset.username = data.username;

            // Réinitialiser l'énergie et le coût si la prise redevient libre ou en maintenance
            if (data.status === 'libre' || data.status === 'hs') {
                row.dataset.energyWh = 0;
                row.dataset.cost = 0;
                row.dataset.username = "";
            }

            // 2. Récupération de l'état actuel pour affichage
            // CORRECTION CRITIQUE : MySQL renvoie 1/0, le WebSocket renvoie true/false.
            const rawState = row.dataset.state;
            const currentState = rawState === "true" || rawState === true || rawState === "1" || rawState == 1;
            const currentPower = row.dataset.power || 0;
            const currentEnergy = parseFloat(row.dataset.energyWh) || 0;
            const currentCost = parseFloat(row.dataset.cost) || 0;
            const currentUsername = row.dataset.username || "";
            
            if (cellState) {
                // 3. Construction du texte d'état
                const textState = currentState ? "⚡ ALLUMÉE" : "ÉTEINTE";
                const rawStatus = row.dataset.status || "Inconnu";
                
                // Traduction propre pour l'affichage
                let displayStatus = rawStatus === 'occupied' ? "Occupée" : (rawStatus === 'libre' ? "Libre" : (rawStatus === 'hs' ? "🔴 Maintenance" : rawStatus));
                if (rawStatus === 'occupied' && currentUsername) {
                    displayStatus = `Occupée par ${currentUsername}`;
                }
                
                let displayText = `${displayStatus} (${textState})`;

                // Si c'est allumé et qu'on a de la puissance, on l'affiche
                if (currentState && currentPower > 0) {
                    displayText += ` - ${currentPower} W`;
                }
                
                // Si la prise est occupée, on ajoute l'énergie et le coût accumulés
                if (rawStatus === 'occupied' && currentEnergy > 0) {
                    displayText += ` | 📈 ${currentEnergy.toFixed(1)} Wh | 💰 ${currentCost.toFixed(2)} €`;
                }

                cellState.textContent = displayText;
                
                // Changement de couleur dynamique
                cellState.style.color = currentState ? "#27ae60" : "#7f8c8d";
                cellState.style.fontWeight = currentState ? "bold" : "normal";

                // Mise à jour de l'icône/texte du bouton maintenance
                const btnMaint = row.querySelector(".btn-maint");
                if (btnMaint) {
                    btnMaint.textContent = rawStatus === 'hs' ? "✅ Rétablir" : "🔧 Maint.";
                }

                // Mise à jour de la visibilité du bouton Stop
                const btnStop = row.querySelector(".btn-stop");
                if (btnStop) {
                    btnStop.style.display = rawStatus === 'occupied' ? "inline-block" : "none";
                }
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
                Swal.fire('Succès !', 'Prise ajoutée !', 'success');
                this.loadPrises(); // Recharger la liste
            } else {
                Swal.fire('Erreur', "Erreur lors de l'ajout (ID déjà existant ?)", 'error');
            }
        } catch (error) {
            console.error("Erreur ajout prise :", error)
        }
    }

    async toggleMaintenance(plugId) {
        if (!this.userManager.token) {
            const logged = await this.userManager.loginAdmin();
            if (!logged) return;
        }

        try {
            // Ajout d'un visuel de chargement pendant la requête
            Swal.fire({
                title: 'Changement d\'état...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`${this.apiUrl}/plugs/${plugId}/maintenance`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.userManager.token}` }
            });

            if (response.ok) {
                Swal.close(); // Succès : l'UI sera mise à jour via le WebSocket
            } else {
                // Sécurisation : si la réponse n'est pas du JSON (ex: erreur 404)
                const data = await response.json().catch(() => ({})); 
                Swal.fire('Erreur', data.error || `Erreur serveur (${response.status}). La route API existe-t-elle ?`, 'error');
            }
        } catch (error) {
            console.error("Erreur maintenance :", error);
            Swal.fire('Erreur réseau', "Impossible de joindre le serveur.", 'error');
        }
    }

    async forceStop(plugId) {
        const result = await Swal.fire({
            title: 'Forcer l\'arrêt ?',
            text: `Voulez-vous vraiment arrêter la session sur la prise ${plugId} ? L'utilisateur en cours sera facturé.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Oui, arrêter'
        });

        if (!result.isConfirmed) return;

        if (!this.userManager.token) {
            const logged = await this.userManager.loginAdmin();
            if (!logged) return;
        }

        try {
            Swal.fire({
                title: 'Arrêt en cours...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const response = await fetch(`${this.apiUrl}/plugs/${plugId}/force-stop`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${this.userManager.token}` }
            });

            if (response.ok) {
                Swal.fire('Succès !', 'La session a été arrêtée proprement.', 'success');
            } else {
                const data = await response.json().catch(() => ({})); 
                Swal.fire('Erreur', data.error || `Erreur serveur (${response.status}).`, 'error');
            }
        } catch (error) {
            console.error("Erreur force-stop :", error);
            Swal.fire('Erreur réseau', "Impossible de joindre le serveur.", 'error');
        }
    }

    async deletePrise(plugId) {
        const result = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: `Voulez-vous vraiment supprimer la prise ${plugId} ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Oui, supprimer'
        });
        if (!result.isConfirmed) return;

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
                Swal.fire('Erreur', data.error || "Impossible de supprimer.", 'error');
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
            tr.dataset.energyWh = 0;
            tr.dataset.cost = 0;
            tr.dataset.username = prise.username || "";

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
            // On affiche le status (libre/occupied) et l'état électrique (ALLUMÉE/ÉTEINTE)
            let displayStatus = prise.status === 'occupied' ? "Occupée" : (prise.status === 'libre' ? "Libre" : (prise.status === 'hs' ? "🔴 Maintenance" : prise.status));
            if (prise.status === 'occupied' && tr.dataset.username) {
                displayStatus = `Occupée par ${tr.dataset.username}`;
            }
            const elecState = prise.state ? "⚡ ALLUMÉE" : "ÉTEINTE";
            tdEtat.textContent = `${displayStatus} (${elecState})`;
            
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
            
            // Bouton de maintenance
            const btnMaint = document.createElement("button");
            btnMaint.textContent = prise.status === 'hs' ? "✅ Rétablir" : "🔧 Maint.";
            btnMaint.className = "btn-maint"; 
            btnMaint.style.marginLeft = "10px";
            btnMaint.onclick = (e) => {
                e.stopPropagation();
                this.toggleMaintenance(prise.id);
            };
            tdAction.appendChild(btnMaint);
            
            // Bouton de Forcer l'arrêt (visible uniquement si occupée)
            const btnStop = document.createElement("button");
            btnStop.textContent = "🛑 Stop";
            btnStop.className = "btn-stop";
            btnStop.style.marginLeft = "10px";
            btnStop.style.display = prise.status === 'occupied' ? "inline-block" : "none";
            btnStop.onclick = (e) => {
                e.stopPropagation();
                this.forceStop(prise.id);
            };
            tdAction.appendChild(btnStop);

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