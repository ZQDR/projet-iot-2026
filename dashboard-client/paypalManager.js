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

                try {
                    const response = await fetch(`${this.apiUrl}/payment/create-order`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${this.getToken()}`
                        },
                        body: JSON.stringify({ amount: amount })
                    });

                    const orderData = await response.json();

                    if (orderData.id) {
                        return orderData.id;
                    } else {
                        const errorDetail = orderData.details?.[0];
                        const errorMessage = errorDetail ? `${errorDetail.issue} ${errorDetail.description}` : JSON.stringify(orderData);
                        throw new Error(errorMessage);
                    }
                } catch (error) {
                    console.error("Erreur createOrder:", error);
                    if(typeof Swal !== 'undefined') Swal.fire("Erreur", "Impossible d'initialiser le paiement.", "error");
                    else alert("Impossible d'initialiser le paiement.");
                }
            },

            // Étape 2 : Capture (Validation) après que l'utilisateur a payé
            onApprove: async (data, actions) => {
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