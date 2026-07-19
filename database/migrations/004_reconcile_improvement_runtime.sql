-- FitCV migration 004
-- Reconcile the AI Improvement runtime after a complete or partial migration 002.
-- Target: MySQL 8.0+.
--
-- Run this file with the target database already selected, for example:
--   mysql --database=<fitcv_database> < database/migrations/004_reconcile_improvement_runtime.sql
--
-- This migration deliberately uses DATABASE() instead of USE fitcv/railway because
-- deployed environments do not all use the same schema name. Back up the database
-- before applying it. MySQL DDL auto-commits, so rollback should restore that backup;
-- do not drop reconciled columns after application data has started using them.

SELECT DATABASE() AS target_database;

-- Stop before any DDL when the caller forgot to select a database. The
-- intentionally absent table produces a deterministic mysql client failure.
SET @fitcv_sql = IF(
    DATABASE() IS NOT NULL,
    'SELECT ''target database is selected'' AS migration_step',
    'SELECT * FROM `fitcv_004_error_no_database_selected`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- Preflight snapshot. An empty target_database means the caller did not select a DB.
SELECT
    'pre' AS migration_phase,
    table_name,
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name IN ('cv_improvement_suggestion', 'ai_task')
ORDER BY table_name, ordinal_position;

SELECT
    'pre' AS migration_phase,
    table_name,
    index_name,
    non_unique,
    seq_in_index,
    column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND (
      (table_name = 'cv_improvement_suggestion' AND index_name = 'idx_suggestion_match_type_order')
      OR (table_name = 'ai_task' AND index_name = 'idx_ai_task_resource')
  )
ORDER BY table_name, index_name, seq_in_index;

-- CREATE TABLE IF NOT EXISTS cannot repair a manually-created/partial ai_task.
-- Validate any existing table before touching cv_improvement_suggestion because
-- MySQL DDL auto-commits and a later failure could otherwise leave a partial run.
SET @fitcv_ai_task_object_exists = EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
);
SET @fitcv_ai_task_is_base_table = EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_ai_task_total_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
);
SET @fitcv_ai_task_canonical_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND (
          (column_name = 'ai_task_id'
           AND LOWER(column_type) = 'bigint unsigned'
           AND is_nullable = 'NO'
           AND LOWER(extra) LIKE '%auto_increment%')
          OR (column_name = 'task_type'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 50
              AND is_nullable = 'NO')
          OR (column_name = 'resource_id'
              AND LOWER(column_type) = 'bigint unsigned'
              AND is_nullable = 'NO')
          OR (column_name = 'status'
              AND LOWER(column_type) = 'enum(''pending'',''processing'',''success'',''failed'')'
              AND is_nullable = 'NO'
              AND LOWER(COALESCE(CAST(column_default AS CHAR), '')) = 'pending')
          OR (column_name = 'provider'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 50
              AND is_nullable = 'YES')
          OR (column_name = 'model_name'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 100
              AND is_nullable = 'YES')
          OR (column_name = 'error_message'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 1000
              AND is_nullable = 'YES')
          OR (column_name = 'created_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'NO'
              AND LOWER(COALESCE(CAST(column_default AS CHAR), '')) LIKE 'current_timestamp%')
          OR (column_name = 'started_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'YES')
          OR (column_name = 'completed_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'YES')
      )
);
SET @fitcv_ai_task_primary_key = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND index_name = 'PRIMARY'
);
SET @fitcv_sql = IF(
    NOT @fitcv_ai_task_object_exists
      OR (
          @fitcv_ai_task_is_base_table
          AND @fitcv_ai_task_total_columns = 10
          AND @fitcv_ai_task_canonical_columns = 10
          AND @fitcv_ai_task_primary_key = 'ai_task_id'
      ),
    'SELECT ''existing ai_task schema passed preflight'' AS migration_step',
    'SELECT * FROM `fitcv_004_error_ai_task_schema_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- A fresh database normally gets this table from full_schema.sql. CREATE IF NOT
-- EXISTS also makes this reconciliation safe if the legacy suggestion table is absent.
CREATE TABLE IF NOT EXISTS cv_improvement_suggestion (
    suggestion_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    match_result_id  BIGINT UNSIGNED NOT NULL,
    suggestion_type  ENUM('SkillGap', 'SectionFeedback', 'Rewrite', 'QuickWin') NOT NULL,
    category         ENUM('Skill', 'Experience', 'Education', 'Keyword', 'Format', 'Other') NOT NULL,
    section          VARCHAR(50) NULL,
    original_text    LONGTEXT NULL,
    suggested_text   LONGTEXT NULL,
    explanation      LONGTEXT NULL,
    priority         ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Medium',
    sort_order       INT NOT NULL DEFAULT 0,
    metadata_json    JSON NULL,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_cv_improvement_suggestion_match_result
        FOREIGN KEY (match_result_id) REFERENCES match_result(match_result_id)
        ON DELETE CASCADE,
    INDEX idx_suggestion_match_type_order (match_result_id, suggestion_type, sort_order)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Add suggestion_type as nullable text first so legacy rows can be backfilled
-- before the final NOT NULL ENUM constraint is applied.
SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cv_improvement_suggestion'
          AND column_name = 'suggestion_type'
    ),
    'SELECT ''suggestion_type already exists'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` ADD COLUMN `suggestion_type` VARCHAR(50) NULL AFTER `match_result_id`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- If a partial/manual migration used an incompatible ENUM, widen it temporarily
-- so unsupported or NULL legacy values can be normalized without truncation.
SET @fitcv_suggestion_column_type = (
    SELECT LOWER(column_type)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND column_name = 'suggestion_type'
);
SET @fitcv_sql = IF(
    @fitcv_suggestion_column_type LIKE 'enum(%'
      AND @fitcv_suggestion_column_type <> 'enum(''skillgap'',''sectionfeedback'',''rewrite'',''quickwin'')',
    'ALTER TABLE `cv_improvement_suggestion` MODIFY COLUMN `suggestion_type` VARCHAR(50) NULL',
    'SELECT ''suggestion_type accepts the canonical values'' AS migration_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

UPDATE cv_improvement_suggestion
SET suggestion_type = 'SectionFeedback'
WHERE suggestion_type IS NULL
   OR CAST(suggestion_type AS CHAR) NOT IN ('SkillGap', 'SectionFeedback', 'Rewrite', 'QuickWin');

SET @fitcv_suggestion_shape = (
    SELECT CONCAT(LOWER(column_type), '|', is_nullable)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND column_name = 'suggestion_type'
);
SET @fitcv_sql = IF(
    @fitcv_suggestion_shape = 'enum(''skillgap'',''sectionfeedback'',''rewrite'',''quickwin'')|NO',
    'SELECT ''suggestion_type is already canonical'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` MODIFY COLUMN `suggestion_type` ENUM(''SkillGap'', ''SectionFeedback'', ''Rewrite'', ''QuickWin'') NOT NULL'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cv_improvement_suggestion'
          AND column_name = 'section'
    ),
    'SELECT ''section already exists'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` ADD COLUMN `section` VARCHAR(50) NULL AFTER `category`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- Keep sort_order nullable while legacy rows are normalized, then enforce the
-- shape expected by SQLAlchemy and full_schema.sql.
SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cv_improvement_suggestion'
          AND column_name = 'sort_order'
    ),
    'SELECT ''sort_order already exists'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` ADD COLUMN `sort_order` INT NULL DEFAULT 0 AFTER `priority`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

UPDATE cv_improvement_suggestion
SET sort_order = 0
WHERE sort_order IS NULL;

SET @fitcv_sort_order_is_canonical = (
    SELECT LOWER(data_type) = 'int'
       AND is_nullable = 'NO'
       AND CAST(column_default AS CHAR) = '0'
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND column_name = 'sort_order'
);
SET @fitcv_sql = IF(
    @fitcv_sort_order_is_canonical,
    'SELECT ''sort_order is already canonical'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` MODIFY COLUMN `sort_order` INT NOT NULL DEFAULT 0'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'cv_improvement_suggestion'
          AND column_name = 'metadata_json'
    ),
    'SELECT ''metadata_json already exists'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` ADD COLUMN `metadata_json` JSON NULL AFTER `sort_order`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- Recreate a same-named but incorrectly ordered index; otherwise add it only
-- when absent. Re-running this migration leaves the canonical index untouched.
SET @fitcv_suggestion_index_columns = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND index_name = 'idx_suggestion_match_type_order'
);
SET @fitcv_suggestion_index_non_unique = (
    SELECT MIN(non_unique)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND index_name = 'idx_suggestion_match_type_order'
);
SET @fitcv_suggestion_index_needs_rebuild = (
    @fitcv_suggestion_index_columns IS NOT NULL
    AND (
        @fitcv_suggestion_index_columns <> 'match_result_id,suggestion_type,sort_order'
        OR @fitcv_suggestion_index_non_unique <> 1
    )
);

-- A wrong same-named index may currently be the index InnoDB uses for the
-- match-result foreign key. Add a temporary supporting index before dropping it.
SET @fitcv_sql = IF(
    @fitcv_suggestion_index_needs_rebuild
      AND NOT EXISTS (
          SELECT 1
          FROM information_schema.statistics
          WHERE table_schema = DATABASE()
            AND table_name = 'cv_improvement_suggestion'
            AND index_name = 'idx_fitcv004_match_result_id'
      ),
    'ALTER TABLE `cv_improvement_suggestion` ADD INDEX `idx_fitcv004_match_result_id` (`match_result_id`)',
    'SELECT ''temporary suggestion index is not required'' AS migration_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    @fitcv_suggestion_index_needs_rebuild,
    'ALTER TABLE `cv_improvement_suggestion` DROP INDEX `idx_suggestion_match_type_order`',
    'SELECT ''suggestion index does not require removal'' AS migration_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_suggestion_index_columns = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND index_name = 'idx_suggestion_match_type_order'
);
SET @fitcv_suggestion_index_non_unique = (
    SELECT MIN(non_unique)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'cv_improvement_suggestion'
      AND index_name = 'idx_suggestion_match_type_order'
);
SET @fitcv_sql = IF(
    @fitcv_suggestion_index_columns = 'match_result_id,suggestion_type,sort_order'
      AND @fitcv_suggestion_index_non_unique = 1,
    'SELECT ''suggestion index is already canonical'' AS migration_step',
    'ALTER TABLE `cv_improvement_suggestion` ADD INDEX `idx_suggestion_match_type_order` (`match_result_id`, `suggestion_type`, `sort_order`)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_sql = IF(
    EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'cv_improvement_suggestion'
          AND index_name = 'idx_fitcv004_match_result_id'
    ),
    'ALTER TABLE `cv_improvement_suggestion` DROP INDEX `idx_fitcv004_match_result_id`',
    'SELECT ''temporary suggestion index is already absent'' AS migration_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS ai_task (
    ai_task_id    BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    task_type     VARCHAR(50) NOT NULL,
    resource_id   BIGINT UNSIGNED NOT NULL,
    status        ENUM('Pending', 'Processing', 'Success', 'Failed') NOT NULL DEFAULT 'Pending',
    provider      VARCHAR(50) NULL,
    model_name    VARCHAR(100) NULL,
    error_message VARCHAR(1000) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at    DATETIME NULL,
    completed_at  DATETIME NULL,

    INDEX idx_ai_task_resource (task_type, resource_id, created_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Re-check after CREATE so the postflight cannot report success unless the table
-- that will be used by the runtime has the complete canonical column contract.
SET @fitcv_ai_task_total_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
);
SET @fitcv_ai_task_canonical_columns = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND (
          (column_name = 'ai_task_id'
           AND LOWER(column_type) = 'bigint unsigned'
           AND is_nullable = 'NO'
           AND LOWER(extra) LIKE '%auto_increment%')
          OR (column_name = 'task_type'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 50
              AND is_nullable = 'NO')
          OR (column_name = 'resource_id'
              AND LOWER(column_type) = 'bigint unsigned'
              AND is_nullable = 'NO')
          OR (column_name = 'status'
              AND LOWER(column_type) = 'enum(''pending'',''processing'',''success'',''failed'')'
              AND is_nullable = 'NO'
              AND LOWER(COALESCE(CAST(column_default AS CHAR), '')) = 'pending')
          OR (column_name = 'provider'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 50
              AND is_nullable = 'YES')
          OR (column_name = 'model_name'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 100
              AND is_nullable = 'YES')
          OR (column_name = 'error_message'
              AND LOWER(data_type) = 'varchar'
              AND character_maximum_length = 1000
              AND is_nullable = 'YES')
          OR (column_name = 'created_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'NO'
              AND LOWER(COALESCE(CAST(column_default AS CHAR), '')) LIKE 'current_timestamp%')
          OR (column_name = 'started_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'YES')
          OR (column_name = 'completed_at'
              AND LOWER(data_type) = 'datetime'
              AND is_nullable = 'YES')
      )
);
SET @fitcv_ai_task_primary_key = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND index_name = 'PRIMARY'
);
SET @fitcv_sql = IF(
    @fitcv_ai_task_total_columns = 10
      AND @fitcv_ai_task_canonical_columns = 10
      AND @fitcv_ai_task_primary_key = 'ai_task_id',
    'SELECT ''ai_task columns are canonical'' AS migration_step',
    -- The intentionally absent table name makes mysql stop with a visible,
    -- deterministic error instead of continuing with a broken partial schema.
    'SELECT * FROM `fitcv_004_error_ai_task_schema_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_ai_task_index_columns = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND index_name = 'idx_ai_task_resource'
);
SET @fitcv_ai_task_index_non_unique = (
    SELECT MIN(non_unique)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND index_name = 'idx_ai_task_resource'
);
SET @fitcv_sql = IF(
    @fitcv_ai_task_index_columns IS NOT NULL
      AND (
          @fitcv_ai_task_index_columns <> 'task_type,resource_id,created_at'
          OR @fitcv_ai_task_index_non_unique <> 1
      ),
    'ALTER TABLE `ai_task` DROP INDEX `idx_ai_task_resource`',
    'SELECT ''AI task index does not require removal'' AS migration_step'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SET @fitcv_ai_task_index_columns = (
    SELECT GROUP_CONCAT(column_name ORDER BY seq_in_index SEPARATOR ',')
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND index_name = 'idx_ai_task_resource'
);
SET @fitcv_ai_task_index_non_unique = (
    SELECT MIN(non_unique)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND index_name = 'idx_ai_task_resource'
);
SET @fitcv_sql = IF(
    @fitcv_ai_task_index_columns = 'task_type,resource_id,created_at'
      AND @fitcv_ai_task_index_non_unique = 1,
    'SELECT ''AI task index is already canonical'' AS migration_step',
    'ALTER TABLE `ai_task` ADD INDEX `idx_ai_task_resource` (`task_type`, `resource_id`, `created_at`)'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

-- Postflight snapshot: these result sets are the deployment verification output.
SELECT
    'post' AS migration_phase,
    table_name,
    column_name,
    column_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
      (table_name = 'cv_improvement_suggestion'
       AND column_name IN ('suggestion_type', 'section', 'sort_order', 'metadata_json'))
      OR (table_name = 'ai_task')
  )
ORDER BY table_name, ordinal_position;

SELECT
    'post' AS migration_phase,
    table_name,
    index_name,
    non_unique,
    seq_in_index,
    column_name
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND (
      (table_name = 'cv_improvement_suggestion' AND index_name = 'idx_suggestion_match_type_order')
      OR (table_name = 'ai_task' AND index_name = 'idx_ai_task_resource')
  )
ORDER BY table_name, index_name, seq_in_index;
