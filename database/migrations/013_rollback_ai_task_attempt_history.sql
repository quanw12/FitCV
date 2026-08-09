-- FitCV migration 013 rollback
-- Thao tác này xóa vĩnh viễn toàn bộ lịch sử lỗi theo từng lần thử của hàng đợi AI.

DROP TABLE IF EXISTS ai_task_attempt_history;

-- Xác nhận bảng lịch sử đã được xóa.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name = 'ai_task_attempt_history';
