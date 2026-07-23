-- FitCV migration 007
-- Persist review-first AI candidate emails and provider delivery tracking.
-- Target: MySQL 8.0+. DDL auto-commits; back up before applying.

SET @fitcv_email_prerequisites = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('account', 'company', 'application')
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_email_prerequisites = 3,
    'SELECT ''candidate email prerequisites passed'' AS migration_step',
    'SELECT * FROM `fitcv_007_error_prerequisite_table_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS candidate_email (
    email_id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id              BIGINT UNSIGNED NOT NULL,
    application_id          BIGINT UNSIGNED NOT NULL,
    template_key            VARCHAR(50) NOT NULL,
    recipient_email         VARCHAR(150) NOT NULL,
    subject                 VARCHAR(300) NOT NULL,
    body                    LONGTEXT NOT NULL,
    status                  ENUM('Draft', 'Approved', 'Sent', 'Failed') NOT NULL DEFAULT 'Draft',
    ai_generated            BOOLEAN NOT NULL DEFAULT TRUE,
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
    CONSTRAINT fk_candidate_email_creator
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_email_approver
        FOREIGN KEY (approved_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    INDEX idx_candidate_email_company_status (company_id, status),
    INDEX idx_candidate_email_application_created (application_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET @fitcv_candidate_email_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'candidate_email'
      AND column_name IN (
          'email_id', 'company_id', 'application_id', 'template_key',
          'recipient_email', 'subject', 'body', 'status', 'ai_generated',
          'created_by_account_id', 'approved_by_account_id', 'approved_at',
          'provider_message_id', 'error_message', 'sent_at', 'created_at',
          'updated_at'
      )
);
SET @fitcv_sql = IF(
    @fitcv_candidate_email_columns = 17,
    'SELECT ''candidate_email passed column verification'' AS migration_step',
    'SELECT * FROM `fitcv_007_error_candidate_email_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'candidate_email'
ORDER BY ordinal_position;
