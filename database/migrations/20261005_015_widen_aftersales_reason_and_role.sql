-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261005_015_widen_aftersales_reason_and_role.sql
-- Description: Widens aftersales reason and role columns on commerce_aftersales (Sprint V2-04.1):
--              1. reason_code VARCHAR(128) NULL (widened from VARCHAR(64) to prevent SQLSTATE[22001])
--              2. reason_category VARCHAR(255) NULL (widened from VARCHAR(64))
--              3. return_role VARCHAR(64) NULL (widened from VARCHAR(32))
-- Target: Sprint V2-04.1 Production Acceptance Fix
-- Safety: Additive / widening only, zero data loss, idempotent conditional execution
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Modify reason_code to VARCHAR(128)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_aftersales' AND COLUMN_NAME = 'reason_code';

SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_aftersales` MODIFY COLUMN `reason_code` VARCHAR(128) NULL DEFAULT NULL COMMENT "Standardized machine-readable return/refund reason code (widened to 128)"', 
    'ALTER TABLE `commerce_aftersales` ADD COLUMN `reason_code` VARCHAR(128) NULL DEFAULT NULL COMMENT "Standardized machine-readable return/refund reason code"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 2. Modify reason_category to VARCHAR(255)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_aftersales' AND COLUMN_NAME = 'reason_category';

SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_aftersales` MODIFY COLUMN `reason_category` VARCHAR(255) NULL DEFAULT NULL COMMENT "Normalized category or return reason text (widened to 255)"', 
    'ALTER TABLE `commerce_aftersales` ADD COLUMN `reason_category` VARCHAR(255) NULL DEFAULT NULL COMMENT "Normalized category or return reason text"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

-- 3. Modify return_role to VARCHAR(64)
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_aftersales' AND COLUMN_NAME = 'return_role';

SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_aftersales` MODIFY COLUMN `return_role` VARCHAR(64) NULL DEFAULT NULL COMMENT "Party initiating return: BUYER, PLATFORM, SELLER (widened to 64)"', 
    'ALTER TABLE `commerce_aftersales` ADD COLUMN `return_role` VARCHAR(64) NULL DEFAULT NULL COMMENT "Party initiating return: BUYER, PLATFORM, SELLER"');
PREPARE exec_stmt FROM @stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;
