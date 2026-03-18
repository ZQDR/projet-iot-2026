class UserManager {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.token = null; // Stockera le Master Token Admin
        this.selectedUserId = null; // ID de l'utilisateur sélectionné
        
        // SÉCURITÉ DOM : On attend que la page soit chargée pour attacher les événements
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                this.initDeleteButton();
                this.initSearch();
                this.initSocket();
            });
        } else {
            this.initDeleteButton();
            this.initSearch();
            this.initSocket();
        }
    }

    initSocket() {
        if (typeof io !== 'undefined') {
            if (!window.appSocket) {
                const socketUrl = this.apiUrl.replace('/api', '');
                window.appSocket = io(socketUrl, { path: "/api/socket.io", transports: ['websocket', 'polling'] });
            }
            this.socket = window.appSocket;
            
            // Mettre à jour le solde en direct dans la liste des utilisateurs
            this.socket.on('live_consumption', (data) => {
                const userRow = document.querySelector(`#userList li[data-id='${data.userId}']`);
                if (userRow) {
                    const balanceSpan = userRow.querySelector('.user-balance');
                    if (balanceSpan && data.newBalance !== undefined) {
                        // Petite animation visuelle de consommation
                        balanceSpan.textContent = data.newBalance.toFixed(2);
                        balanceSpan.style.color = "#e74c3c"; // Passe en rouge
                        setTimeout(() => balanceSpan.style.color = "", 500); // Revient à la normale
                    }
                }
            });

            // NOUVEAU: Rafraîchissement complet (création, suppression, recharge PayPal, arrêt charge)
            this.socket.on('user_data_updated', () => {
                this.fetchAllUsers();
            });
        }
    }

    // Connexion automatique pour récupérer le token Admin
    async loginAdmin() {
        // SÉCURITÉ : On demande les identifiants à l'utilisateur au lieu de les lire en dur
        const { value: formValues } = await Swal.fire({
            title: 'Authentification Admin Requise',
            html:
                '<input id="login-email" class="swal2-input" placeholder="Email Admin">' +
                '<input id="login-pass" type="password" class="swal2-input" placeholder="Mot de passe">',
            focusConfirm: false,
            preConfirm: () => {
                return {
                    email: document.getElementById('login-email').value,
                    password: document.getElementById('login-pass').value
                };
            }
        });

        if (!formValues) return false; // L'utilisateur a annulé

        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formValues)
            });
            const data = await response.json();
            
            if (response.ok && data.token) {
                this.token = data.token;
                console.log("✅ Dashboard connecté en tant qu'Admin.");
                this.fetchAllUsers(); // <--- Une fois connecté, on charge la liste
                return true;
            }
            return false;
        } catch (error) {
            console.error("Erreur connexion admin:", error);
            return false;
        }
    }

    // Récupérer tous les utilisateurs depuis la BDD
    async fetchAllUsers() {
        try {
            const response = await fetch(`${this.apiUrl}/auth/users`, {
                method: "GET",
                headers: { 
                    "Authorization": `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const users = await response.json();
                const userList = document.getElementById("userList");
                if(userList) {
                    userList.innerHTML = ""; // On vide la liste actuelle
                    users.forEach(user => {
                        if (user.username === 'Admin') return; // Masquer l'utilisateur Admin
                        this.addUserToDashboard(user.id, user.username, user.balance);
                    });
                    // On réapplique le filtre de recherche s'il y en avait un
                    this.applySearchFilter();
                }
            }
        } catch (error) {
            console.error("Erreur chargement utilisateurs:", error);
        }
    }

    applySearchFilter() {
        const searchInput = document.querySelector(".search-bar input");
        if (searchInput) {
            const term = searchInput.value.toLowerCase();
            const items = document.querySelectorAll("#userList li");
            
            items.forEach(li => {
                const username = li.dataset.username.toLowerCase();
                if (username.includes(term)) {
                    li.style.display = "";
                } else {
                    li.style.display = "none";
                }
            });
        }
    }

    initSearch() {
        const searchInput = document.querySelector(".search-bar input");
        if (searchInput) {
            searchInput.addEventListener("input", () => this.applySearchFilter());
        }
    }

    initDeleteButton() {
        this.btnDeleteUser = document.getElementById("btnDeleteUser");
        if (this.btnDeleteUser) {
            this.btnDeleteUser.addEventListener("click", async () => {
                if (!this.selectedUserId) {
                    Swal.fire('Attention', 'Veuillez sélectionner un utilisateur à supprimer.', 'warning');
                    return;
                }

                const confirm = await Swal.fire({
                    title: 'Êtes-vous sûr ?',
                    text: "Cette action est irréversible !",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'Oui, supprimer'
                });

                if (confirm.isConfirmed) {
                    await this.deleteUser(this.selectedUserId);
                }
            });
        }
    }

    async deleteUser(userId) {
        try {
            const response = await fetch(`${this.apiUrl}/auth/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${this.token}` }
            });

            if (response.ok) {
    Swal.fire('Supprimé !', 'L\'utilisateur a été supprimé.', 'success');
    this.selectedUserId = null;
    this.fetchAllUsers(); // Rafraîchir la liste
} else {
    let message;
    try {
        // On parse la réponse de l'API pour récupérer les données de l'erreur
        const errorData = await response.json();
        message = errorData.message || "Erreur lors de la suppression";
    } catch (e) {
        // Si l'API renvoie du texte brut ou rien du tout, on tombe ici et on garde le message par défaut
        console.error("Erreur lors de la lecture de la réponse de l'API", e);
    }

    // On affiche l'erreur dans SweetAlert
    Swal.fire('Erreur', message, 'error');
}
        } catch (error) {
            console.error("Erreur suppression:", error);
        }
    }

    async registerUser(firstName, lastName, email, password, creditAmount) {
        // 1. Si on n'a pas de token, on se connecte d'abord
        if (!this.token) await this.loginAdmin();

        const username = `${firstName}${lastName}`;
        const payload = { username, email, password, balance: creditAmount };

        try {
            const response = await fetch(`${this.apiUrl}/auth/register`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${this.token}` // Ajout du token d'autorisation
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok) {
                return { success: false, message: data.message || "Erreur lors de l'inscription" };
            }

            return { success: true, data, firstName, lastName, creditAmount };
        } catch (error) {
            return { success: false, message: "Erreur réseau" };
        }
    }

    addUserToDashboard(id, username, creditAmount) {
        const userList = document.getElementById("userList");
        if (!userList) return;

        const li = document.createElement("li");
        li.dataset.id = id;
        li.dataset.username = username; // Pour le Graph
        li.innerHTML = `<b>${username}</b> - Crédit: <span class="user-balance">${parseFloat(creditAmount).toFixed(2)}</span>€`;
        
        // Maintenir la sélection visuelle lors du rechargement en temps réel
        if (this.selectedUserId == id) {
            li.style.backgroundColor = "#d0eaff";
        }

        li.addEventListener("click", () => {
            // Gestion de la sélection visuelle
            document.querySelectorAll("#userList li").forEach(el => el.style.backgroundColor = "");
            li.style.backgroundColor = "#d0eaff";
            this.selectedUserId = id;
        });

        userList.appendChild(li);
    }

    attachToForm(btnId) {
        const btn = document.getElementById(btnId);
        
        // Sécurité : Si le bouton n'existe pas sur cette page, on ne fait rien (évite de planter le script)
        if (!btn) return;

        btn.addEventListener("click", async () => {
            // Affiche une fenêtre "Prompt" version formulaire complet
            const { value: formValues } = await Swal.fire({
                title: 'Ajouter un utilisateur',
                html:
                    '<input id="swal-input1" class="swal2-input" placeholder="Prénom">' +
                    '<input id="swal-input2" class="swal2-input" placeholder="Nom">' +
                    '<input id="swal-input3" type="email" class="swal2-input" placeholder="Email">' +
                    '<input id="swal-input4" type="password" class="swal2-input" placeholder="Mot de passe">' +
                    '<input id="swal-input5" type="number" class="swal2-input" placeholder="Crédit initial">',
                focusConfirm: false,
                confirmButtonText: 'Enregistrer',
                showCancelButton: true,
                cancelButtonText: 'Annuler',
                preConfirm: () => {
                    const values = [
                        document.getElementById('swal-input1').value,
                        document.getElementById('swal-input2').value,
                        document.getElementById('swal-input3').value,
                        document.getElementById('swal-input4').value,
                        document.getElementById('swal-input5').value
                    ];
                    if (values.some(v => !v)) {
                        Swal.showValidationMessage('Veuillez remplir tous les champs');
                    }
                    return values;
                }
            });

            if (formValues) {
                const [firstName, lastName, email, password, creditAmount] = formValues;
                
                // Appel à l'API
                const result = await this.registerUser(
                    firstName, 
                    lastName, 
                    email, 
                    password, 
                    parseFloat(creditAmount)
                );

                if (result.success) {
                    Swal.fire('Succès !', 'Utilisateur créé.', 'success');
                    // On utilise l'ID retourné par l'API (result.data.userId)
                    const username = `${firstName} + " " + ${lastName}`;
                    this.addUserToDashboard(result.data.userId, username, creditAmount);
                } else {
                    Swal.fire('Erreur', result.message, 'error');
                }
            }
        });
    }
}

const userManager = new UserManager("https://recharge.cielnewton.fr/api");

document.addEventListener("DOMContentLoaded", () => {
    userManager.attachToForm("btnAddUser");
});