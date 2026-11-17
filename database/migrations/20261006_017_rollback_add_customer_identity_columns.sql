-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261006_017_rollback_add_customer_identity_columns.sql
-- Description: Reverts changes introduced by 20261006_017.
-- Target: Sprint V2-05 Unified Business UI + Customer 360 Ingestion
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop index & columns from commerce_order_recipients
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND INDEX_NAME = 'idx_recip_customer_hash';
SET @stmt = IF(@idx_exists > 0, 
    'ALTER TABLE `commerce_order_recipients` DROP INDEX `idx_recip_customer_hash`', 
    'SELECT "idx_recip_customer_hash does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'identity_method';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_order_recipients` DROP COLUMN `identity_method`', 
    'SELECT "identity_method does not exist in commerce_order_recipients"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'customer_identifier_hash';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_order_recipients` DROP COLUMN `customer_identifier_hash`', 
    'SELECT "customer_identifier_hash does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 2. Drop columns from commerce_customer_profiles
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'latest_order_status';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_customer_profiles` DROP COLUMN `latest_order_status`', 
    'SELECT "latest_order_status does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'identity_method';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_customer_profiles` DROP COLUMN `identity_method`', 
    'SELECT "identity_method does not exist in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'return_refund_count';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_customer_profiles` DROP COLUMN `return_refund_count`', 
    'SELECT "return_refund_count does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
