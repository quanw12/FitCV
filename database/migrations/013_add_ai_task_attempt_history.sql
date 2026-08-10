-- FitCV migration 013
-- Lưu lịch sử lỗi theo từng lần thử của hàng đợi AI và không xóa lịch sử khi thử lại thành công.
-- Đích: MySQL 8.0+. DDL tự động commit; cần sao lưu trước khi áp dụng.

SET @fitcv_ai_attempt_prerequisites = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_sql = IF(
    @fitcv_ai_attempt_prerequisites = 1,
    'SELECT ''ai_task prerequisite passed'' AS migration_step',
    'SELECT * FROM `fitcv_013_error_ai_task_missing`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

CREATE TABLE IF NOT EXISTS ai_task_attempt_history (
    ai_task_attempt_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    ai_task_id         BIGINT UNSIGNED NOT NULL,
    attempt_number     INT UNSIGNED NOT NULL,
    outcome            ENUM('RetryScheduled', 'TerminalFailure', 'StaleRecovery') NOT NULL,
    error_message      VARCHAR(1000) NOT NULL,
    failed_at          DATETIME NOT NULL,

    CONSTRAINT fk_ai_task_attempt_task
        FOREIGN KEY (ai_task_id) REFERENCES ai_task(ai_task_id)
        ON DELETE CASCADE,
    CONSTRAINT uq_ai_task_attempt_number
        UNIQUE (ai_task_id, attempt_number)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Xác minh cấu trúc chuẩn để lần chạy lại không che giấu bảng đã tồn tại nhưng sai định dạng.
SET @fitcv_ai_attempt_table_count = (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task_attempt_history'
      AND table_type = 'BASE TABLE'
);
SET @fitcv_ai_attempt_column_count = (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'ai_task_attempt_history'
      AND column_name IN (
          'ai_task_attempt_id', 'ai_task_id', 'attempt_number',
          'outcome', 'error_message', 'failed_at'
      )
);
SET @fitcv_ai_attempt_constraint_count = (
    SELECT COUNT(*)
    FROM information_schema.table_constraints
    WHERE constraint_schema = DATABASE()
      AND table_name = 'ai_task_attempt_history'
      AND constraint_name IN (
          'fk_ai_task_attempt_task',
          'uq_ai_task_attempt_number'
      )
);
SET @fitcv_sql = IF(
    @fitcv_ai_attempt_table_count = 1
    AND @fitcv_ai_attempt_column_count = 6
    AND @fitcv_ai_attempt_constraint_count = 2,
    'SELECT ''ai_task attempt history schema passed verification'' AS migration_step',
    'SELECT * FROM `fitcv_013_error_ai_task_attempt_history_not_canonical`'
);
PREPARE fitcv_stmt FROM @fitcv_sql;
EXECUTE fitcv_stmt;
DEALLOCATE PREPARE fitcv_stmt;

SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND table_name = 'ai_task_attempt_history'
ORDER BY ordinal_position;
