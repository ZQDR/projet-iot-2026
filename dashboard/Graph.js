class ConsumptionGraph{
    constructor(apiUrl, userManager){
        this.apiUrl=apiUrl;
        this.userManager = userManager;
        this.chart=null;
        this.ctx=document.getElementById("consoChart").getContext("2d");
        this.listenUserSelection();
    }

    listenUserSelection(){
        const userList=document.getElementById("userList");

        userList.addEventListener("click",(event)=>{
            const li = event.target.closest("li");
            if(li && li.dataset.id){
                const userId = li.dataset.id;
                this.loadUserConsumption(userId);
            }
        });
    }

    async loadUserConsumption(userId){
        try{
            // On vérifie le token avant d'appeler
            if (!this.userManager.token) await this.userManager.loginAdmin();

            // Appel de la route API correcte avec l'ID
            const response=await fetch(`${this.apiUrl}/consumption/history/${userId}`, {
                headers: { "Authorization": `Bearer ${this.userManager.token}` }
            }); 
            
            const data=await response.json();

            // Transformation des données (Array d'objets SQL -> Arrays pour Chart.js)
            // On suppose que data est un tableau : [{ start_time: "...", energy_kwh: 0.5 }, ...]
            const dates = [];
            const values = [];

            if (Array.isArray(data)) {
                // On inverse l'ordre pour avoir le plus ancien à gauche si l'API renvoie le plus récent en premier
                data.reverse().forEach(session => {
                    // Formatage simple de la date (ex: "12/05 14:30")
                    const dateObj = new Date(session.start_time);
                    const formattedDate = dateObj.toLocaleDateString('fr-FR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    
                    dates.push(formattedDate);
                    
                    // Conversion kWh -> Wh pour plus de lisibilité, ou garder kWh
                    // Ici on garde l'unité stockée ou on convertit si besoin. Le label dit "Wh".
                    // Si energy_kwh = 0.1 => 100 Wh
                    const energyWh = (session.energy_kwh || 0) * 1000; 
                    values.push(energyWh);
                });
            }

            this.updateGraph(dates, values);

        }catch(error){
            console.error("Erreur chargement consommation :",error);
        }
    }

    updateGraph(labels,values){
        if(this.chart)this.chart.destroy();

        this.chart=new Chart(this.ctx,{
            type:"line",
            data:{
                labels:labels,
                datasets:[{
                    label:"Consommation (Wh)",
                    data:values,
                    borderColor:"#27ae60",
                    backgroundColor:"rgba(39,174,96,0.2)",
                    tension:0.3,
                    fill:true
                }]
            },
            options:{
                responsive:true,
                scales:{y:{beginAtZero:true}}
            }
        });
    }
}

const graph=new ConsumptionGraph("https://recharge.cielnewton.fr/api", userManager);