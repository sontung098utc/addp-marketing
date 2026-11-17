-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261001_006_rollback_commerce_sync_runs.sql
-- Description: Reverts upgrades made to commerce_sync_runs by Migration 006:
--              1. Reverts cursor tokens back to VARCHAR(255)
--              2. Reverts sync_type back to ENUM('INITIAL_BACKFILL', 'INCREMENTAL_DELTA', 'MANUAL_RANGE')
--              3. Drops idx_shop_domain and source_domain column
-- Target: HF1.3 Phase 1B Rollback
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Revert cursor tokens
ALTER TABLE `commerce_sync_runs` 
    MODIFY COLUMN `current_page_token` VARCHAR(255) NULL DEFAULT NULL,
    MODIFY COLUMN `last_page_token` VARCHAR(255) NULL DEFAULT NULL;

-- 2. Revert sync_type
ALTER TABLE `commerce_sync_runs` 
    MODIFY COLUMN `sync_type` ENUM('INITIAL_BACKFILL', 'INCREMENTAL_DELTA', 'MANUAL_RANGE') NOT NULL;

-- 3. Drop source_domain if present
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'source_domain';

SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_sync_runs` DROP INDEX `idx_shop_domain`, DROP COLUMN `source_domain`', 
    'SELECT "source_domain does not exist"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
