-- FitCV Database Schema v2
-- Target database: MySQL 8.0+
-- Notes:
-- - This version is for the team's final MySQL decision.
-- - Authentication is handled by the application, so account.password_hash is included.
-- - Use utf8mb4 for Vietnamese and multilingual text support.

USE railway;

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

CREATE TABLE auth_session (
    session_id         CHAR(36) PRIMARY KEY,
    account_id         BIGINT UNSIGNED NOT NULL,
    refresh_token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at         DATETIME NOT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at       DATETIME NULL,
    revoked_at         DATETIME NULL,
    revoke_reason      VARCHAR(50) NULL,

    CONSTRAINT fk_auth_session_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    INDEX idx_auth_session_account_active (account_id, revoked_at, expires_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE auth_rate_limit (
    key_hash          CHAR(64) PRIMARY KEY,
    action            VARCHAR(40) NOT NULL,
    attempt_count     INT UNSIGNED NOT NULL DEFAULT 0,
    window_started_at DATETIME NOT NULL,
    blocked_until     DATETIME NULL,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
    file_sha256   CHAR(64) NULL,
    version_number INT UNSIGNED NOT NULL DEFAULT 1,
    is_latest     BOOLEAN NOT NULL DEFAULT TRUE,
    uploaded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cv_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_cv_candidate
        FOREIGN KEY (candidate_id) REFERENCES candidate(candidate_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_cv_has_owner
        CHECK (account_id IS NOT NULL OR candidate_id IS NOT NULL),
    CONSTRAINT uq_cv_account_version
        UNIQUE (account_id, version_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE cv_parse_result (
    cv_parse_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    cv_id          BIGINT UNSIGNED NOT NULL,
    parsed_text    LONGTEXT NULL,
    parsed_json    JSON NULL,
    parse_status   ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    parser_version VARCHAR(50) NOT NULL DEFAULT 'fitcv-parser-v1',
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
    archived_at            DATETIME NULL,
    skill_weight           DECIMAL(5,2) NOT NULL DEFAULT 45.00,
    experience_weight      DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    education_weight       DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    soft_skill_weight      DECIMAL(5,2) NOT NULL DEFAULT 10.00,
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
        ON DELETE SET NULL,
    CONSTRAINT chk_job_skill_weight
        CHECK (skill_weight BETWEEN 0 AND 100),
    CONSTRAINT chk_job_experience_weight
        CHECK (experience_weight BETWEEN 0 AND 100),
    CONSTRAINT chk_job_education_weight
        CHECK (education_weight BETWEEN 0 AND 100),
    CONSTRAINT chk_job_soft_skill_weight
        CHECK (soft_skill_weight BETWEEN 0 AND 100),
    CONSTRAINT chk_job_weight_total
        CHECK (
            skill_weight + experience_weight + education_weight + soft_skill_weight = 100
        )
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

CREATE TABLE job_description (
    job_description_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    account_id         BIGINT UNSIGNED NOT NULL,
    job_id             BIGINT UNSIGNED NULL,
    title              VARCHAR(200) NOT NULL DEFAULT 'Pasted job description',
    source_type        ENUM('PastedText', 'UploadedFile', 'Job') NOT NULL DEFAULT 'PastedText',
    raw_text           LONGTEXT NOT NULL,
    content_sha256     CHAR(64) NOT NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_job_description_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_job_description_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE jd_parse_result (
    jd_parse_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    job_description_id BIGINT UNSIGNED NOT NULL,
    parsed_json        JSON NULL,
    parse_status       ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    parser_version     VARCHAR(50) NOT NULL DEFAULT 'fitcv-parser-v1',
    error_message      VARCHAR(500) NULL,
    parsed_at          DATETIME NULL,

    CONSTRAINT fk_jd_parse_description
        FOREIGN KEY (job_description_id) REFERENCES job_description(job_description_id)
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

CREATE TABLE application_stage_history (
    stage_history_id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    application_id       BIGINT UNSIGNED NOT NULL,
    previous_stage       ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected') NULL,
    new_stage            ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected') NOT NULL,
    changed_by_account_id BIGINT UNSIGNED NULL,
    changed_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_application_stage_history_application
        FOREIGN KEY (application_id) REFERENCES application(application_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_application_stage_history_account
        FOREIGN KEY (changed_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    INDEX idx_application_stage_history_application_changed (application_id, changed_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE application_note (
    note_id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    application_id   BIGINT UNSIGNED NOT NULL,
    author_account_id BIGINT UNSIGNED NULL,
    content           TEXT NOT NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_application_note_application
        FOREIGN KEY (application_id) REFERENCES application(application_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_application_note_account
        FOREIGN KEY (author_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    INDEX idx_application_note_application_created (application_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE candidate_email_thread (
    thread_id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id      BIGINT UNSIGNED NOT NULL,
    application_id  BIGINT UNSIGNED NOT NULL,
    reply_token     CHAR(36) NOT NULL,
    subject         VARCHAR(300) NULL,
    last_message_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_inbound_at DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_email_thread_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_thread_application
        FOREIGN KEY (application_id) REFERENCES application(application_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_candidate_email_thread_company_application
        UNIQUE (company_id, application_id),
    CONSTRAINT uq_candidate_email_thread_reply_token
        UNIQUE (reply_token),
    INDEX idx_candidate_email_thread_company_activity (company_id, last_message_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE candidate_email_campaign (
    campaign_id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id            BIGINT UNSIGNED NOT NULL,
    job_id                BIGINT UNSIGNED NULL,
    created_by_account_id BIGINT UNSIGNED NULL,
    template_key          VARCHAR(50) NOT NULL,
    target_stage          VARCHAR(20) NOT NULL,
    recipient_count       INT UNSIGNED NOT NULL DEFAULT 0,
    interview_date        DATE NULL,
    template_json         JSON NOT NULL,
    ai_generated          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_email_campaign_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_campaign_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_email_campaign_account
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    INDEX idx_candidate_email_campaign_company_created (company_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE candidate_email (
    email_id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id              BIGINT UNSIGNED NOT NULL,
    application_id          BIGINT UNSIGNED NOT NULL,
    thread_id               BIGINT UNSIGNED NULL,
    campaign_id             BIGINT UNSIGNED NULL,
    template_key            VARCHAR(50) NOT NULL,
    message_kind            ENUM('Initial', 'Reply') NOT NULL DEFAULT 'Initial',
    stage_at_generation     VARCHAR(20) NULL,
    recipient_email         VARCHAR(150) NOT NULL,
    subject                 VARCHAR(300) NOT NULL,
    body                    LONGTEXT NOT NULL,
    status                  ENUM('Draft', 'Approved', 'Sent', 'Failed') NOT NULL DEFAULT 'Draft',
    delivery_status         ENUM(
                                'Queued', 'Sent', 'Delivered', 'Delayed',
                                'Bounced', 'Complained', 'Opened', 'Clicked',
                                'Suppressed', 'Failed'
                            ) NULL,
    ai_generated            BOOLEAN NOT NULL DEFAULT TRUE,
    in_reply_to             VARCHAR(500) NULL,
    references_json         JSON NULL,
    idempotency_key         VARCHAR(256) NULL,
    retryable               BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count             INT UNSIGNED NOT NULL DEFAULT 0,
    last_attempt_at         DATETIME NULL,
    created_by_account_id   BIGINT UNSIGNED NULL,
    approved_by_account_id  BIGINT UNSIGNED NULL,
    approved_at             DATETIME NULL,
    provider_message_id     VARCHAR(200) NULL,
    error_message           VARCHAR(1000) NULL,
    sent_at                 DATETIME NULL,
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_email_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_application
        FOREIGN KEY (application_id) REFERENCES application(application_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_thread
        FOREIGN KEY (thread_id) REFERENCES candidate_email_thread(thread_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_email_campaign
        FOREIGN KEY (campaign_id) REFERENCES candidate_email_campaign(campaign_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_email_creator
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_email_approver
        FOREIGN KEY (approved_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    CONSTRAINT uq_candidate_email_idempotency_key
        UNIQUE (idempotency_key),
    INDEX idx_candidate_email_company_status (company_id, status),
    INDEX idx_candidate_email_application_created (application_id, created_at),
    INDEX idx_candidate_email_thread_created (thread_id, created_at),
    INDEX idx_candidate_email_campaign (campaign_id),
    INDEX idx_candidate_email_provider (provider_message_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE candidate_email_inbound (
    inbound_id          BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    thread_id           BIGINT UNSIGNED NOT NULL,
    provider_email_id   VARCHAR(200) NOT NULL,
    provider_message_id VARCHAR(500) NULL,
    sender_email        VARCHAR(150) NOT NULL,
    recipient_email     VARCHAR(150) NOT NULL,
    subject             VARCHAR(300) NOT NULL,
    body_text           LONGTEXT NOT NULL,
    in_reply_to         VARCHAR(500) NULL,
    references_text     LONGTEXT NULL,
    attachments_json    JSON NULL,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    received_at         DATETIME NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_email_inbound_thread
        FOREIGN KEY (thread_id) REFERENCES candidate_email_thread(thread_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_candidate_email_inbound_provider_email
        UNIQUE (provider_email_id),
    INDEX idx_candidate_email_inbound_thread_received (thread_id, received_at),
    INDEX idx_candidate_email_inbound_thread_unread (thread_id, is_read)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE candidate_email_event (
    email_event_id       BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    candidate_email_id   BIGINT UNSIGNED NULL,
    provider_event_id    VARCHAR(200) NOT NULL,
    provider_email_id    VARCHAR(200) NULL,
    event_type           VARCHAR(50) NOT NULL,
    event_data_json      JSON NULL,
    occurred_at          DATETIME NOT NULL,
    created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_email_event_email
        FOREIGN KEY (candidate_email_id) REFERENCES candidate_email(email_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_candidate_email_event_provider_event
        UNIQUE (provider_event_id),
    INDEX idx_candidate_email_event_email_occurred (candidate_email_id, occurred_at),
    INDEX idx_candidate_email_event_provider_email (provider_email_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Student-owned applications tracked outside FitCV's recruiter pipeline.
-- Kept separate from `application`, whose candidate/job/CV foreign keys model
-- applications submitted to jobs managed inside FitCV.
CREATE TABLE tracked_application (
    tracked_application_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    account_id             BIGINT UNSIGNED NOT NULL,
    company_name           VARCHAR(200) NOT NULL,
    position_title         VARCHAR(200) NOT NULL,
    applied_on             DATE NOT NULL,
    source                 VARCHAR(50) NOT NULL,
    status                 ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected') NOT NULL DEFAULT 'Applied',
    job_url                VARCHAR(500) NULL,
    reminder_at            DATETIME NULL,
    last_activity_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE tracked_application_note (
    note_id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tracked_application_id BIGINT UNSIGNED NOT NULL,
    content                TEXT NOT NULL,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_note_application
        FOREIGN KEY (tracked_application_id) REFERENCES tracked_application(tracked_application_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE tracked_application_status_history (
    status_history_id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tracked_application_id BIGINT UNSIGNED NOT NULL,
    previous_status        ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected') NULL,
    new_status             ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected') NOT NULL,
    changed_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_history_application
        FOREIGN KEY (tracked_application_id) REFERENCES tracked_application(tracked_application_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE tracked_application_notification (
    notification_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tracked_application_id BIGINT UNSIGNED NOT NULL,
    account_id             BIGINT UNSIGNED NOT NULL,
    status_history_id      BIGINT UNSIGNED NULL UNIQUE,
    event_type             VARCHAR(40) NOT NULL,
    title                  VARCHAR(150) NOT NULL,
    message                VARCHAR(500) NOT NULL,
    read_at                DATETIME NULL,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_notification_application
        FOREIGN KEY (tracked_application_id) REFERENCES tracked_application(tracked_application_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tracked_application_notification_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tracked_application_notification_history
        FOREIGN KEY (status_history_id) REFERENCES tracked_application_status_history(status_history_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE hr_screening_batch (
    screening_batch_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id            BIGINT UNSIGNED NOT NULL,
    created_by_account_id BIGINT UNSIGNED NOT NULL,
    title                 VARCHAR(200) NOT NULL,
    job_description       LONGTEXT NOT NULL,
    status                ENUM('Pending', 'Processing', 'Completed', 'Partial', 'Failed') NOT NULL DEFAULT 'Pending',
    required_skills_json  JSON NULL,
    preferred_skills_json JSON NULL,
    warnings_json         JSON NULL,
    total_files           INT UNSIGNED NOT NULL,
    processed_count       INT UNSIGNED NOT NULL DEFAULT 0,
    selected_count        INT UNSIGNED NOT NULL DEFAULT 0,
    error_message         VARCHAR(1000) NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    completed_at          DATETIME NULL,

    CONSTRAINT fk_screening_batch_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_screening_batch_creator
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE RESTRICT,
    INDEX idx_screening_batch_company_created (company_id, created_at),
    INDEX idx_screening_batch_company_status (company_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE hr_screening_candidate (
    screening_candidate_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    screening_batch_id     BIGINT UNSIGNED NOT NULL,
    source_index           INT UNSIGNED NOT NULL,
    candidate_key          CHAR(64) NOT NULL,
    file_name              VARCHAR(255) NOT NULL,
    file_path              VARCHAR(400) NOT NULL,
    file_type              ENUM('PDF', 'DOCX') NOT NULL,
    file_size_kb           INT UNSIGNED NOT NULL,
    file_sha256            CHAR(64) NOT NULL,
    name                   VARCHAR(150) NULL,
    email                  VARCHAR(150) NULL,
    phone                  VARCHAR(30) NULL,
    location               VARCHAR(200) NULL,
    position               VARCHAR(150) NULL,
    parsed_text            LONGTEXT NULL,
    parsed_json            JSON NULL,
    skills_json            JSON NULL,
    matched_skills_json    JSON NULL,
    missing_skills_json    JSON NULL,
    experience_years       DECIMAL(5,2) NULL,
    education              LONGTEXT NULL,
    score                  DECIMAL(5,2) NULL,
    match_label            VARCHAR(30) NULL,
    score_breakdown_json   JSON NULL,
    strengths_json         JSON NULL,
    weaknesses_json        JSON NULL,
    parse_notes_json       JSON NULL,
    status                 ENUM('Pending', 'Ready', 'Failed') NOT NULL DEFAULT 'Pending',
    error_message          VARCHAR(1000) NULL,
    is_selected            BOOLEAN NOT NULL DEFAULT FALSE,
    is_confirmed           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_screening_candidate_batch
        FOREIGN KEY (screening_batch_id) REFERENCES hr_screening_batch(screening_batch_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_screening_candidate_source
        UNIQUE (screening_batch_id, source_index),
    INDEX idx_screening_candidate_batch_score (screening_batch_id, score),
    INDEX idx_screening_candidate_batch_selected (screening_batch_id, is_selected)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE match_result (
    match_result_id   BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    cv_id             BIGINT UNSIGNED NOT NULL,
    job_id            BIGINT UNSIGNED NULL,
    job_description_id BIGINT UNSIGNED NULL,
    cv_parse_id       BIGINT UNSIGNED NULL,
    jd_parse_id       BIGINT UNSIGNED NULL,
    application_id    BIGINT UNSIGNED NULL,
    status            ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    overall_score     DECIMAL(5,2) NULL,
    skill_score       DECIMAL(5,2) NULL,
    experience_score  DECIMAL(5,2) NULL,
    education_score   DECIMAL(5,2) NULL,
    soft_skill_score  DECIMAL(5,2) NULL,
    pass_probability  DECIMAL(5,2) NULL,
    match_label       VARCHAR(30) NULL,
    evidence_json     JSON NULL,
    match_summary     LONGTEXT NULL,
    strengths         LONGTEXT NULL,
    weaknesses        LONGTEXT NULL,
    recommendation    LONGTEXT NULL,
    algorithm_version VARCHAR(50) NOT NULL DEFAULT 'fitcv-evidence-v2',
    model_name        VARCHAR(100) NULL,
    error_message     VARCHAR(1000) NULL,
    generated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at      DATETIME NULL,

    CONSTRAINT fk_match_result_cv
        FOREIGN KEY (cv_id) REFERENCES cv(cv_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_job_description
        FOREIGN KEY (job_description_id) REFERENCES job_description(job_description_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_cv_parse
        FOREIGN KEY (cv_parse_id) REFERENCES cv_parse_result(cv_parse_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_jd_parse
        FOREIGN KEY (jd_parse_id) REFERENCES jd_parse_result(jd_parse_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_match_result_application
        FOREIGN KEY (application_id) REFERENCES application(application_id)
        ON DELETE SET NULL,
    CONSTRAINT chk_match_result_overall_score
        CHECK (overall_score IS NULL OR overall_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_skill_score
        CHECK (skill_score IS NULL OR skill_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_experience_score
        CHECK (experience_score IS NULL OR experience_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_education_score
        CHECK (education_score IS NULL OR education_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_soft_skill_score
        CHECK (soft_skill_score IS NULL OR soft_skill_score BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_pass_probability
        CHECK (pass_probability IS NULL OR pass_probability BETWEEN 0 AND 100),
    CONSTRAINT chk_match_result_has_job_source
        CHECK (job_id IS NOT NULL OR job_description_id IS NOT NULL),
    CONSTRAINT uq_match_exact_versions
        UNIQUE (cv_parse_id, jd_parse_id, algorithm_version)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE cv_improvement_suggestion (
    suggestion_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    match_result_id  BIGINT UNSIGNED NOT NULL,
    suggestion_type  ENUM('SkillGap', 'SectionFeedback', 'Rewrite', 'QuickWin') NOT NULL,
    category         ENUM('Skill', 'Experience', 'Education', 'Keyword', 'Format', 'Other') NOT NULL,
    section          VARCHAR(50) NULL,
    original_text    LONGTEXT NULL,
    suggested_text   LONGTEXT NULL,
    explanation      LONGTEXT NULL,
    priority         ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
    sort_order       INT NOT NULL DEFAULT 0,
    metadata_json    JSON NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cv_improvement_suggestion_match_result
        FOREIGN KEY (match_result_id) REFERENCES match_result(match_result_id)
        ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE ai_task (
    ai_task_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    task_type     VARCHAR(50) NOT NULL,
    resource_id   BIGINT UNSIGNED NOT NULL,
    owner_account_id BIGINT UNSIGNED NULL,
    company_id    BIGINT UNSIGNED NULL,
    status        ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    provider      VARCHAR(50) NULL,
    model_name    VARCHAR(100) NULL,
    payload_json  JSON NULL,
    idempotency_key VARCHAR(120) NULL UNIQUE,
    attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts  INT UNSIGNED NOT NULL DEFAULT 3,
    available_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_by     VARCHAR(100) NULL,
    heartbeat_at  DATETIME NULL,
    error_message VARCHAR(1000) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    started_at    DATETIME NULL,
    completed_at  DATETIME NULL,

    CONSTRAINT fk_ai_task_owner
        FOREIGN KEY (owner_account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_ai_task_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    INDEX idx_ai_task_resource (task_type, resource_id, created_at),
    INDEX idx_ai_task_claim (status, available_at, created_at),
    INDEX idx_ai_task_owner_created (owner_account_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Lưu lịch sử bất biến cho từng lần xử lý AI thất bại.
-- Thành công ở lần thử sau không xóa các lỗi đã ghi nhận trước đó.
CREATE TABLE ai_task_attempt_history (
    ai_task_attempt_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    ai_task_id         BIGINT UNSIGNED NOT NULL,
    attempt_number     INT UNSIGNED NOT NULL,
    outcome            ENUM('RetryScheduled', 'TerminalFailure', 'StaleRecovery') NOT NULL,
    error_message      VARCHAR(1000) NOT NULL,
    failed_at          DATETIME NOT NULL,

    CONSTRAINT fk_ai_task_attempt_task
        FOREIGN KEY (ai_task_id) REFERENCES ai_task(ai_task_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_ai_task_attempt_number
        UNIQUE (ai_task_id, attempt_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_account_company_id ON account(company_id);
CREATE INDEX idx_account_role ON account(role);
CREATE INDEX idx_account_reset_token_hash ON account(reset_token_hash);
CREATE INDEX idx_candidate_account_id ON candidate(account_id);
CREATE INDEX idx_candidate_created_by_hr ON candidate(created_by_hr_account_id);
CREATE INDEX idx_cv_account_id ON cv(account_id);
CREATE INDEX idx_cv_account_latest ON cv(account_id, is_latest, uploaded_at);
CREATE INDEX idx_cv_candidate_id ON cv(candidate_id);
CREATE INDEX idx_cv_parse_result_cv_id ON cv_parse_result(cv_id);
CREATE INDEX idx_job_company_id ON job(company_id);
CREATE INDEX idx_job_created_by_account_id ON job(created_by_account_id);
CREATE INDEX idx_job_company_archive_status ON job(company_id, archived_at, status);
CREATE INDEX idx_job_public_visibility ON job(status, archived_at, deadline);
CREATE INDEX idx_job_description_account_created ON job_description(account_id, created_at);
CREATE INDEX idx_job_description_account_hash ON job_description(account_id, content_sha256);
CREATE INDEX idx_jd_parse_description ON jd_parse_result(job_description_id, jd_parse_id);
CREATE INDEX idx_application_candidate_id ON application(candidate_id);
CREATE INDEX idx_application_job_id ON application(job_id);
CREATE INDEX idx_tracked_application_account_date ON tracked_application(account_id, applied_on);
CREATE INDEX idx_tracked_application_account_status ON tracked_application(account_id, status);
CREATE INDEX idx_tracked_application_reminder ON tracked_application(account_id, reminder_at);
CREATE INDEX idx_tracked_application_note_application ON tracked_application_note(tracked_application_id, created_at);
CREATE INDEX idx_tracked_application_history_application ON tracked_application_status_history(tracked_application_id, changed_at);
CREATE INDEX idx_tracked_application_notification_application_created ON tracked_application_notification(tracked_application_id, created_at);
CREATE INDEX idx_tracked_application_notification_account_read ON tracked_application_notification(account_id, read_at);
CREATE INDEX idx_match_result_cv_job ON match_result(cv_id, job_id);
CREATE INDEX idx_match_cv_generated ON match_result(cv_id, generated_at);
CREATE INDEX idx_cv_improvement_suggestion_match_result_id ON cv_improvement_suggestion(match_result_id);
CREATE INDEX idx_suggestion_match_type_order ON cv_improvement_suggestion(match_result_id, suggestion_type, sort_order);
