-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261015_026_modify_status_columns_to_varchar.sql
-- Description: Modifies ENUM status columns to VARCHAR(64) in commerce_sync_runs
--              and commerce_webhook_events to eliminate MariaDB 1265 Data truncated error:
--              1. commerce_sync_runs.status: ENUM -> VARCHAR(64)
--                 (supports 'PARTIAL', 'SKIPPED_NOT_AVAILABLE', 'CANCELLED', 'INTERRUPTED', etc.)
--              2. commerce_webhook_events.status: ENUM -> VARCHAR(64)
--                 (supports 'PROCESSING', 'PENDING', 'PROCESSED', 'FAILED', 'IGNORED', etc.)
-- Target: High-Volume Multi-Page Sync & Webhook Worker Ingestion Resilience
-- Safety: 100% backward-compatible, zero data loss, preserves all existing row values and indexes.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Modify commerce_sync_runs.status from restrictive ENUM to VARCHAR(64)
-- Allows PARTIAL, SKIPPED_NOT_AVAILABLE, CANCELLED, and all multi-domain orchestrator statuses.
ALTER TABLE `commerce_sync_runs` 
    MODIFY COLUMN `status` VARCHAR(64) NOT NULL DEFAULT 'PENDING' 
    COMMENT 'PENDING, RUNNING, COMPLETED, PARTIAL, SKIPPED_NOT_AVAILABLE, FAILED, INTERRUPTED, CANCELLED';

-- 2. Modify commerce_webhook_events.status from restrictive ENUM to VARCHAR(64)
-- Allows PROCESSING, PENDING, PROCESSED, FAILED, IGNORED without truncation warnings.
SET @exist_tbl_webhook = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_webhook_events'
);
SET @sql_webhook = IF(@exist_tbl_webhook > 0, 
    'ALTER TABLE `commerce_webhook_events` MODIFY COLUMN `status` VARCHAR(64) NOT NULL DEFAULT \'PENDING\' COMMENT \'PENDING, PROCESSING, PROCESSED, FAILED, IGNORED\'', 
    'SELECT "commerce_webhook_events does not exist yet"'
);
PREPARE stmt_webhook FROM @sql_webhook;
EXECUTE stmt_webhook;
DEALLOCATE PREPARE stmt_webhook;

SET FOREIGN_KEY_CHECKS = 1;
