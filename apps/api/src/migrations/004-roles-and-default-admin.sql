RENAME TABLE admins TO users;
ALTER TABLE users ADD COLUMN name VARCHAR(120) NOT NULL DEFAULT '', ADD COLUMN role ENUM('admin','user','tenant') NOT NULL DEFAULT 'admin', ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE sessions CHANGE COLUMN admin_id user_id INT NOT NULL;
ALTER TABLE audit_log CHANGE COLUMN admin_id actor_id INT NOT NULL;
CREATE TABLE tenancies (id INT PRIMARY KEY AUTO_INCREMENT, user_id INT NOT NULL, property_id INT NOT NULL, payment_record_id INT NULL, reference VARCHAR(120) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(property_id) REFERENCES cms_records(id), FOREIGN KEY(payment_record_id) REFERENCES cms_records(id), UNIQUE KEY(user_id,property_id,reference));
INSERT INTO users(email,password_hash,name,role,active) VALUES ('admin@gmail.com','1535370224cb760b25c4d5a46e576d04:c60cce34a4be03f931fb33046dda0a70c0a4769305887fec8aa223dc9c3116af850d156666d50f8944cdeec4bd6616f1bdeed0ca7fbe19315d7194eba6856b1d','Administrator','admin',TRUE) ON DUPLICATE KEY UPDATE role='admin',active=TRUE;
