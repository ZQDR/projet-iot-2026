class NotificationManager {

    constructor(apiUrl) {
        // URL de l'API qui fournit les alertes de maintenance
        this.apiUrl = apiUrl;

        // Sélection de la table HTML dans la div "Alertes de maintenance" via le DOM
        this.table = document.querySelector(".maintenance-table");
    }

    async fetchAlerts() {
        try {
            // Requête HTTP vers l'API pour récupérer les alertes
            const response = await fetch(this.apiUrl);

            if (!response.ok) {
                throw new Error("Erreur lors de la récupération des alertes");
            }

            // Conversion de la réponse API en JSON
            const alerts = await response.json();

            // Envoi des données récupérées vers la fonction d'affichage
            this.displayAlerts(alerts);

        } catch (error) {
            console.error("Erreur API :", error);
        }
    }

    displayAlerts(alerts) {
        this.table.innerHTML = "";

        const header = `
        <tr>
            <th>ID</th>
            <th>Message</th>
            <th>Date</th>
            <th>Niveau</th>
        </tr>`;
        this.table.insertAdjacentHTML("beforeend", header);

        alerts.forEach(alert => {
            const row = `
            <tr>
                <td>${alert.id}</td>
                <td>${alert.message}</td>
                <td>${alert.date}</td>
                <td>${alert.level}</td>
            </tr>`;
            this.table.insertAdjacentHTML("beforeend", row);
        });
    }

}

document.addEventListener("DOMContentLoaded", () => {

    // Instanciation de la classe NotificationManager
    const notifications = new NotificationManager("https://api.example.com/alerts");
    notifications.fetchAlerts();

});