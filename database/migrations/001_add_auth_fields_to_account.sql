-- FitCV migration 001
-- Add authentication fields required by password reset and Google login.
-- Run once with a database user that has ALTER and INDEX privileges.

USE fitcv;

ALTER TABLE account
    MODIFY password_hash VARCHAR(255) NULL,
    MODIFY role ENUM('Student', 'HR', 'HiringManager', 'Admin') NULL,
    ADD COLUMN auth_provider ENUM('Password', 'Google') NOT NULL DEFAULT 'Password' AFTER company_id,
    ADD COLUMN reset_token_hash VARCHAR(255) NULL AFTER auth_provider,
    ADD COLUMN reset_token_expires_at DATETIME NULL AFTER reset_token_hash,
    ADD INDEX idx_account_role (role),
    ADD INDEX idx_account_reset_token_hash (reset_token_hash);