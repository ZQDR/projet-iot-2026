DROP TABLE IF EXISTS history;
DROP TABLE IF EXISTS users;


CREATE TABLE users (
    id SERIAL PRIMARY KEY,             
    username VARCHAR(50) NOT NULL,      
    email VARCHAR(100) UNIQUE NOT NULL, 
    balance DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,          
    item_name VARCHAR(100) NOT NULL,    
    amount DECIMAL(10, 2) NOT NULL,     
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    
    
    CONSTRAINT fk_user
      FOREIGN KEY(user_id) 
      REFERENCES users(id)
      ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('topup', 'payment') NOT NULL, -- topup = ajout d'argent, payment = retrait
    amount DECIMAL(10, 2) NOT NULL, -- Le montant (positif ou négatif)
    description VARCHAR(255), -- Ex: "Recharge PayPal" ou "Session sur S1-01"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
