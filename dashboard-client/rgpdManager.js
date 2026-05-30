class RGPDManager {
    constructor(apiUrl, getTokenCallback) {
        this.apiUrl = apiUrl;
        this.getToken = getTokenCallback; // Fonction pour récupérer le token JWT
    }

    /**
     * Télécharge les données RGPD de l'utilisateur
     */
    async exportData() {
        try {
            const token = this.getToken();
            if (!token) throw new Error("Vous devez être connecté pour exporter vos données.");

            const response = await fetch(`${this.apiUrl}/auth/export`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erreur lors de la génération du fichier d'export.");
            }

            // On récupère le fichier sous forme de "Blob" (données brutes)
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Création d'un lien invisible pour forcer le téléchargement du navigateur
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `mes_donnees_newton_${dateStr}.json`;
            
            document.body.appendChild(a);
            a.click();
            
            // Nettoyage
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            if (typeof Swal !== 'undefined') {
                Swal.fire("Succès", "Vos données personnelles ont été téléchargées.", "success");
            } else {
                alert("Vos données personnelles ont été téléchargées avec succès.");
            }
        } catch (error) {
            console.error("Erreur Export RGPD:", error);
            if (typeof Swal !== 'undefined') Swal.fire("Erreur", error.message, "error");
            else alert(error.message);
        }
    }

    /**
     * Demande la suppression du compte utilisateur (Droit à l'oubli)
     */
    async deleteAccount() {
        try {
            const token = this.getToken();
            if (!token) throw new Error("Vous devez être connecté.");

            const confirm = await Swal.fire({
                title: 'Supprimer mon compte ?',
                text: "Cette action est irréversible. Toutes vos données seront effacées (historique, crédit, compte).",
                icon: 'warning',
                showCancelButton: true,
                customClass: { confirmButton: 'swal2-danger' },
                confirmButtonText: 'Oui, tout supprimer',
                cancelButtonText: 'Annuler'
            });

            if (confirm.isConfirmed) {
                const response = await fetch(`${this.apiUrl}/auth/delete`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!response.ok) throw new Error("Erreur lors de la suppression du compte.");
                
                await Swal.fire("Supprimé", "Votre compte et vos données ont été définitivement effacés.", "success");
                
                // Déconnexion après suppression
                localStorage.removeItem('jwtToken');
                window.location.reload();
            }
        } catch (error) {
            console.error("Erreur Suppression RGPD:", error);
            if (typeof Swal !== 'undefined') Swal.fire("Erreur", error.message, "error");
            else alert(error.message);
        }
    }

    /**
     * Lie les événements aux boutons RGPD
     */
    init(btnExportId, btnDeleteId) {
        const btnExport = document.getElementById(btnExportId);
        if (btnExport) btnExport.addEventListener('click', () => this.exportData());
        
        const btnDelete = document.getElementById(btnDeleteId);
        if (btnDelete) btnDelete.addEventListener('click', () => this.deleteAccount());
    }
}