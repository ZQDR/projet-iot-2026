class PayPalManager {
    constructor(apiUrl, getTokenCallback) {
        this.apiUrl = apiUrl;
        this.getToken = getTokenCallback; // Fonction qui retourne le token JWT actuel
    }

    /**
     * Initialise le bouton PayPal dans un conteneur donné
     * @param {string} containerId - L'ID de la div où afficher le bouton (ex: "paypal-button-container")
     * @param {string} amountInputId - L'ID de l'input contenant le montant à payer
     */
    init(containerId, amountInputId) {
        // --- DEBUG : Vérification du Client ID utilisé par le Frontend ---
        const scriptTag = document.querySelector('script[src*="paypal.com/sdk/js"]');
        console.log("🔍 [VÉRIFICATION PAYPAL] URL du script chargé :", scriptTag ? scriptTag.src : "Introuvable");

        if (!window.paypal) {
            console.error("Le SDK PayPal n'est pas chargé via <script>.");
            return;
        }

        window.paypal.Buttons({
            fundingSource: window.paypal.FUNDING.PAYPAL, // <--- C'est cette ligne qui force uniquement PayPal (pas de CB directe)
            style: {
                layout: 'vertical',
                color:  'blue',
                shape:  'rect',
                label:  'paypal'
            },

            // Étape 1 : Création de la commande sur le serveur
            createOrder: async (data, actions) => {
                const amountInput = document.getElementById(amountInputId);
                const amount = amountInput ? amountInput.value : "10.00";
                const currentToken = this.getToken();

                console.log("=== [DEBUG] PAYPAL CREATE ORDER ===");
                console.log("URL:", `${this.apiUrl}/payment/create-order`);
                console.log("Token envoyé:", currentToken);
                console.log("Body envoyé:", { amount: amount });

                try {
                    const response = await fetch(`${this.apiUrl}/payment/create-order`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${currentToken}`
                        },
                        body: JSON.stringify({ amount: amount })
                    });

                    const orderData = await response.json();
                    
                    console.log("Status HTTP de la réponse:", response.status);
                    console.log("Données brutes reçues du Backend:", orderData);
                    console.log("=====================================");

                    // Si la réponse du serveur n'est pas OK (ex: 500) ou si l'ID de commande est manquant
                    if (!response.ok || !orderData.id) {
                        // On construit un message d'erreur clair à partir de la réponse de l'API
                        const errorMessage = orderData.error || (orderData.details && orderData.details[0] ? orderData.details[0].description : "Erreur inconnue du serveur.");
                        // On lève une exception pour que le `catch` la récupère et l'affiche
                        throw new Error(errorMessage);
                    }

                    // Tout va bien, on renvoie l'ID de commande à PayPal
                    return orderData.id;

                } catch (error) {
                    console.error("Erreur createOrder:", error);
                    if(typeof Swal !== 'undefined') Swal.fire("Erreur d'initialisation", error.message, "error");
                    else alert(error.message);
                    // TRÈS IMPORTANT : On rejette la promesse pour que le bouton PayPal se réinitialise proprement
                    throw error;
                }
            },

            // Étape 2 : Capture (Validation) après que l'utilisateur a payé
            onApprove: async (data, actions) => {
                console.log("=== [DEBUG] PAYPAL ON APPROVE ===");
                console.log("Data retournées par la popup PayPal:", data);

                try {
                    const response = await fetch(`${this.apiUrl}/payment/capture-order`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${this.getToken()}`
                        },
                        body: JSON.stringify({ orderId: data.orderID })
                    });

                    const transactionData = await response.json();

                    console.log("Status HTTP Capture:", response.status);
                    console.log("Données brutes de Capture (Backend):", transactionData);
                    console.log("====================================");

                    if (response.ok) {
                        if(typeof Swal !== 'undefined') Swal.fire("Succès", `Rechargement réussi ! Nouveau solde : ${transactionData.newBalance}€`, "success");
                        else alert(`Succès ! Nouveau solde : ${transactionData.newBalance}€`);
                        
                        // Déclenche un événement pour que le reste du dashboard se mette à jour
                        document.dispatchEvent(new CustomEvent('balanceUpdated', { detail: transactionData.newBalance }));
                    } else {
                        if(typeof Swal !== 'undefined') Swal.fire("Erreur", "Le paiement n'a pas pu être validé.", "error");
                        else alert("Le paiement n'a pas pu être validé.");
                    }
                } catch (error) {
                    console.error("Erreur captureOrder:", error);
                    if(typeof Swal !== 'undefined') Swal.fire("Erreur", "Erreur réseau lors de la validation.", "error");
                    else alert("Erreur réseau.");
                }
            }
        }).render(`#${containerId}`);
    }
}