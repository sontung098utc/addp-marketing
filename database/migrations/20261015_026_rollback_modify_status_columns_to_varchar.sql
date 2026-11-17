-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK MIGRATION
-- Migration: 20261015_026_rollback_modify_status_columns_to_varchar.sql
-- Description: Reverts VARCHAR(64) status columns back to strict ENUM definitions
-- Target: Rollback for 20261015_026_modify_status_columns_to_varchar.sql
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `commerce_sync_runs` 
    MODIFY COLUMN `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'INTERRUPTED') NOT NULL DEFAULT 'PENDING';

SET @exist_tbl_webhook = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_webhook_events'
);
SET @sql_webhook = IF(@exist_tbl_webhook > 0, 
    'ALTER TABLE `commerce_webhook_events` MODIFY COLUMN `status` ENUM(\'PENDING\', \'PROCESSED\', \'FAILED\', \'IGNORED\') NOT NULL DEFAULT \'PENDING\'', 
    'SELECT 1'
);
PREPARE stmt_webhook FROM @sql_webhook;
EXECUTE stmt_webhook;
DEALLOCATE PREPARE stmt_webhook;

SET FOREIGN_KEY_CHECKS = 1;
