-- FitCV migration 013
-- Persist bulk email delivery jobs and defer inbound message retrieval to the
-- durable worker. Target: MySQL 8.0+.

SET @fitcv_013_prerequisites = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN (
          'account', 'company', 'candidate_email', 'candidate_email_inbound'
      )
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_013_prerequisites = 4,
    'SELECT ''email worker prerequisites passed'' AS migration_step',
    'SELECT * FROM fitcv_013_error_prerequisite_table_missing'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

ALTER TABLE candidate_email
    MODIFY COLUMN status ENUM(
        'Draft', 'Approved', 'Sent', 'Failed', 'Invalidated'
    ) NOT NULL DEFAULT 'Draft';

ALTER TABLE candidate_email_inbound
    MODIFY COLUMN body_text LONGTEXT NULL;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetch_status'
    ),
    'SELECT ''candidate_email_inbound.fetch_status already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetch_status VARCHAR(20) NOT NULL DEFAULT ''Fetched'' AFTER attachments_json'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetch_attempts'
    ),
    'SELECT ''candidate_email_inbound.fetch_attempts already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetch_attempts INT UNSIGNED NOT NULL DEFAULT 0 AFTER fetch_status'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetch_available_at'
    ),
    'SELECT ''candidate_email_inbound.fetch_available_at already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetch_available_at DATETIME NULL AFTER fetch_attempts'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetch_locked_by'
    ),
    'SELECT ''candidate_email_inbound.fetch_locked_by already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetch_locked_by VARCHAR(120) NULL AFTER fetch_available_at'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetch_locked_at'
    ),
    'SELECT ''candidate_email_inbound.fetch_locked_at already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetch_locked_at DATETIME NULL AFTER fetch_locked_by'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetch_error'
    ),
    'SELECT ''candidate_email_inbound.fetch_error already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetch_error VARCHAR(1000) NULL AFTER fetch_locked_at'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND column_name = 'fetched_at'
    ),
    'SELECT ''candidate_email_inbound.fetched_at already exists'' AS migration_step',
    'ALTER TABLE candidate_email_inbound ADD COLUMN fetched_at DATETIME NULL AFTER fetch_error'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

UPDATE candidate_email_inbound
SET fetch_status = 'Fetched'
WHERE fetch_status IS NULL OR fetch_status = '';

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email_inbound'
          AND index_name = 'idx_candidate_email_inbound_fetch_queue'
    ),
    'SELECT ''candidate_email_inbound fetch index already exists'' AS migration_step',
    'CREATE INDEX idx_candidate_email_inbound_fetch_queue ON candidate_email_inbound(fetch_status, fetch_available_at)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS candidate_email_send_job (
    job_id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id            BIGINT UNSIGNED NOT NULL,
    created_by_account_id BIGINT UNSIGNED NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'Queued',
    total_count           INT UNSIGNED NOT NULL DEFAULT 0,
    sent_count            INT UNSIGNED NOT NULL DEFAULT 0,
    failed_count          INT UNSIGNED NOT NULL DEFAULT 0,
    lease_expires_at      DATETIME NULL,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at           DATETIME NULL,

    CONSTRAINT fk_candidate_email_send_job_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_send_job_account
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    INDEX idx_candidate_email_send_job_company_status (company_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS candidate_email_send_job_item (
    job_id        BIGINT UNSIGNED NOT NULL,
    email_id      BIGINT UNSIGNED NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'Queued',
    error_message VARCHAR(1000) NULL,
    attempts      INT UNSIGNED NOT NULL DEFAULT 0,

    PRIMARY KEY (job_id, email_id),
    CONSTRAINT fk_candidate_email_send_job_item_job
        FOREIGN KEY (job_id) REFERENCES candidate_email_send_job(job_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_send_job_item_email
        FOREIGN KEY (email_id) REFERENCES candidate_email(email_id)
        ON DELETE CASCADE,
    INDEX idx_candidate_email_send_job_item_status (job_id, status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SELECT
    (SELECT COUNT(*) FROM candidate_email_send_job) AS send_job_count,
    (SELECT COUNT(*) FROM candidate_email_send_job_item) AS send_job_item_count,
    (SELECT COUNT(*) FROM candidate_email_inbound
        WHERE fetch_status IN ('Pending', 'Fetching', 'Fetched', 'FetchFailed'))
        AS inbound_fetch_status_count;
