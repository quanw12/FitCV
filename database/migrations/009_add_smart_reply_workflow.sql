-- FitCV migration 009
-- Add application-scoped candidate email threads, inbound Smart Reply, and
-- idempotent provider delivery tracking.
-- Target: MySQL 8.0+. DDL auto-commits; back up before applying.

SET @fitcv_smart_reply_prerequisites = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('account', 'company', 'application', 'candidate_email')
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_smart_reply_prerequisites = 4,
    'SELECT ''smart reply prerequisites passed'' AS migration_step',
    'SELECT * FROM `fitcv_009_error_prerequisite_table_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS candidate_email_thread (
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

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'thread_id'
    ),
    'SELECT ''candidate_email.thread_id already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN thread_id BIGINT UNSIGNED NULL AFTER application_id'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'message_kind'
    ),
    'SELECT ''candidate_email.message_kind already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN message_kind ENUM(''Initial'', ''Reply'') NOT NULL DEFAULT ''Initial'' AFTER template_key'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'delivery_status'
    ),
    'SELECT ''candidate_email.delivery_status already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN delivery_status ENUM(''Queued'', ''Sent'', ''Delivered'', ''Delayed'', ''Bounced'', ''Complained'', ''Opened'', ''Clicked'', ''Suppressed'', ''Failed'') NULL AFTER status'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'in_reply_to'
    ),
    'SELECT ''candidate_email.in_reply_to already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN in_reply_to VARCHAR(500) NULL AFTER ai_generated'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'references_json'
    ),
    'SELECT ''candidate_email.references_json already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN references_json JSON NULL AFTER in_reply_to'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'idempotency_key'
    ),
    'SELECT ''candidate_email.idempotency_key already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN idempotency_key VARCHAR(256) NULL AFTER references_json'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

INSERT INTO candidate_email_thread (
    company_id,
    application_id,
    reply_token,
    subject,
    last_message_at
)
SELECT
    company_id,
    application_id,
    UUID(),
    MAX(subject),
    MAX(COALESCE(sent_at, created_at))
FROM candidate_email
GROUP BY company_id, application_id
ON DUPLICATE KEY UPDATE
    subject = COALESCE(candidate_email_thread.subject, VALUES(subject)),
    last_message_at = GREATEST(
        candidate_email_thread.last_message_at,
        VALUES(last_message_at)
    );

UPDATE candidate_email AS email
JOIN candidate_email_thread AS thread
  ON thread.company_id = email.company_id
 AND thread.application_id = email.application_id
SET email.thread_id = thread.thread_id
WHERE email.thread_id IS NULL;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND constraint_name = 'fk_candidate_email_thread'
    ),
    'SELECT ''candidate_email thread FK already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD CONSTRAINT fk_candidate_email_thread FOREIGN KEY (thread_id) REFERENCES candidate_email_thread(thread_id) ON DELETE SET NULL'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND index_name = 'idx_candidate_email_thread_created'
    ),
    'SELECT ''candidate_email thread index already exists'' AS migration_step',
    'CREATE INDEX idx_candidate_email_thread_created ON candidate_email(thread_id, created_at)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND index_name = 'idx_candidate_email_provider'
    ),
    'SELECT ''candidate_email provider index already exists'' AS migration_step',
    'CREATE INDEX idx_candidate_email_provider ON candidate_email(provider_message_id)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND index_name = 'uq_candidate_email_idempotency_key'
    ),
    'SELECT ''candidate_email idempotency key already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD CONSTRAINT uq_candidate_email_idempotency_key UNIQUE (idempotency_key)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS candidate_email_inbound (
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

CREATE TABLE IF NOT EXISTS candidate_email_event (
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

SET @fitcv_smart_reply_table_count = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN (
          'candidate_email_thread',
          'candidate_email_inbound',
          'candidate_email_event'
      )
      AND table_type = 'BASE TABLE'
);
SET @fitcv_smart_reply_column_count = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND (
          (
              table_name = 'candidate_email'
              AND column_name IN (
                  'thread_id', 'message_kind', 'delivery_status',
                  'in_reply_to', 'references_json', 'idempotency_key'
              )
          )
          OR (
              table_name = 'candidate_email_thread'
              AND column_name IN (
                  'thread_id', 'company_id', 'application_id', 'reply_token',
                  'subject', 'last_message_at', 'last_inbound_at',
                  'created_at', 'updated_at'
              )
          )
          OR (
              table_name = 'candidate_email_inbound'
              AND column_name IN (
                  'inbound_id', 'thread_id', 'provider_email_id',
                  'provider_message_id', 'sender_email', 'recipient_email',
                  'subject', 'body_text', 'in_reply_to', 'references_text',
                  'attachments_json', 'is_read', 'received_at', 'created_at'
              )
          )
          OR (
              table_name = 'candidate_email_event'
              AND column_name IN (
                  'email_event_id', 'candidate_email_id', 'provider_event_id',
                  'provider_email_id', 'event_type', 'event_data_json',
                  'occurred_at', 'created_at'
              )
          )
      )
);
SET @fitcv_sql = IF(
    @fitcv_smart_reply_table_count = 3
    AND @fitcv_smart_reply_column_count = 37,
    'SELECT ''smart reply schema passed verification'' AS migration_step',
    'SELECT * FROM `fitcv_009_error_smart_reply_schema_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SELECT table_name, column_name, column_type, is_nullable
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN (
      'candidate_email',
      'candidate_email_thread',
      'candidate_email_inbound',
      'candidate_email_event'
  )
ORDER BY table_name, ordinal_position;
