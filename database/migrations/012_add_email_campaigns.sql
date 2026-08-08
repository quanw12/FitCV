-- FitCV migration 012
-- Add stage-driven candidate email campaigns and record the application stage
-- used to generate each draft.
-- Target: MySQL 8.0+. DDL auto-commits; back up before applying.

SET @fitcv_email_campaign_prerequisites = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name IN ('account', 'company', 'job', 'candidate_email')
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_email_campaign_prerequisites = 4,
    'SELECT ''email campaign prerequisites passed'' AS migration_step',
    'SELECT * FROM `fitcv_012_error_prerequisite_table_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS candidate_email_campaign (
    campaign_id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    company_id            BIGINT UNSIGNED NOT NULL,
    job_id                BIGINT UNSIGNED NULL,
    created_by_account_id BIGINT UNSIGNED NULL,
    template_key          VARCHAR(50) NOT NULL,
    target_stage          VARCHAR(20) NOT NULL,
    recipient_count       INT UNSIGNED NOT NULL DEFAULT 0,
    interview_date        DATE NULL,
    template_json         JSON NOT NULL,
    ai_generated          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_candidate_email_campaign_company
        FOREIGN KEY (company_id) REFERENCES company(company_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_candidate_email_campaign_job
        FOREIGN KEY (job_id) REFERENCES job(job_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_candidate_email_campaign_account
        FOREIGN KEY (created_by_account_id) REFERENCES account(account_id)
        ON DELETE SET NULL,
    INDEX idx_candidate_email_campaign_company_created (company_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND column_name = 'campaign_id'
    ),
    'SELECT ''candidate_email.campaign_id already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN campaign_id BIGINT UNSIGNED NULL AFTER thread_id'
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
    'SELECT ''candidate_email.stage_at_generation already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD COLUMN stage_at_generation VARCHAR(20) NULL AFTER message_kind'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- Pending legacy drafts must receive a stage snapshot; otherwise an old draft
-- could bypass the stale-stage send guard after a pipeline move.
UPDATE candidate_email AS ce
JOIN application AS a ON a.application_id = ce.application_id
SET ce.stage_at_generation = a.current_stage
WHERE ce.stage_at_generation IS NULL
  AND ce.status IN ('Draft', 'Approved', 'Failed');

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND index_name = 'idx_candidate_email_campaign'
    ),
    'SELECT ''candidate_email campaign index already exists'' AS migration_step',
    'CREATE INDEX idx_candidate_email_campaign ON candidate_email(campaign_id)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'candidate_email'
          AND constraint_name = 'fk_candidate_email_campaign'
    ),
    'SELECT ''candidate_email campaign FK already exists'' AS migration_step',
    'ALTER TABLE candidate_email ADD CONSTRAINT fk_candidate_email_campaign FOREIGN KEY (campaign_id) REFERENCES candidate_email_campaign(campaign_id) ON DELETE SET NULL'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_email_campaign_table_count = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'candidate_email_campaign'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_email_campaign_column_count = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND (
          (
              table_name = 'candidate_email_campaign'
              AND column_name IN (
                  'campaign_id', 'company_id', 'job_id',
                  'created_by_account_id', 'template_key', 'target_stage',
                  'recipient_count', 'interview_date', 'template_json',
                  'ai_generated', 'created_at'
              )
          )
          OR (
              table_name = 'candidate_email'
              AND column_name IN ('campaign_id', 'stage_at_generation')
          )
      )
);
SET @fitcv_email_campaign_fk_count = (
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name IN (
          'fk_candidate_email_campaign_company',
          'fk_candidate_email_campaign_job',
          'fk_candidate_email_campaign_account',
          'fk_candidate_email_campaign'
      )
);
SET @fitcv_email_campaign_index_count = (
    SELECT COUNT(DISTINCT CONCAT(table_name, ':', index_name))
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND (
          (
              table_name = 'candidate_email_campaign'
              AND index_name = 'idx_candidate_email_campaign_company_created'
          )
          OR (
              table_name = 'candidate_email'
              AND index_name = 'idx_candidate_email_campaign'
          )
      )
);
SET @fitcv_email_pending_without_stage_count = (
    SELECT COUNT(*)
    FROM candidate_email
    WHERE status IN ('Draft', 'Approved', 'Failed')
      AND stage_at_generation IS NULL
);
SET @fitcv_sql = IF(
    @fitcv_email_campaign_table_count = 1
    AND @fitcv_email_campaign_column_count = 13
    AND @fitcv_email_campaign_fk_count = 4
    AND @fitcv_email_campaign_index_count = 2
    AND @fitcv_email_pending_without_stage_count = 0,
    'SELECT ''email campaign schema passed verification'' AS migration_step',
    'SELECT * FROM `fitcv_012_error_email_campaign_schema_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SELECT table_name, column_name, column_type, is_nullable, column_default
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
