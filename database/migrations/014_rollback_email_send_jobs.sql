-- Rollback migration 013. DDL auto-commits; back up before applying.

DROP TABLE IF EXISTS candidate_email_send_job_item;
DROP TABLE IF EXISTS candidate_email_send_job;

UPDATE candidate_email
SET status = 'Draft'
WHERE status = 'Invalidated';

ALTER TABLE candidate_email
    MODIFY COLUMN status ENUM(
        'Draft', 'Approved', 'Sent', 'Failed'
    ) NOT NULL DEFAULT 'Draft';

ALTER TABLE candidate_email_inbound
    DROP INDEX IF EXISTS idx_candidate_email_inbound_fetch_queue,
    DROP COLUMN IF EXISTS fetched_at,
    DROP COLUMN IF EXISTS fetch_error,
    DROP COLUMN IF EXISTS fetch_locked_at,
    DROP COLUMN IF EXISTS fetch_locked_by,
    DROP COLUMN IF EXISTS fetch_available_at,
    DROP COLUMN IF EXISTS fetch_attempts,
    DROP COLUMN IF EXISTS fetch_status;

ALTER TABLE candidate_email_inbound
    MODIFY COLUMN body_text LONGTEXT NOT NULL;
