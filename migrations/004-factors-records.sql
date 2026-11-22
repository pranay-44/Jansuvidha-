CREATE TABLE IF NOT EXISTS staff_factors (
  user_id CHAR(36) PRIMARY KEY,
  encrypted_secret VARCHAR(256) NOT NULL,
  last_step BIGINT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS citizen_records (
  sequence_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  record_id CHAR(36) NOT NULL,
  kind ENUM('review','assessment') NOT NULL,
  payload JSON NOT NULL,
  UNIQUE KEY (user_id,record_id),
  KEY (user_id,sequence_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
