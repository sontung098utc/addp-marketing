-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261007_018_rollback_add_recipient_encryption_columns.sql
-- Description: Drops phone_encrypted and address_full_encrypted from
--              commerce_order_recipients.
-- Target: Sprint V2-05.2 TikTok Recipient Capture Hotfix
-- Safety: Rollback of migration 018 only.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Drop address_full_encrypted if exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'address_full_encrypted';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_order_recipients` DROP COLUMN `address_full_encrypted`', 
    'SELECT "address_full_encrypted does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 2. Drop phone_encrypted if exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'phone_encrypted';
SET @stmt = IF(@col_exists > 0, 
    'ALTER TABLE `commerce_order_recipients` DROP COLUMN `phone_encrypted`', 
    'SELECT "phone_encrypted does not exist"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
