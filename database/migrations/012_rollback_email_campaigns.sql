-- FitCV migration 012 rollback
-- This permanently removes campaign metadata. Existing candidate email drafts
-- remain, but their campaign and generation-stage links are removed.

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND constraint_name = 'fk_candidate_email_campaign'
    ),
    'ALTER TABLE candidate_email DROP FOREIGN KEY fk_candidate_email_campaign',
    'SELECT ''candidate_email campaign FK already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND index_name = 'idx_candidate_email_campaign'
    ),
    'ALTER TABLE candidate_email DROP INDEX idx_candidate_email_campaign',
    'SELECT ''candidate_email campaign index already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'stage_at_generation'
    ),
    'ALTER TABLE candidate_email DROP COLUMN stage_at_generation',
    'SELECT ''candidate_email.stage_at_generation already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'campaign_id'
    ),
    'ALTER TABLE candidate_email DROP COLUMN campaign_id',
    'SELECT ''candidate_email.campaign_id already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

DROP TABLE IF EXISTS candidate_email_campaign;

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
      table_name = 'candidate_email_campaign'
      OR (
          table_name = 'candidate_email'
          AND column_name IN ('campaign_id', 'stage_at_generation')
      )
  )
ORDER BY table_name, ordinal_position;
