-- FitCV migration 006
-- Add recruiter-owned application stage history and notes.
-- Target: MySQL 8.0+. DDL auto-commits; back up before applying.

SET @fitcv_application_exists = EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'application'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_application_exists,
    'SELECT ''application table passed migration preflight'' AS migration_step',
    'SELECT * FROM `fitcv_006_error_application_table_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS application_stage_history (
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

CREATE TABLE IF NOT EXISTS application_note (
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

SET @fitcv_pipeline_column_count = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND (
          (
              table_name = 'application_stage_history'
              AND column_name IN (
                  'stage_history_id', 'application_id', 'previous_stage',
                  'new_stage', 'changed_by_account_id', 'changed_at'
              )
          )
          OR (
              table_name = 'application_note'
              AND column_name IN (
                  'note_id', 'application_id', 'author_account_id',
                  'content', 'created_at', 'updated_at'
              )
          )
      )
);
SET @fitcv_sql = IF(
    @fitcv_pipeline_column_count = 12,
    'SELECT ''pipeline tables passed column verification'' AS migration_step',
    'SELECT * FROM `fitcv_006_error_pipeline_tables_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SELECT table_name, column_name, column_type, is_nullable
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('application_stage_history', 'application_note')
ORDER BY table_name, ordinal_position;
