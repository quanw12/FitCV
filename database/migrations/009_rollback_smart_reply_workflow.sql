-- FitCV migration 009 rollback
-- This permanently removes inbound messages and delivery-event history.
-- Existing candidate email drafts remain, but Smart Reply metadata is removed.

DROP TABLE IF EXISTS candidate_email_event;
DROP TABLE IF EXISTS candidate_email_inbound;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND constraint_name = 'fk_candidate_email_thread'
    ),
    'ALTER TABLE candidate_email DROP FOREIGN KEY fk_candidate_email_thread',
    'SELECT ''candidate_email thread FK already absent'' AS rollback_step'
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
    'ALTER TABLE candidate_email DROP INDEX idx_candidate_email_thread_created',
    'SELECT ''candidate_email thread index already absent'' AS rollback_step'
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
    'ALTER TABLE candidate_email DROP INDEX idx_candidate_email_provider',
    'SELECT ''candidate_email provider index already absent'' AS rollback_step'
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
    'ALTER TABLE candidate_email DROP INDEX uq_candidate_email_idempotency_key',
    'SELECT ''candidate_email idempotency key already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name IN (
              'thread_id', 'message_kind', 'delivery_status',
              'in_reply_to', 'references_json', 'idempotency_key'
          )
    ),
    'ALTER TABLE candidate_email DROP COLUMN thread_id, DROP COLUMN message_kind, DROP COLUMN delivery_status, DROP COLUMN in_reply_to, DROP COLUMN references_json, DROP COLUMN idempotency_key',
    'SELECT ''candidate_email Smart Reply columns already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

DROP TABLE IF EXISTS candidate_email_thread;
