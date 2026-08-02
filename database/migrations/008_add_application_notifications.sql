-- Adds notification events for the Student Application Tracker.
-- Events are linked to status history so reruns do not create duplicates.

CREATE TABLE IF NOT EXISTS tracked_application_notification (
    notification_id        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tracked_application_id BIGINT UNSIGNED NOT NULL,
    account_id             BIGINT UNSIGNED NOT NULL,
    status_history_id      BIGINT UNSIGNED NULL UNIQUE,
    event_type             VARCHAR(40) NOT NULL,
    title                  VARCHAR(150) NOT NULL,
    message                VARCHAR(500) NOT NULL,
    read_at                DATETIME NULL,
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tracked_application_notification_application
        FOREIGN KEY (tracked_application_id) REFERENCES tracked_application(tracked_application_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tracked_application_notification_account
        FOREIGN KEY (account_id) REFERENCES account(account_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_tracked_application_notification_history
        FOREIGN KEY (status_history_id) REFERENCES tracked_application_status_history(status_history_id)
        ON DELETE CASCADE,
    INDEX idx_tracked_application_notification_application_created (tracked_application_id, created_at),
    INDEX idx_tracked_application_notification_account_read (account_id, read_at)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO tracked_application_notification (
    tracked_application_id,
    account_id,
    status_history_id,
    event_type,
    title,
    message,
    created_at
)
SELECT
    app.tracked_application_id,
    app.account_id,
    history.status_history_id,
    CASE
        WHEN history.previous_status IS NULL THEN 'ApplicationCreated'
        ELSE 'StatusChanged'
    END,
    CASE
        WHEN history.previous_status IS NULL THEN 'Application tracked'
        ELSE 'Application status changed'
    END,
    CASE
        WHEN history.previous_status IS NULL THEN CONCAT(app.company_name, ' - ', app.position_title, ' started in ', history.new_status, '.')
        ELSE CONCAT(app.company_name, ' - ', app.position_title, ' moved from ', history.previous_status, ' to ', history.new_status, '.')
    END,
    history.changed_at
FROM tracked_application_status_history history
JOIN tracked_application app
    ON app.tracked_application_id = history.tracked_application_id
LEFT JOIN tracked_application_notification existing
    ON existing.status_history_id = history.status_history_id
WHERE existing.notification_id IS NULL;
