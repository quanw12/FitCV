-- FitCV migration 005 rollback
-- Use only before application code has started writing archive timestamps or
-- custom weights. This rollback permanently discards those values.
--
-- Run with the target database already selected:
--   mysql --database=<fitcv_database> < database/migrations/005_rollback_job_archiving_and_scoring.sql

SET @fitcv_job_is_base_table = EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'job'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_job_is_base_table,
    'SELECT ''job table passed rollback preflight'' AS rollback_step',
    'SELECT * FROM `fitcv_005_rollback_error_job_table_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND index_name = 'idx_job_public_visibility'
    ),
    'ALTER TABLE `job` DROP INDEX `idx_job_public_visibility`',
    'SELECT ''idx_job_public_visibility already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND index_name = 'idx_job_company_archive_status'
    ),
    'ALTER TABLE `job` DROP INDEX `idx_job_company_archive_status`',
    'SELECT ''idx_job_company_archive_status already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'job'
          AND constraint_name = 'chk_job_weight_total'
    ),
    'ALTER TABLE `job` DROP CHECK `chk_job_weight_total`',
    'SELECT ''chk_job_weight_total already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'job'
          AND constraint_name = 'chk_job_soft_skill_weight'
    ),
    'ALTER TABLE `job` DROP CHECK `chk_job_soft_skill_weight`',
    'SELECT ''chk_job_soft_skill_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'job'
          AND constraint_name = 'chk_job_education_weight'
    ),
    'ALTER TABLE `job` DROP CHECK `chk_job_education_weight`',
    'SELECT ''chk_job_education_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'job'
          AND constraint_name = 'chk_job_experience_weight'
    ),
    'ALTER TABLE `job` DROP CHECK `chk_job_experience_weight`',
    'SELECT ''chk_job_experience_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_schema = DATABASE()
          AND table_name = 'job'
          AND constraint_name = 'chk_job_skill_weight'
    ),
    'ALTER TABLE `job` DROP CHECK `chk_job_skill_weight`',
    'SELECT ''chk_job_skill_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND column_name = 'soft_skill_weight'
    ),
    'ALTER TABLE `job` DROP COLUMN `soft_skill_weight`',
    'SELECT ''soft_skill_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND column_name = 'education_weight'
    ),
    'ALTER TABLE `job` DROP COLUMN `education_weight`',
    'SELECT ''education_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND column_name = 'experience_weight'
    ),
    'ALTER TABLE `job` DROP COLUMN `experience_weight`',
    'SELECT ''experience_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND column_name = 'skill_weight'
    ),
    'ALTER TABLE `job` DROP COLUMN `skill_weight`',
    'SELECT ''skill_weight already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'job'
          AND column_name = 'archived_at'
    ),
    'ALTER TABLE `job` DROP COLUMN `archived_at`',
    'SELECT ''archived_at already absent'' AS rollback_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;
