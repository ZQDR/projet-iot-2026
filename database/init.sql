-- Fichier: database/init.sql

-- 1. TABLE UTILISATEURS
-- Stocke les infos des étudiants et leur crédit (solde)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Mot de passe hashé
    balance DECIMAL(10, 2) DEFAULT 10.00, -- Crédit initial (ex: 10€)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role ENUM('admin', 'student') DEFAULT 'student',
    device_id VARCHAR(100) NULL,
    token_version INT DEFAULT 0, -- Version du token pour gérer la révocation
    expo_push_token VARCHAR(255) DEFAULT NULL -- Pour les notifications Push sur mobile
);

-- 2. TABLE PRISES (PLUGS)
-- Stocke l'état physique (ON/OFF) et le statut de disponibilité
CREATE TABLE IF NOT EXISTS plugs (
    id VARCHAR(50) PRIMARY KEY, -- Augmenté pour supporter les ID Shelly longs (ex: shellyplusplugs-e465b8b82e18)
    status ENUM('libre', 'occupied', 'hs') DEFAULT 'libre', -- État pour l'appli
    state BOOLEAN DEFAULT FALSE, -- État électrique (TRUE = ON, FALSE = OFF)
    voltage FLOAT DEFAULT 0, -- Tension en Volts (pour la maintenance)
    last_index FLOAT DEFAULT 0, -- Dernier index de consommation connu (Wh)
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP -- Pour détecter si la prise est hors ligne
);

-- 3. TABLE HISTORIQUE (CONSUMPTION)
-- Pour la facturation et les graphiques de consommation
CREATE TABLE IF NOT EXISTS consumption (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    plug_id VARCHAR(50),
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    index_start FLOAT DEFAULT 0, -- Index du compteur au début de la session (Wh)
    energy_kwh FLOAT DEFAULT 0, -- Consommation en kWh
    cost DECIMAL(10, 2) DEFAULT 0, -- Coût final de la session
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plug_id) REFERENCES plugs(id)
);

-- 4. TABLE TRANSACTIONS
-- Pour l'historique financier (recharges et paiements)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('recharge', 'payment') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. COMPTE ADMIN PAR DÉFAUT
-- Login: admin@cielnewton.fr / MDP: admin123
INSERT IGNORE INTO users (username, email, password, role, balance) 
VALUES (
    'Admin', 
    'admin@cielnewton.fr', 
    '$2b$10$uM7RrbJSqt.kSLEr.H9FUuUxBxrJJ9JS9HQH/7ldjmDCpKGSCCs9e', 
    'admin', 
    999.00
);
INSERT IGNORE INTO users (username, email, password, role, balance) 
VALUES (
    'Yanis Fondateur', 
    'fondateur@cielnewton.fr', 
    '$2b$10$uM7RrbJSqt.kSLEr.H9FUuUxBxrJJ9JS9HQH/7ldjmDCpKGSCCs9e', 
    'admin', 
    99999999
);

-- 6. TABLE DEMANDES D'INSCRIPTION (Salle d'attente)
CREATE TABLE IF NOT EXISTS registration_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rgpd_consent BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);