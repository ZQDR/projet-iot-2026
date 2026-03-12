# On utilise la version "alpine" de Nginx car elle est ultra-légère (environ 20 Mo)
FROM nginx:alpine

# On supprime les fichiers par défaut de Nginx pour faire place nette
RUN rm -rf /usr/share/nginx/html/*

# On copie ton index.html et index.js dans le dossier public de Nginx
COPY . /usr/share/nginx/html

# On expose le port 80 (le port standard pour le web)
EXPOSE 80

# Nginx démarre automatiquement en tâche de fond, pas besoin de CMD