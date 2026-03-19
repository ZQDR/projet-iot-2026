# Image de base Nginx (serveur web très léger)
FROM nginx:alpine

# On supprime la page par défaut de Nginx
RUN rm -rf /usr/share/nginx/html/*

# On copie ton fichier HTML dans le dossier public de Nginx
COPY index.html /usr/share/nginx/html/index.html

# Nginx écoute sur le port 80 par défaut
EXPOSE 80

# La commande de démarrage est automatique avec cette image