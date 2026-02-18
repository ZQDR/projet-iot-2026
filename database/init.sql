-- Fichier: database/init.sql

-- On s'assure d'utiliser la bonne base de données définie dans le docker-compose
USE iot_project;

-- 1. TABLE UTILISATEURS
-- Stocke les infos des étudiants et leur crédit (solde)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Mot de passe hashé
    balance DECIMAL(10, 2) DEFAULT 10.00, -- Crédit initial (ex: 10€)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLE PRISES (PLUGS)
-- Stocke l'état physique (ON/OFF) et le statut de disponibilité
CREATE TABLE IF NOT EXISTS plugs (
    id VARCHAR(20) PRIMARY KEY, -- Ex: 'S1-01' comme sur le schéma
    status ENUM('libre', 'occupied', 'hs') DEFAULT 'libre', -- État pour l'appli
    state BOOLEAN DEFAULT FALSE, -- État électrique (TRUE = ON, FALSE = OFF)
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Pour détecter si la prise est hors ligne
);

-- 3. TABLE HISTORIQUE (CONSUMPTION)
-- Pour la facturation et les graphiques de consommation
CREATE TABLE IF NOT EXISTS consumption (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    plug_id VARCHAR(20),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    energy_kwh FLOAT DEFAULT 0, -- Consommation en kWh
    cost DECIMAL(10, 2) DEFAULT 0, -- Coût final de la session
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (plug_id) REFERENCES plugs(id)
);
