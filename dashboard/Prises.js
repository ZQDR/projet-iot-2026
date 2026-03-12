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
    }

    init() {

        this.btnAddPrise.addEventListener("click", () => {
            const nom = prompt("Identifiant de la prise (ex: S1-01)")
            if (nom) {
                this.addPrise(nom)
            }
        })

        // Note: La suppression n'est pas implémentée dans l'API fournie (plugController), 
        // donc on désactive ou on cache le bouton pour l'instant.
        if(this.btnDeletePrise) this.btnDeletePrise.style.display = 'none';

        this.loadPrises()
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

    render() {
        this.tableBody.innerHTML = ""

        this.prises.forEach(prise => {

            const tr = document.createElement("tr")

            // Colonne ID
            const tdNom = document.createElement("td")
            tdNom.textContent = prise.id

            // Colonne État
            const tdEtat = document.createElement("td")
            // On affiche le status (libre/occupied) et l'état électrique (ON/OFF)
            const elecState = prise.state ? "⚡ ON" : "OFF";
            tdEtat.textContent = `${prise.status} (${elecState})`;
            
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