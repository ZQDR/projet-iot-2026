# On part d'une version légère de Node
FROM node:18-alpine

# On crée le dossier de travail dans le conteneur
WORKDIR /app

# ÉTAPE CLÉ 1 : On copie d'abord SEULEMENT les fichiers de dépendances
# Cela permet à Docker de mettre en cache les node_modules si rien n'a changé
COPY package*.json ./

# ÉTAPE CLÉ 2 : On installe les dépendances DANS le conteneur
RUN npm install

# ÉTAPE CLÉ 3 : On copie tout le reste de ton code (routes, controllers, etc.)
COPY . .

# On expose le port interne
EXPOSE 3000

# Commande par défaut (sera surchargée par docker-compose en mode dev)
CMD ["npm", "run", "dev"]