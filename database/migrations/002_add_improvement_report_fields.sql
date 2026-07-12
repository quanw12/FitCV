-- FitCV migration 002
-- Add structured AI improvement reports and generic AI task tracking.
-- Apply only after migration 001 (or against a pre-v3 full schema snapshot).

USE fitcv;

ALTER TABLE cv_improvement_suggestion
    ADD COLUMN suggestion_type ENUM('SkillGap', 'SectionFeedback', 'Rewrite', 'QuickWin') NULL AFTER match_result_id,
    ADD COLUMN section VARCHAR(50) NULL AFTER category,
    ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER priority,
    ADD COLUMN metadata_json JSON NULL AFTER sort_order;

-- Existing untyped rows are preserved as section feedback during rollout.
UPDATE cv_improvement_suggestion
SET suggestion_type = 'SectionFeedback'
WHERE suggestion_type IS NULL;

ALTER TABLE cv_improvement_suggestion
    MODIFY suggestion_type ENUM('SkillGap', 'SectionFeedback', 'Rewrite', 'QuickWin') NOT NULL,
    ADD INDEX idx_suggestion_match_type_order (match_result_id, suggestion_type, sort_order);

CREATE TABLE ai_task (
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
