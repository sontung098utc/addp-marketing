-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261006_017_add_customer_identity_columns.sql
-- Description: Adds customer identity linkage, resolution method, return/refund counts,
--              and latest order status to Customer 360 foundation tables.
-- Target: Sprint V2-05 Unified Business UI + Customer 360 Ingestion
-- Safety: Additive only, 100% backward compatible with Migration 009.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add customer_identifier_hash to commerce_order_recipients if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'customer_identifier_hash';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `customer_identifier_hash` CHAR(64) NULL DEFAULT NULL COMMENT \'Resolved customer identity hash link\' AFTER `phone_hash`', 
    'SELECT "customer_identifier_hash already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- Index on customer_identifier_hash
SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND INDEX_NAME = 'idx_recip_customer_hash';
SET @stmt = IF(@idx_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD INDEX `idx_recip_customer_hash` (`customer_identifier_hash`)', 
    'SELECT "idx_recip_customer_hash already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 2. Add identity_method to commerce_order_recipients if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'identity_method';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT \'BUYER_UID, RECIPIENT_ID, PHONE_HMAC, UNMATCHED\' AFTER `customer_identifier_hash`', 
    'SELECT "identity_method already exists in commerce_order_recipients"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 3. Add return_refund_count to commerce_customer_profiles if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'return_refund_count';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `return_refund_count` INT NOT NULL DEFAULT 0 COMMENT \'Total orders with returns or refunds\' AFTER `cancelled_orders_count`', 
    'SELECT "return_refund_count already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 4. Add identity_method to commerce_customer_profiles if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'identity_method';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT \'Primary identity resolution method\' AFTER `customer_identifier_hash`', 
    'SELECT "identity_method already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 5. Add latest_order_status to commerce_customer_profiles if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'latest_order_status';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `latest_order_status` VARCHAR(50) NULL DEFAULT NULL COMMENT \'Status of latest known order\' AFTER `last_order_at`', 
    'SELECT "latest_order_status already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
