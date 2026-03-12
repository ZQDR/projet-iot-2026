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
            if(event.target.tagName==="LI"){
                const username=event.target.textContent;
                this.loadUserConsumption(username);
            }
        });
    }

    async loadUserConsumption(username){
        try{
            // On vérifie le token avant d'appeler
            if (!this.userManager.token) await this.userManager.loginAdmin();

            const response=await fetch(`${this.apiUrl}/consumption/${username}`, {
                headers: { "Authorization": `Bearer ${this.userManager.token}` }
            }); 
            
            const data=await response.json();

            /*
            Exemple JSON attendu :
            {
                "dates":["10h","11h","12h","13h"],
                "values":[120,150,90,200]
            }
            */

            this.updateGraph(data.dates,data.values);

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