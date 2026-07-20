-- Adds the Student Application Tracker without changing the recruiter pipeline table.

USE fitcv;

CREATE TABLE IF NOT EXISTS tracked_application (
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
        ON DELETE CASCADE,
    INDEX idx_tracked_application_account_date (account_id, applied_on),
    INDEX idx_tracked_application_account_status (account_id, status),
    INDEX idx_tracked_application_reminder (account_id, reminder_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tracked_application_note (
    note_id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tracked_application_id BIGINT UNSIGNED NOT NULL,
    content                TEXT NOT NULL,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_note_application
        FOREIGN KEY (tracked_application_id) REFERENCES tracked_application(tracked_application_id)
        ON DELETE CASCADE,
    INDEX idx_tracked_application_note_application (tracked_application_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tracked_application_status_history (
    status_history_id      BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tracked_application_id BIGINT UNSIGNED NOT NULL,
    previous_status        ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected') NULL,
    new_status             ENUM('Applied', 'Screening', 'Interview', 'Offer', 'Rejected') NOT NULL,
    changed_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_history_application
        FOREIGN KEY (tracked_application_id) REFERENCES tracked_application(tracked_application_id)
        ON DELETE CASCADE,
    INDEX idx_tracked_application_history_application (tracked_application_id, changed_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
