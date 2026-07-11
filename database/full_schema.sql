-- FitCV Database Schema v2
-- Target database: MySQL 8.0+
-- Notes:
-- - This version is for the team's final MySQL decision.
-- - Authentication is handled by the application, so account.password_hash is included.
-- - Use utf8mb4 for Vietnamese and multilingual text support.

CREATE DATABASE IF NOT EXISTS fitcv
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE fitcv;

CREATE TABLE industry (
    industry_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    industry_name  VARCHAR(100) NOT NULL UNIQUE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE company (
    company_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_name  VARCHAR(200) NOT NULL,
    industry_id   BIGINT UNSIGNED NULL,
    website_url   VARCHAR(300) NULL,
    logo_url      VARCHAR(400) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_company_industry
        FOREIGN KEY (industry_id) REFERENCES industry(industry_id)
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE account (
    account_id     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    email          VARCHAR(150) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NULL,
    full_name      VARCHAR(150) NOT NULL,
    role           ENUM('Student', 'HR', 'HiringManager', 'Admin') NULL,
    avatar_url     VARCHAR(400) NULL,
    company_id     BIGINT UNSIGNED NULL,
    auth_provider  ENUM('Password', 'Google') NOT NULL DEFAULT 'Password',
    reset_token_hash VARCHAR(255) NULL,
    reset_token_expires_at DATETIME NULL,
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_account_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE `position` (
    position_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    abbreviation  VARCHAR(20) NOT NULL UNIQUE,
    full_name     VARCHAR(100) NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE level (
    level_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    level_name  VARCHAR(50) NOT NULL UNIQUE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE candidate (
    candidate_id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    account_id                BIGINT UNSIGNED NULL,
    full_name                 VARCHAR(150) NULL,
    email                     VARCHAR(150) NULL,
    phone                     VARCHAR(30) NULL,
    created_by_hr_account_id  BIGINT UNSIGNED NULL,
    created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_created_by_hr
        FOREIGN KEY (created_by_hr_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE cv (
    cv_id         BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    account_id    BIGINT UNSIGNED NULL,
    candidate_id  BIGINT UNSIGNED NULL,
    file_name     VARCHAR(255) NOT NULL,
    file_path     VARCHAR(400) NOT NULL,
    file_type     ENUM('PDF', 'DOCX') NOT NULL,
    file_size_kb  INT UNSIGNED NULL,
    is_latest     BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cv_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_cv_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_cv_has_owner
        CHECK (account_id IS NOT NULL OR candidate_id IS NOT NULL)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE cv_parse_result (
    cv_parse_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    cv_id          BIGINT UNSIGNED NOT NULL,
    parsed_text    LONGTEXT NULL,
    parsed_json    JSON NULL,
    parse_status   ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    error_message  VARCHAR(500) NULL,
    parsed_at      DATETIME NULL,

    CONSTRAINT fk_cv_parse_result_cv
        FOREIGN KEY (cv_id) REFERENCES cv(cv_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE job (
    job_id                 BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id             BIGINT UNSIGNED NOT NULL,
    created_by_account_id  BIGINT UNSIGNED NOT NULL,
    position_id            BIGINT UNSIGNED NULL,
    level_id               BIGINT UNSIGNED NULL,
    title                  VARCHAR(200) NOT NULL,
    description            LONGTEXT NULL,
    requirements           LONGTEXT NULL,
    location               VARCHAR(150) NULL,
    employment_type        VARCHAR(50) NULL,
    status                 ENUM('Draft', 'Published', 'Closed') NOT NULL DEFAULT 'Draft',
    deadline               DATETIME NULL,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_job_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_job_created_by_account
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_job_position
        FOREIGN KEY (position_id) REFERENCES `position`(position_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_job_level
        FOREIGN KEY (level_id) REFERENCES level(level_id)
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE job_hr (
    job_id         BIGINT UNSIGNED NOT NULL,
    hr_account_id  BIGINT UNSIGNED NOT NULL,
    role_type      VARCHAR(50) NULL,

    PRIMARY KEY (job_id, hr_account_id),
    CONSTRAINT fk_job_hr_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_job_hr_account
        FOREIGN KEY (hr_account_id) REFERENCES account(account_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE application (
    application_id  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    candidate_id    BIGINT UNSIGNED NOT NULL,
    job_id          BIGINT UNSIGNED NOT NULL,
    cv_id           BIGINT UNSIGNED NOT NULL,
    current_stage   ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected') NOT NULL DEFAULT 'Applied',
    status          ENUM('Active', 'Withdrawn', 'Rejected', 'Hired') NOT NULL DEFAULT 'Active',
    applied_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_application_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_application_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_application_cv
        FOREIGN KEY (cv_id) REFERENCES cv(cv_id)
        ON DELETE RESTRICT
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE match_result (
    match_result_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    cv_id             BIGINT UNSIGNED NOT NULL,
    job_id            BIGINT UNSIGNED NOT NULL,
    application_id    BIGINT UNSIGNED NULL,
    overall_score     DECIMAL(5,2) NOT NULL,
    skill_score       DECIMAL(5,2) NULL,
    experience_score  DECIMAL(5,2) NULL,
    education_score   DECIMAL(5,2) NULL,
    soft_skill_score  DECIMAL(5,2) NULL,
    match_summary     LONGTEXT NULL,
    strengths         LONGTEXT NULL,
    weaknesses        LONGTEXT NULL,
    recommendation    LONGTEXT NULL,
    model_name        VARCHAR(100) NULL,
    generated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_match_result_cv
        FOREIGN KEY (cv_id) REFERENCES cv(cv_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_application
        FOREIGN KEY (application_id) REFERENCES application(application_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_match_result_overall_score
        CHECK (overall_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_skill_score
        CHECK (skill_score IS NULL OR skill_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_experience_score
        CHECK (experience_score IS NULL OR experience_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_education_score
        CHECK (education_score IS NULL OR education_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_soft_skill_score
        CHECK (soft_skill_score IS NULL OR soft_skill_score BETWEEN 0 AND 100)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE cv_improvement_suggestion (
    suggestion_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    match_result_id  BIGINT UNSIGNED NOT NULL,
    category         ENUM('Skill', 'Experience', 'Education', 'Keyword', 'Format', 'Other') NOT NULL,
    original_text    LONGTEXT NULL,
    suggested_text   LONGTEXT NULL,
    explanation      LONGTEXT NULL,
    priority         ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cv_improvement_suggestion_match_result
        FOREIGN KEY (match_result_id) REFERENCES match_result(match_result_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_account_company_id ON account(company_id);
CREATE INDEX idx_account_role ON account(role);
CREATE INDEX idx_account_reset_token_hash ON account(reset_token_hash);
CREATE INDEX idx_candidate_account_id ON candidate(account_id);
CREATE INDEX idx_candidate_created_by_hr ON candidate(created_by_hr_account_id);
CREATE INDEX idx_cv_account_id ON cv(account_id);
CREATE INDEX idx_cv_candidate_id ON cv(candidate_id);
CREATE INDEX idx_cv_parse_result_cv_id ON cv_parse_result(cv_id);
CREATE INDEX idx_job_company_id ON job(company_id);
CREATE INDEX idx_job_created_by_account_id ON job(created_by_account_id);
CREATE INDEX idx_application_candidate_id ON application(candidate_id);
CREATE INDEX idx_application_job_id ON application(job_id);
CREATE INDEX idx_match_result_cv_job ON match_result(cv_id, job_id);
CREATE INDEX idx_cv_improvement_suggestion_match_result_id ON cv_improvement_suggestion(match_result_id);
