-- FitCV migration 005
-- Add independent job archiving and four-category scoring weights.
-- Target: MySQL 8.0+.
--
-- Run this file with the target database already selected, for example:
--   mysql --database=<fitcv_database> < database/migrations/005_add_job_archiving_and_scoring.sql
--
-- This is a backward-compatible expand migration. Existing jobs receive the
-- canonical 45/30/15/10 weights, and archived_at remains NULL. MySQL DDL
-- auto-commits, so back up the database and schedule the ALTER statements
-- during a low-traffic window.

SET @fitcv_job_is_base_table = EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'job'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_job_is_base_table,
    'SELECT ''job table passed migration preflight'' AS migration_step',
    'SELECT * FROM `fitcv_005_error_job_table_missing`'
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
    'SELECT ''archived_at already exists'' AS migration_step',
    'ALTER TABLE `job` ADD COLUMN `archived_at` DATETIME NULL AFTER `deadline`'
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
    'SELECT ''skill_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD COLUMN `skill_weight` DECIMAL(5,2) NOT NULL DEFAULT 45.00 AFTER `archived_at`'
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
    'SELECT ''experience_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD COLUMN `experience_weight` DECIMAL(5,2) NOT NULL DEFAULT 30.00 AFTER `skill_weight`'
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
    'SELECT ''education_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD COLUMN `education_weight` DECIMAL(5,2) NOT NULL DEFAULT 15.00 AFTER `experience_weight`'
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
    'SELECT ''soft_skill_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD COLUMN `soft_skill_weight` DECIMAL(5,2) NOT NULL DEFAULT 10.00 AFTER `education_weight`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- A partial/manual migration must not be reported as successful. Stop before
-- adding constraints when any existing column has an incompatible shape.
SET @fitcv_job_post_canonical_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'job'
      AND (
          (
              column_name = 'archived_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'YES'
          )
          OR (
              column_name = 'skill_weight'
              AND LOWER(column_type) = 'decimal(5,2)'
              AND is_nullable = 'NO'
              AND CAST(column_default AS DECIMAL(5,2)) = 45.00
          )
          OR (
              column_name = 'experience_weight'
              AND LOWER(column_type) = 'decimal(5,2)'
              AND is_nullable = 'NO'
              AND CAST(column_default AS DECIMAL(5,2)) = 30.00
          )
          OR (
              column_name = 'education_weight'
              AND LOWER(column_type) = 'decimal(5,2)'
              AND is_nullable = 'NO'
              AND CAST(column_default AS DECIMAL(5,2)) = 15.00
          )
          OR (
              column_name = 'soft_skill_weight'
              AND LOWER(column_type) = 'decimal(5,2)'
              AND is_nullable = 'NO'
              AND CAST(column_default AS DECIMAL(5,2)) = 10.00
          )
      )
);
SET @fitcv_sql = IF(
    @fitcv_job_post_canonical_columns = 5,
    'SELECT ''job archive and scoring columns are canonical'' AS migration_step',
    'SELECT * FROM `fitcv_005_error_job_columns_not_canonical`'
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
          AND constraint_type = 'CHECK'
    ),
    'SELECT ''chk_job_skill_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD CONSTRAINT `chk_job_skill_weight` CHECK (`skill_weight` BETWEEN 0 AND 100)'
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
          AND constraint_type = 'CHECK'
    ),
    'SELECT ''chk_job_experience_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD CONSTRAINT `chk_job_experience_weight` CHECK (`experience_weight` BETWEEN 0 AND 100)'
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
          AND constraint_type = 'CHECK'
    ),
    'SELECT ''chk_job_education_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD CONSTRAINT `chk_job_education_weight` CHECK (`education_weight` BETWEEN 0 AND 100)'
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
          AND constraint_type = 'CHECK'
    ),
    'SELECT ''chk_job_soft_skill_weight already exists'' AS migration_step',
    'ALTER TABLE `job` ADD CONSTRAINT `chk_job_soft_skill_weight` CHECK (`soft_skill_weight` BETWEEN 0 AND 100)'
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
          AND constraint_type = 'CHECK'
    ),
    'SELECT ''chk_job_weight_total already exists'' AS migration_step',
    'ALTER TABLE `job` ADD CONSTRAINT `chk_job_weight_total` CHECK (`skill_weight` + `experience_weight` + `education_weight` + `soft_skill_weight` = 100)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_job_company_archive_index = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'job'
      AND index_name = 'idx_job_company_archive_status'
);
SET @fitcv_sql = IF(
    @fitcv_job_company_archive_index IS NULL,
    'ALTER TABLE `job` ADD INDEX `idx_job_company_archive_status` (`company_id`, `archived_at`, `status`)',
    IF(
        @fitcv_job_company_archive_index = 'company_id,archived_at,status',
        'SELECT ''idx_job_company_archive_status already exists'' AS migration_step',
        'SELECT * FROM `fitcv_005_error_company_archive_index_not_canonical`'
    )
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_job_public_index = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'job'
      AND index_name = 'idx_job_public_visibility'
);
SET @fitcv_sql = IF(
    @fitcv_job_public_index IS NULL,
    'ALTER TABLE `job` ADD INDEX `idx_job_public_visibility` (`status`, `archived_at`, `deadline`)',
    IF(
        @fitcv_job_public_index = 'status,archived_at,deadline',
        'SELECT ''idx_job_public_visibility already exists'' AS migration_step',
        'SELECT * FROM `fitcv_005_error_public_index_not_canonical`'
    )
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- Deployment verification output.
SELECT
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'job'
  AND column_name IN (
      'archived_at',
      'skill_weight',
      'experience_weight',
      'education_weight',
      'soft_skill_weight'
  )
ORDER BY ordinal_position;

SELECT
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE()
  AND table_name = 'job'
  AND constraint_name IN (
      'chk_job_skill_weight',
      'chk_job_experience_weight',
      'chk_job_education_weight',
      'chk_job_soft_skill_weight',
      'chk_job_weight_total'
  )
ORDER BY constraint_name;

SELECT
    index_name,
    seq_in_index,
    column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'job'
  AND index_name IN (
      'idx_job_company_archive_status',
      'idx_job_public_visibility'
  )
ORDER BY index_name, seq_in_index;
