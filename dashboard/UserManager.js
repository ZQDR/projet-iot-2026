class UserManager {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.token = null; // Stockera le Master Token Admin
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
                        this.addUserToDashboard(user.username, "", user.balance);
                    });
                }
            }
        } catch (error) {
            console.error("Erreur chargement utilisateurs:", error);
        }
    }

    async registerUser(firstName, lastName, email, password, creditAmount) {
        // 1. Si on n'a pas de token, on se connecte d'abord
        if (!this.token) await this.loginAdmin();

        const username = `${firstName}${lastName}`;
        const payload = { username, email, password, creditAmount };

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

    addUserToDashboard(firstName, lastName, creditAmount) {
        const userList = document.getElementById("userList");
        if (!userList) return;

        const li = document.createElement("li");
        li.innerHTML = `<b>${firstName} ${lastName}</b> - Crédit: ${creditAmount}€`;
        userList.appendChild(li);
    }

    attachToForm(btnId) {
        const btn = document.getElementById(btnId);

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
                    this.addUserToDashboard(firstName, lastName, creditAmount);
                } else {
                    Swal.fire('Erreur', result.message, 'error');
                }
            }
        });
    }
}

const userManager = new UserManager("https://recharge.cielnewton.fr/api");
userManager.attachToForm("btnAddUser");