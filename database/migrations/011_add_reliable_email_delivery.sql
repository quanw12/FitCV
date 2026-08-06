-- FitCV migration 011
-- Track retry classification and provider-attempt metadata for candidate email
-- delivery. Target: MySQL 8.0+. DDL auto-commits; back up before applying.

SET @fitcv_email_prerequisites = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'candidate_email'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_email_prerequisites = 1,
    'SELECT ''reliable email prerequisites passed'' AS migration_step',
    'SELECT * FROM `fitcv_011_error_candidate_email_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'retryable'
    ),
    'SELECT ''candidate_email.retryable already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN retryable BOOLEAN NOT NULL DEFAULT FALSE AFTER idempotency_key'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'retry_count'
    ),
    'SELECT ''candidate_email.retry_count already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN retry_count INT UNSIGNED NOT NULL DEFAULT 0 AFTER retryable'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'last_attempt_at'
    ),
    'SELECT ''candidate_email.last_attempt_at already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN last_attempt_at DATETIME NULL AFTER retry_count'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SELECT column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'candidate_email'
  AND column_name IN ('retryable', 'retry_count', 'last_attempt_at')
ORDER BY ordinal_position;
