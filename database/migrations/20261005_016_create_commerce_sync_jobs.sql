-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261005_016_create_commerce_sync_jobs.sql
-- Description: Creates commerce_sync_jobs table for asynchronous sync job
--              orchestration, background progress tracking, and run recovery (Sprint V2-04.3):
--              1. id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
--              2. platform VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop'
--              3. shop_id VARCHAR(64) NOT NULL
--              4. requested_start_date DATE NOT NULL
--              5. requested_end_date DATE NOT NULL
--              6. status VARCHAR(32) NOT NULL DEFAULT 'QUEUED'
--              7. current_domain VARCHAR(32) NULL
--              8. progress_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00
--              9. checkpoint_data LONGTEXT NULL (JSON domain state)
--              10. started_at DATETIME NULL
--              11. heartbeat_at DATETIME NULL
--              12. completed_at DATETIME NULL
--              13. created_by VARCHAR(64) NOT NULL DEFAULT 'system'
--              14. error_code VARCHAR(64) NULL
--              15. error_message TEXT NULL
--              16. created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
--              17. updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
-- Target: Sprint V2-04.3 Async Job Orchestration & Stale Run Recovery
-- Safety: Additive only, zero data loss, idempotent conditional execution
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `commerce_sync_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'Source commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Platform merchant shop identifier',
    `requested_start_date` DATE NOT NULL COMMENT 'Requested sync window start date YYYY-MM-DD',
    `requested_end_date` DATE NOT NULL COMMENT 'Requested sync window end date YYYY-MM-DD',
    `status` VARCHAR(32) NOT NULL DEFAULT 'QUEUED' COMMENT 'Job lifecycle status: QUEUED, RUNNING, COMPLETED, PARTIAL, FAILED, CANCELLED',
    `current_domain` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Domain currently being executed by orchestrator',
    `progress_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00 COMMENT 'Orchestration progress percentage (0.00 - 100.00)',
    `checkpoint_data` LONGTEXT NULL DEFAULT NULL COMMENT 'JSON snapshot of domain checkpoints and execution state',
    `started_at` DATETIME NULL DEFAULT NULL COMMENT 'Timestamp when worker started execution',
    `heartbeat_at` DATETIME NULL DEFAULT NULL COMMENT 'Liveness heartbeat updated during execution',
    `completed_at` DATETIME NULL DEFAULT NULL COMMENT 'Terminal completion timestamp',
    `created_by` VARCHAR(64) NOT NULL DEFAULT 'system' COMMENT 'Originating actor: user, system, cron, api',
    `error_code` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Error code if terminal status is FAILED or PARTIAL',
    `error_message` TEXT NULL DEFAULT NULL COMMENT 'Safe error message or summary details',
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_status_heartbeat` (`status`, `heartbeat_at`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Asynchronous commerce sync jobs and background orchestration';

SET FOREIGN_KEY_CHECKS = 1;
