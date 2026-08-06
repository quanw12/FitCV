-- Rollback for migration 011. Target: MySQL 8.0+.
ALTER TABLE candidate_email
    DROP COLUMN IF EXISTS last_attempt_at,
    DROP COLUMN IF EXISTS retry_count,
    DROP COLUMN IF EXISTS retryable;
