-- FitCV migration 003
-- Add versioned CV/JD parsing and asynchronous deterministic match results.

USE fitcv;

ALTER TABLE cv
    ADD COLUMN file_sha256 CHAR(64) NULL AFTER file_size_kb,
    ADD COLUMN version_number INT UNSIGNED NOT NULL DEFAULT 1 AFTER file_sha256,
    ADD INDEX idx_cv_account_latest (account_id, is_latest, uploaded_at);

CREATE TEMPORARY TABLE cv_version_backfill AS
    SELECT cv_id, ROW_NUMBER() OVER (PARTITION BY account_id ORDER BY uploaded_at, cv_id) AS version_number
    FROM cv
    WHERE account_id IS NOT NULL;

UPDATE cv AS target
JOIN cv_version_backfill AS ranked ON ranked.cv_id = target.cv_id
SET target.version_number = ranked.version_number;

DROP TEMPORARY TABLE cv_version_backfill;

ALTER TABLE cv
    ADD CONSTRAINT uq_cv_account_version UNIQUE (account_id, version_number);

ALTER TABLE cv_parse_result
    ADD COLUMN parser_version VARCHAR(50) NOT NULL DEFAULT 'fitcv-parser-v1' AFTER parse_status;

CREATE TABLE job_description (
    job_description_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    account_id         BIGINT UNSIGNED NOT NULL,
    job_id             BIGINT UNSIGNED NULL,
    title              VARCHAR(200) NOT NULL DEFAULT 'Pasted job description',
    source_type        ENUM('PastedText', 'UploadedFile', 'Job') NOT NULL DEFAULT 'PastedText',
    raw_text           LONGTEXT NOT NULL,
    content_sha256     CHAR(64) NOT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_description_account FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE CASCADE,
    CONSTRAINT fk_job_description_job FOREIGN KEY (job_id) REFERENCES job(job_id) ON DELETE SET NULL,
    INDEX idx_job_description_account_created (account_id, created_at),
    INDEX idx_job_description_account_hash (account_id, content_sha256)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE jd_parse_result (
    jd_parse_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    job_description_id BIGINT UNSIGNED NOT NULL,
    parsed_json        JSON NULL,
    parse_status       ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    parser_version     VARCHAR(50) NOT NULL DEFAULT 'fitcv-parser-v1',
    error_message      VARCHAR(500) NULL,
    parsed_at          DATETIME NULL,
    CONSTRAINT fk_jd_parse_description FOREIGN KEY (job_description_id) REFERENCES job_description(job_description_id) ON DELETE CASCADE,
    INDEX idx_jd_parse_description (job_description_id, jd_parse_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

ALTER TABLE match_result
    MODIFY job_id BIGINT UNSIGNED NULL,
    MODIFY overall_score DECIMAL(5,2) NULL,
    ADD COLUMN job_description_id BIGINT UNSIGNED NULL AFTER job_id,
    ADD COLUMN cv_parse_id BIGINT UNSIGNED NULL AFTER job_description_id,
    ADD COLUMN jd_parse_id BIGINT UNSIGNED NULL AFTER cv_parse_id,
    ADD COLUMN status ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Success' AFTER application_id,
    ADD COLUMN pass_probability DECIMAL(5,2) NULL AFTER soft_skill_score,
    ADD COLUMN match_label VARCHAR(30) NULL AFTER pass_probability,
    ADD COLUMN evidence_json JSON NULL AFTER match_label,
    ADD COLUMN algorithm_version VARCHAR(50) NOT NULL DEFAULT 'legacy' AFTER recommendation,
    ADD COLUMN error_message VARCHAR(1000) NULL AFTER model_name,
    ADD COLUMN completed_at DATETIME NULL AFTER generated_at,
    ADD CONSTRAINT fk_match_result_job_description FOREIGN KEY (job_description_id) REFERENCES job_description(job_description_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_match_result_cv_parse FOREIGN KEY (cv_parse_id) REFERENCES cv_parse_result(cv_parse_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_match_result_jd_parse FOREIGN KEY (jd_parse_id) REFERENCES jd_parse_result(jd_parse_id) ON DELETE CASCADE,
    ADD CONSTRAINT uq_match_exact_versions UNIQUE (cv_parse_id, jd_parse_id, algorithm_version),
    ADD CONSTRAINT chk_match_result_pass_probability CHECK (pass_probability IS NULL OR pass_probability BETWEEN 0 AND 100),
    ADD CONSTRAINT chk_match_result_has_job_source CHECK (job_id IS NOT NULL OR job_description_id IS NOT NULL),
    ADD INDEX idx_match_cv_generated (cv_id, generated_at);
