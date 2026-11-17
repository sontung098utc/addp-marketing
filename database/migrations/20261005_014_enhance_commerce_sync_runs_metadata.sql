-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261005_014_enhance_commerce_sync_runs_metadata.sql
-- Description: Enhances commerce_sync_runs with authoritative audit columns (Sprint V2-04):
--              1. start_date DATE NULL - Requested window start date (YYYY-MM-DD)
--              2. end_date DATE NULL - Requested window end date (YYYY-MM-DD)
--              3. records_read INT NOT NULL DEFAULT 0 - Total records read from platform API
--              4. records_written INT NOT NULL DEFAULT 0 - Total records upserted into local DB
--              5. latest_available_date DATE NULL - Latest available date confirmed by API
--              6. api_endpoint VARCHAR(128) NULL - Ingestion API endpoint or URI called
-- Target: V2-04 Automated Data Synchronization Engine Audit & Coverage Proof
-- Safety: Non-destructive, forward-compatible, idempotent conditional execution
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add start_date
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'start_date';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `start_date` DATE NULL DEFAULT NULL COMMENT "Requested window start date YYYY-MM-DD" AFTER `window_end_time`', 
    'SELECT "start_date already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 2. Add end_date
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'end_date';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `end_date` DATE NULL DEFAULT NULL COMMENT "Requested window end date YYYY-MM-DD" AFTER `start_date`', 
    'SELECT "end_date already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 3. Add records_read
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'records_read';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `records_read` INT NOT NULL DEFAULT 0 COMMENT "Total records read from platform API" AFTER `orders_updated`', 
    'SELECT "records_read already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 4. Add records_written
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'records_written';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `records_written` INT NOT NULL DEFAULT 0 COMMENT "Total records written to database" AFTER `records_read`', 
    'SELECT "records_written already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 5. Add latest_available_date
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'latest_available_date';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `latest_available_date` DATE NULL DEFAULT NULL COMMENT "Latest available date reported by platform" AFTER `error_message`', 
    'SELECT "latest_available_date already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 6. Add api_endpoint
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND COLUMN_NAME = 'api_endpoint';

SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD COLUMN `api_endpoint` VARCHAR(128) NULL DEFAULT NULL COMMENT "API endpoint or route called" AFTER `latest_available_date`', 
    'SELECT "api_endpoint already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 7. Add index for audit coverage queries
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_sync_runs' AND INDEX_NAME = 'idx_domain_dates_status';

SET @stmt = IF(@idx_exists = 0, 
    'ALTER TABLE `commerce_sync_runs` ADD KEY `idx_domain_dates_status` (`shop_id`, `source_domain`, `status`, `start_date`, `end_date`)', 
    'SELECT "idx_domain_dates_status already exists"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
