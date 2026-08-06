-- KAN-220, KAN-224 and KAN-228 platform hardening.
-- Target: MySQL 8.0+. Select the target FitCV database before running.

CREATE TABLE hr_screening_batch (
    screening_batch_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id BIGINT UNSIGNED NOT NULL,
    created_by_account_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    job_description LONGTEXT NOT NULL,
    status ENUM('Pending','Processing','Completed','Partial','Failed') NOT NULL DEFAULT 'Pending',
    required_skills_json JSON NULL,
    preferred_skills_json JSON NULL,
    warnings_json JSON NULL,
    total_files INT UNSIGNED NOT NULL,
    processed_count INT UNSIGNED NOT NULL DEFAULT 0,
    selected_count INT UNSIGNED NOT NULL DEFAULT 0,
    error_message VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    completed_at DATETIME NULL,
    CONSTRAINT fk_screening_batch_company FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
    CONSTRAINT fk_screening_batch_creator FOREIGN KEY (created_by_account_id) REFERENCES account(account_id) ON DELETE RESTRICT,
    INDEX idx_screening_batch_company_created (company_id, created_at),
    INDEX idx_screening_batch_company_status (company_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE hr_screening_candidate (
    screening_candidate_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    screening_batch_id BIGINT UNSIGNED NOT NULL,
    source_index INT UNSIGNED NOT NULL,
    candidate_key CHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(400) NOT NULL,
    file_type ENUM('PDF','DOCX') NOT NULL,
    file_size_kb INT UNSIGNED NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    name VARCHAR(150) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,
    location VARCHAR(200) NULL,
    position VARCHAR(150) NULL,
    parsed_text LONGTEXT NULL,
    parsed_json JSON NULL,
    skills_json JSON NULL,
    matched_skills_json JSON NULL,
    missing_skills_json JSON NULL,
    experience_years DECIMAL(5,2) NULL,
    education LONGTEXT NULL,
    score DECIMAL(5,2) NULL,
    match_label VARCHAR(30) NULL,
    score_breakdown_json JSON NULL,
    strengths_json JSON NULL,
    weaknesses_json JSON NULL,
    parse_notes_json JSON NULL,
    status ENUM('Pending','Ready','Failed') NOT NULL DEFAULT 'Pending',
    error_message VARCHAR(1000) NULL,
    is_selected BOOLEAN NOT NULL DEFAULT FALSE,
    is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_screening_candidate_batch FOREIGN KEY (screening_batch_id) REFERENCES hr_screening_batch(screening_batch_id) ON DELETE CASCADE,
    CONSTRAINT uq_screening_candidate_source UNIQUE (screening_batch_id, source_index),
    INDEX idx_screening_candidate_batch_score (screening_batch_id, score),
    INDEX idx_screening_candidate_batch_selected (screening_batch_id, is_selected)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE ai_task
    ADD COLUMN owner_account_id BIGINT UNSIGNED NULL AFTER resource_id,
    ADD COLUMN company_id BIGINT UNSIGNED NULL AFTER owner_account_id,
    ADD COLUMN payload_json JSON NULL AFTER model_name,
    ADD COLUMN idempotency_key VARCHAR(120) NULL AFTER payload_json,
    ADD COLUMN attempt_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER idempotency_key,
    ADD COLUMN max_attempts INT UNSIGNED NOT NULL DEFAULT 3 AFTER attempt_count,
    ADD COLUMN available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER max_attempts,
    ADD COLUMN locked_by VARCHAR(100) NULL AFTER available_at,
    ADD COLUMN heartbeat_at DATETIME NULL AFTER locked_by,
    ADD COLUMN updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
    ADD CONSTRAINT fk_ai_task_owner FOREIGN KEY (owner_account_id) REFERENCES account(account_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_ai_task_company FOREIGN KEY (company_id) REFERENCES company(company_id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_ai_task_idempotency_key UNIQUE (idempotency_key),
    ADD INDEX idx_ai_task_claim (status, available_at, created_at),
    ADD INDEX idx_ai_task_owner_created (owner_account_id, created_at);

CREATE TABLE auth_session (
    session_id CHAR(36) PRIMARY KEY,
    account_id BIGINT UNSIGNED NOT NULL,
    refresh_token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    revoke_reason VARCHAR(50) NULL,
    CONSTRAINT fk_auth_session_account FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE CASCADE,
    INDEX idx_auth_session_account_active (account_id, revoked_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_rate_limit (
    key_hash CHAR(64) PRIMARY KEY,
    action VARCHAR(40) NOT NULL,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    blocked_until DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
