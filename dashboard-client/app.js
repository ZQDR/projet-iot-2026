const API_URL = 'https://recharge.cielnewton.fr/api';
const SOCKET_URL = 'https://recharge.cielnewton.fr';
let socket = null;
let myUserId = null;
let myUsername = null;

function updateBalanceUI(balanceValue) {
    const balance = Number(balanceValue);
    document.getElementById('userBalance').innerText = balance.toFixed(2);
    
    const progressPercent = Math.min(100, Math.max(0, (balance / 100) * 100));
    const progressBar = document.getElementById('balanceProgressBar');
    progressBar.style.width = progressPercent + '%';
    
    if (balance < 5) progressBar.style.background = '#dc3545';
    else if (balance < 15) progressBar.style.background = '#f39c12';
    else progressBar.style.background = 'var(--accent-black)';
}

document.addEventListener('balanceUpdated', (e) => {
    updateBalanceUI(e.detail);
});

async function loadPayPalScript() {
    if (document.getElementById('paypal-sdk-script')) return;
    const token = localStorage.getItem('jwtToken');
    try {
        const response = await fetch(`${API_URL}/payment/config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (data.clientId) {
            const script = document.createElement('script');
            script.id = 'paypal-sdk-script';
            script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&currency=EUR`;
            script.onload = () => initPayPal();
            document.body.appendChild(script);
        }
    } catch (err) {
        console.error(err);
    }
}

async function showRegistrationForm() {
    const { value: formValues } = await Swal.fire({
        title: 'Demande d\'inscription',
        html: `
            <div style="text-align: left;">
                <div class="title-sm" style="margin-bottom: 5px;">Prénom</div>
                <input id="reg-firstname" class="swal2-input" placeholder="Ex: Jean">
                
                <div class="title-sm" style="margin-bottom: 5px; margin-top: 15px;">Nom</div>
                <input id="reg-lastname" class="swal2-input" placeholder="Ex: Dupont">
                
                <div class="title-sm" style="margin-bottom: 5px; margin-top: 15px;">Email</div>
                <input id="reg-email" type="email" class="swal2-input" placeholder="jean.dupont@eleve.fr">
                
                <div class="title-sm" style="margin-bottom: 5px; margin-top: 15px;">Mot de passe</div>
                <input id="reg-password" type="password" class="swal2-input" placeholder="••••••••">
                
                <div style="margin-top: 25px; background: var(--bg-base); padding: 15px; border-radius: var(--radius-md); font-size: 0.9em; border: 1px solid var(--border-color);">
                    <label style="display: flex; align-items: flex-start; cursor: pointer;">
                        <input type="checkbox" id="reg-rgpd" style="margin-top: 2px; margin-right: 12px; transform: scale(1.2); accent-color: var(--accent-black);">
                        <span style="color: var(--text-secondary); line-height: 1.4;">J'accepte l'utilisation de mes données pour <b>Newton Charge</b> (RGPD).</span>
                    </label>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Soumettre la demande',
        cancelButtonText: 'Annuler',
        width: '500px',
        preConfirm: () => {
            const firstName = document.getElementById('reg-firstname').value.trim();
            const lastName = document.getElementById('reg-lastname').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const rgpdConsent = document.getElementById('reg-rgpd').checked;

            if (!firstName || !lastName || !email || !password) {
                Swal.showValidationMessage('Veuillez remplir tous les champs.');
                return false;
            }
            if (!rgpdConsent) {
                Swal.showValidationMessage('Vous devez accepter les conditions RGPD pour continuer.');
                return false;
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                Swal.showValidationMessage('Veuillez entrer une adresse email valide.');
                return false;
            }

            return { firstName, lastName, email, password, rgpdConsent };
        }
    });

    if (formValues) {
        Swal.fire({ title: 'Envoi en cours...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
            const response = await fetch(`${API_URL}/auth/request-registration`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formValues)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Demande envoyée !',
                    text: 'Votre demande a bien été transmise. Vous recevrez un email dès qu\'un administrateur aura validé votre compte.'
                });
            } else {
                Swal.fire('Erreur', data.error || 'Erreur lors de la demande.', 'error');
            }
        } catch (error) {
            Swal.fire('Erreur réseau', 'Impossible de contacter le serveur.', 'error');
        }
    }
}

async function login() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorMsg = document.getElementById('loginError');

    if (!email || !password) {
        errorMsg.innerText = "Remplis tous les champs gros !";
        errorMsg.style.display = "block";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, deviceId: getDeviceId() })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            localStorage.setItem('jwtToken', data.token);
            
            document.getElementById('loginView').style.display = 'none';
            document.getElementById('dashboardView').style.display = 'block';
            
            await loadProfile();
            await loadPlugs();
            initWebSocket();
            loadPayPalScript();
            initRGPD();
            initHistoryToggle();
        } else {
            errorMsg.innerText = "Email ou mot de passe incorrect.";
            errorMsg.style.display = "block";
        }
    } catch (error) {
        errorMsg.innerText = "Erreur de connexion au serveur.";
        errorMsg.style.display = "block";
    }
}

function getDeviceId() {
    let id = localStorage.getItem('deviceId');
    if (!id) {
        id = 'web-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', id);
    }
    return id;
}

async function loadProfile() {
    const token = localStorage.getItem('jwtToken');
    
    try {
        const response = await fetch(`${API_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if (response.ok) {
            myUserId = data.id;
            myUsername = data.username;
            document.getElementById('userName').innerText = data.username;
            updateBalanceUI(data.balance);
        } else {
            logout();
        }
    } catch (error) {
        console.error(error);
    }
}

async function loadPlugs() {
    const token = localStorage.getItem('jwtToken');
    const select = document.getElementById('plugId');
    try {
        const response = await fetch(`${API_URL}/plugs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const plugs = await response.json();
            
            const currentSelection = select.value;
            
            select.innerHTML = '<option value="">Sélectionnez une prise...</option>';
            
            const activeList = document.getElementById('activeSessionsList');
            activeList.innerHTML = '';
            let hasActive = false;

            plugs.forEach(plug => {
                const option = document.createElement('option');
                option.value = plug.id;
                const statusText = plug.status === 'libre' ? 'Libre' : (plug.status === 'occupied' ? 'Occupée' : 'HS');
                option.textContent = `${plug.id} (${statusText})`;

                if (plug.status === 'hs') option.disabled = true;

                select.appendChild(option);

                if (plug.status === 'occupied' && plug.username === myUsername) {
                    hasActive = true;
                    const div = document.createElement('div');
                    div.className = 'active-session-item live-session';
                    div.id = `active-session-${plug.id}`;
                    div.innerHTML = `
                        <strong>🔌 Prise ${plug.id}</strong>
                        <span id="session-power-${plug.id}">⚡ Puissance : ${plug.power || 0} W</span>
                        <span id="session-energy-${plug.id}">📈 Énergie : Calcul en cours...</span>
                        <span id="session-cost-${plug.id}">💰 Coût : 0.00 €</span>
                        <button class="btn-stop" onclick="stopSpecificCharge('${plug.id}')">🛑 Arrêter & Payer</button>
                    `;
                    activeList.appendChild(div);
                }
            });
            
            if (currentSelection) select.value = currentSelection;
            document.getElementById('activeSessionsCard').style.display = hasActive ? 'block' : 'none';
        } else {
            select.innerHTML = '<option value="">⚠️ Erreur API</option>';
        }
    } catch (error) {
        select.innerHTML = '<option value="">⚠️ Serveur inaccessible</option>';
    }
}

function resetDisplays() {
    document.getElementById('plugStateDisplay').innerText = `📡 Statut de la prise : En attente...`;
    document.getElementById('plugPowerDisplay').innerText = `⚡ Puissance : ...`;
    if(document.getElementById('plugEnergyDisplay')) {
        document.getElementById('plugEnergyDisplay').innerText = `📈 Énergie : 0.0 Wh`;
        document.getElementById('plugCostDisplay').innerText = `💰 Coût de session : 0.00 €`;
    }
}

async function apiRequest(endpoint, method = 'POST', targetPlugId = null) {
    const plugId = targetPlugId || document.getElementById('plugId').value;
    if (!plugId) {
        Swal.fire('Attention', 'Veuillez sélectionner une prise.', 'warning');
        return null;
    }

    const token = localStorage.getItem('jwtToken');
    
    try {
        const response = await fetch(`${API_URL}/plugs/${endpoint}`, {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ plugId })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || "Une erreur est survenue");
        }
        
        return data;
    } catch (error) {
        Swal.fire('Erreur', error.message, 'error');
        return null; 
    }
}

async function startCharge() {
    Swal.fire({ title: 'Démarrage en cours...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    const data = await apiRequest('start');
    if(data) {
        Swal.fire('Succès !', data.message || "Charge démarrée !", 'success');
        loadPlugs();
    }
}

async function stopSpecificCharge(targetPlugId) {
    const confirm = await Swal.fire({
        title: `Arrêter la prise ${targetPlugId} ?`,
        text: "Votre session sera terminée et facturée.",
        icon: 'warning',
        showCancelButton: true,
        customClass: { confirmButton: 'swal2-danger' },
        confirmButtonText: 'Oui, arrêter',
        cancelButtonText: 'Annuler'
    });

    if (confirm.isConfirmed) {
        Swal.fire({ title: 'Arrêt en cours...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const data = await apiRequest('stop', 'POST', targetPlugId);
        if(data && data.cost !== undefined) {
            Swal.fire({
                title: 'Charge terminée 🛑',
                html: `💰 Coût : <b>${data.cost}</b><br>⚡ Énergie : <b>${data.energy_kwh} kWh</b><br>💳 Nouveau solde : <b>${data.newBalance}</b>`,
                icon: 'success'
            });
            loadProfile();
            loadPlugs();
        }
    }
}

function initPayPal() {
    const container = document.getElementById('paypal-button-container');
    if (!container) return;

    if (container.querySelector('iframe')) return;
    
    container.innerHTML = "";

    if (!window.paypal) {
        container.innerHTML = "<div style='color:red; padding:10px; border:1px solid red; border-radius:5px;'>❌ Erreur : Impossible de charger PayPal.</div>";
        return;
    }

    if (typeof PayPalManager === 'undefined') {
        container.innerHTML = "<div style='color:red; padding:10px; border:1px solid red; border-radius:5px;'>❌ Erreur : Le fichier <b>paypalManager.js</b> est introuvable ou mal placé.</div>";
        return;
    }

    try {
        const paypalManager = new PayPalManager(API_URL, () => {
            return localStorage.getItem('jwtToken');
        });
        paypalManager.init("paypal-button-container", "amountToPay");
    } catch (err) {
        container.innerHTML = "<div style='color:red;'>Erreur interne lors de l'initialisation du paiement.</div>";
    }
}

async function payWithStripe() {
    const amount = document.getElementById('amountToPay').value;
    const token = localStorage.getItem('jwtToken');
    
    try {
        Swal.fire({ title: 'Redirection sécurisée...', text: 'Veuillez patienter', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        const response = await fetch(`${API_URL}/payment/create-stripe-session`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
            body: JSON.stringify({ amount })
        });
        const data = await response.json();
        
        if (response.ok && data.url) {
            window.location.href = data.url;
        } else {
            Swal.fire('Erreur', data.error || "Impossible d'initialiser Stripe.", 'error');
        }
    } catch (err) {
        Swal.fire('Erreur', "Erreur de connexion au serveur.", 'error');
    }
}

async function checkStripeReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('stripe_session_id');

    if (sessionId) {
        const token = localStorage.getItem('jwtToken');
        if(!token) return;

        window.history.replaceState({}, document.title, window.location.pathname);

        try {
            Swal.fire({ title: 'Vérification...', text: 'Validation de votre paiement...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const response = await fetch(`${API_URL}/payment/verify-stripe-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ sessionId })
            });
            const data = await response.json();

            if (response.ok && !data.message?.includes("déjà validé")) {
                Swal.fire('Succès !', `Rechargement réussi. Votre solde est à jour.`, 'success');
                loadProfile();
            } else if (data.message?.includes("déjà validé")) {
                Swal.close();
            } else {
                Swal.fire('Erreur', data.error || "Paiement non validé.", 'error');
            }
        } catch(e) {}
    }
}

function initRGPD() {
    const rgpdManager = new RGPDManager(API_URL, () => localStorage.getItem('jwtToken'));
    rgpdManager.init('btnExportRGPD', 'btnDeleteAccountRGPD');

    const btnToggle = document.getElementById('btnToggleRGPD');
    const rgpdSection = document.getElementById('rgpdSection');
    if (btnToggle && rgpdSection) {
        btnToggle.onclick = function() {
            if (rgpdSection.style.display === 'none') {
                rgpdSection.style.display = 'block';
                btnToggle.innerHTML = '⚙️ Paramètres de vie privée (RGPD) <span style="float: right;">▲</span>';
            } else {
                rgpdSection.style.display = 'none';
                btnToggle.innerHTML = '⚙️ Paramètres de vie privée (RGPD) <span style="float: right;">▼</span>';
            }
        };
    }
}

function initHistoryToggle() {
    const btnToggle = document.getElementById('btnToggleHistory');
    const historySection = document.getElementById('historySection');
    let isLoaded = false;

    if (btnToggle && historySection) {
        btnToggle.onclick = async function() {
            if (historySection.style.display === 'none') {
                historySection.style.display = 'block';
                btnToggle.innerHTML = '📊 Historique & Transactions <span style="float: right;">▲</span>';
                if (!isLoaded) {
                    await loadUserHistory();
                    isLoaded = true;
                }
            } else {
                historySection.style.display = 'none';
                btnToggle.innerHTML = '📊 Historique & Transactions <span style="float: right;">▼</span>';
            }
        };
    }
}

async function loadUserHistory() {
    if (!myUserId) return;
    const token = localStorage.getItem('jwtToken');
    try {
        const response = await fetch(`${API_URL}/auth/users/${myUserId}/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            
            const consContainer = document.getElementById('consumptionHistoryList');
            if (data.history && data.history.length > 0) {
                consContainer.innerHTML = data.history.map(session => {
                    const date = new Date(session.start_time).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
                    const cost = parseFloat(session.cost || 0).toFixed(2);
                    const energy = parseFloat(session.energy_kwh || 0).toFixed(3);
                    return `<div style="padding: 12px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: var(--text-primary);">Prise ${session.plug_id}</strong><br>
                            <span style="color: var(--text-secondary); font-size: 0.85em;">${date} • ${energy} kWh</span>
                        </div>
                        <strong style="color: var(--text-primary); font-size: 1.1em;">${cost} €</strong>
                    </div>`;
                }).join('');
            } else {
                consContainer.innerHTML = '<p style="color: var(--text-secondary);">Aucune charge récente.</p>';
            }

            const transContainer = document.getElementById('transactionHistoryList');
            if (data.transactions && data.transactions.length > 0) {
                transContainer.innerHTML = data.transactions.map(tx => {
                    const date = new Date(tx.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' });
                    const amount = parseFloat(tx.amount).toFixed(2);
                    const sign = tx.amount > 0 ? '+' : '';
                    return `<div style="padding: 12px 0; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: var(--text-primary);">${tx.description || tx.type}</strong><br>
                            <span style="color: var(--text-secondary); font-size: 0.85em;">${date}</span>
                        </div>
                        <strong style="color: var(--text-primary); font-size: 1.1em;">${sign}${amount} €</strong>
                    </div>`;
                }).join('');
            } else {
                transContainer.innerHTML = '<p style="color: var(--text-secondary);">Aucune transaction récente.</p>';
            }
        }
    } catch (err) {
        document.getElementById('consumptionHistoryList').innerText = "Erreur de chargement.";
        document.getElementById('transactionHistoryList').innerText = "Erreur de chargement.";
    }
}

function initWebSocket() {
    if(socket) return;
    socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling']
    });

    socket.on('state_update', (data) => {
        const currentPlug = document.getElementById('plugId').value;
        if (data.plugId === currentPlug) {
            const etat = data.state ? "🟢 Allumée" : "🔴 Éteinte";
            document.getElementById('plugStateDisplay').innerText = `📡 Statut de la prise : ${etat}`;
        }
    });

    socket.on('power_update', (data) => {
        const currentPlug = document.getElementById('plugId').value;
        if (data.plugId === currentPlug) {
            document.getElementById('plugPowerDisplay').innerText = `⚡ Puissance : ${data.power} W`;
        }

        const sessionPower = document.getElementById(`session-power-${data.plugId}`);
        if (sessionPower) {
            sessionPower.innerText = `⚡ Puissance : ${data.power} W`;
        }
    });

    socket.on('status_update', (data) => {
        const select = document.getElementById('plugId');
        const option = select.querySelector(`option[value="${data.plugId}"]`);
        if (option) {
            const statusText = data.status === 'libre' ? 'Libre' : (data.status === 'occupied' ? 'Occupée' : 'HS');
            option.textContent = `${data.plugId} (${statusText})`;
            
            option.disabled = (data.status === 'hs');

            if (data.status === 'libre' || data.status === 'hs') {
                const activeItem = document.getElementById(`active-session-${data.plugId}`);
                if (activeItem) {
                    activeItem.remove();
                    if (document.getElementById('activeSessionsList').children.length === 0) {
                        document.getElementById('activeSessionsCard').style.display = 'none';
                    }
                }
            }
        }
    });

    socket.on('live_consumption', (data) => {
        if (data.userId == myUserId) {
            updateBalanceUI(data.newBalance);
            
            const currentPlug = document.getElementById('plugId').value;
            if (data.plugId === currentPlug) {
                if(document.getElementById('plugEnergyDisplay')) {
                    document.getElementById('plugEnergyDisplay').innerText = `📈 Énergie : ${data.energyWh.toFixed(1)} Wh`;
                    document.getElementById('plugCostDisplay').innerText = `💰 Coût de session : ${data.cost.toFixed(2)} €`;
                }
            }
            
            const sessionEnergy = document.getElementById(`session-energy-${data.plugId}`);
            if (sessionEnergy) sessionEnergy.innerText = `📈 Énergie : ${data.energyWh.toFixed(1)} Wh`;
            const sessionCost = document.getElementById(`session-cost-${data.plugId}`);
            if (sessionCost) sessionCost.innerText = `💰 Coût : ${data.cost.toFixed(2)} €`;
        }
    });

    socket.on('user_data_updated', (data) => {
        if (data.userId == myUserId) {
            loadProfile();
        }
    });
    
    socket.on('session_auto_stopped', (data) => {
        if (data.userId == myUserId) {
            let confirmText = 'OK';
            let showRecharge = false;
            let popupTitle = 'Session Interrompue 🔌';
            let popupIcon = 'warning';

            if (data.reason === 'solde_epuise') {
                confirmText = 'Recharger mon compte';
                showRecharge = true;
            } else if (data.reason === 'maintenance') {
                popupTitle = 'Maintenance en cours 🔧';
                popupIcon = 'info';
            } else if (data.reason === 'admin_force_stop') {
                popupTitle = 'Arrêt Forcé 🛑';
            }

            Swal.fire({
                title: popupTitle,
                text: data.message || "Votre solde est épuisé. La prise a été coupée automatiquement.",
                icon: popupIcon,
                confirmButtonText: confirmText,
                allowOutsideClick: false
            }).then((result) => {
                if (result.isConfirmed && showRecharge) {
                    const rechargeSection = document.querySelector(".card");
                    if (rechargeSection) {
                        rechargeSection.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
            loadProfile();
            resetDisplays();
            loadPlugs();
        }
    });

    socket.on('new_plug_added', () => {
        loadPlugs();
    });
}

function logout() {
    localStorage.removeItem('jwtToken');
    if(socket) socket.disconnect();
    window.location.reload();
}

if (localStorage.getItem('jwtToken')) {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'block';
    (async () => {
        await loadProfile();
        await loadPlugs();
        initWebSocket();
        loadPayPalScript();
        checkStripeReturn();
        initRGPD();
        initHistoryToggle();
    })();
}