CREATE TABLE IF NOT EXISTS social_identities (
 provider ENUM('google','facebook') NOT NULL,
 subject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 user_id CHAR(36) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (provider,subject),
 UNIQUE KEY (user_id,provider),
 FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;
