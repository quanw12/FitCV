-- FitCV Auth & User Schema
-- MySQL 8+, InnoDB, utf8mb4.

CREATE TABLE IF NOT EXISTS industry (
  industry_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  industry_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company (
  company_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  company_name VARCHAR(200) NOT NULL,
  industry_id BIGINT UNSIGNED NULL,
  website_url VARCHAR(300) NULL,
  logo_url VARCHAR(400) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_company_industry
    FOREIGN KEY (industry_id) REFERENCES industry(industry_id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS account (
  account_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('Student', 'HR', 'HiringManager', 'Admin') NULL,
  avatar_url VARCHAR(400) NULL,
  company_id BIGINT UNSIGNED NULL,
  auth_provider ENUM('Password', 'Google') NOT NULL DEFAULT 'Password',
  reset_token_hash VARCHAR(255) NULL,
  reset_token_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_account_company
    FOREIGN KEY (company_id) REFERENCES company(company_id)
    ON DELETE SET NULL,
  INDEX idx_account_role (role),
  INDEX idx_account_company_id (company_id),
  INDEX idx_account_reset_token_hash (reset_token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate (
  candidate_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  account_id BIGINT UNSIGNED NULL,
  full_name VARCHAR(150) NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  created_by_hr_account_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_candidate_account
    FOREIGN KEY (account_id) REFERENCES account(account_id)
    ON DELETE SET NULL,
  CONSTRAINT fk_candidate_created_by_hr
    FOREIGN KEY (created_by_hr_account_id) REFERENCES account(account_id)
    ON DELETE SET NULL,
  INDEX idx_candidate_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
