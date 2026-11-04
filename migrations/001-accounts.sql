CREATE TABLE IF NOT EXISTS departments (
 id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS jurisdictions (
 id CHAR(36) PRIMARY KEY, name VARCHAR(120) NOT NULL UNIQUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS users (
 id CHAR(36) PRIMARY KEY,
 role ENUM('CITIZEN','OFFICER','ADMIN') NOT NULL,
 username VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin UNIQUE,
 official_email VARCHAR(254) UNIQUE, name VARCHAR(120), password_hash VARCHAR(255),
 department_id CHAR(36), jurisdiction_id CHAR(36),
 status ENUM('PENDING','ACTIVE','DISABLED') NOT NULL,
 session_version INT UNSIGNED NOT NULL DEFAULT 0,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
 FOREIGN KEY (department_id) REFERENCES departments(id),
 FOREIGN KEY (jurisdiction_id) REFERENCES jurisdictions(id),
 CHECK ((role='CITIZEN' AND username IS NOT NULL AND official_email IS NULL AND department_id IS NULL AND jurisdiction_id IS NULL AND password_hash IS NOT NULL) OR (role='OFFICER' AND username IS NULL AND official_email IS NOT NULL AND name IS NOT NULL AND department_id IS NOT NULL AND jurisdiction_id IS NOT NULL) OR (role='ADMIN' AND username IS NULL AND official_email IS NOT NULL AND name IS NOT NULL)),
 CHECK (status='PENDING' OR password_hash IS NOT NULL)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS complaints (
 id CHAR(36) PRIMARY KEY, citizen_id CHAR(36) NOT NULL,
 facility VARCHAR(80) NOT NULL, category VARCHAR(80) NOT NULL, description TEXT NOT NULL,
 department_id CHAR(36) NOT NULL, jurisdiction_id CHAR(36) NOT NULL,
 assigned_officer_id CHAR(36), status ENUM('Submitted','Assigned','In progress','Resolved','Closed','Rejected') NOT NULL DEFAULT 'Submitted',
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (citizen_id) REFERENCES users(id), FOREIGN KEY (assigned_officer_id) REFERENCES users(id),
 FOREIGN KEY (department_id) REFERENCES departments(id), FOREIGN KEY (jurisdiction_id) REFERENCES jurisdictions(id),
 INDEX (citizen_id,created_at), INDEX (assigned_officer_id,department_id,jurisdiction_id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS complaint_updates (
 id CHAR(36) PRIMARY KEY, complaint_id CHAR(36) NOT NULL, actor_id CHAR(36) NOT NULL,
 note TEXT NOT NULL, visibility ENUM('PUBLIC','INTERNAL') NOT NULL,
 previous_status VARCHAR(30) NOT NULL, new_status VARCHAR(30) NOT NULL,
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (complaint_id) REFERENCES complaints(id), FOREIGN KEY (actor_id) REFERENCES users(id), INDEX (complaint_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS account_tokens (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL,
 kind ENUM('RECOVERY','INVITATION','STAFF_RESET') NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 expires_at DATETIME(3), used_at DATETIME(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (user_id) REFERENCES users(id), INDEX (user_id,kind)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS audit_logs (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_id CHAR(36), action VARCHAR(80) NOT NULL,
 target_type VARCHAR(40) NOT NULL, target_id CHAR(36), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 FOREIGN KEY (actor_id) REFERENCES users(id)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sessions (
 session_id VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
 expires INT UNSIGNED NOT NULL, data MEDIUMTEXT, INDEX (expires)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS auth_limits (
 bucket CHAR(64) PRIMARY KEY, attempts INT UNSIGNED NOT NULL, expires_at BIGINT NOT NULL, INDEX (expires_at)
) ENGINE=InnoDB;
