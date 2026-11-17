-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261005_014_rollback_enhance_commerce_sync_runs_metadata.sql
-- Description: Safely rolls back additions to commerce_sync_runs from Migration 014
-- Target: Rollback for V2-04 Sync Engine Metadata Enhancement
-- Safety: Preserves table structure and legacy data; drops only 014 columns and index
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop index idx_domain_dates_status if exists
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND INDEX_NAME = 'idx_domain_dates_status';

SET @stmt = IF(@idx_exists > 0, 
    'ALTER TABLE `commerce_sync_runs` DROP KEY `idx_domain_dates_status`', 
    'SELECT "idx_domain_dates_status does not exist"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 2. Drop added columns conditionally
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'api_endpoint';
SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `commerce_sync_runs` DROP COLUMN `api_endpoint`', 'SELECT "api_endpoint does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'latest_available_date';
SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `commerce_sync_runs` DROP COLUMN `latest_available_date`', 'SELECT "latest_available_date does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'records_written';
SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `commerce_sync_runs` DROP COLUMN `records_written`', 'SELECT "records_written does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'records_read';
SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `commerce_sync_runs` DROP COLUMN `records_read`', 'SELECT "records_read does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'end_date';
SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `commerce_sync_runs` DROP COLUMN `end_date`', 'SELECT "end_date does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'start_date';
SET @stmt = IF(@col_exists > 0, 'ALTER TABLE `commerce_sync_runs` DROP COLUMN `start_date`', 'SELECT "start_date does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
