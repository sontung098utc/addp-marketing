-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261013_025_add_unmasked_customer_details.sql
-- Description: Add unmasked raw customer contact fields (Name, Phone, Full Address)
--              for active orders (Awaiting Shipment / In Transit) to enable direct CRM.
-- Target: Real-time Customer 360 Ingestion for New Orders
-- Safety: 100% idempotent, forward-only, zero data loss.
-- ====================================================================

SET NAMES utf8mb4;

-- 1. Table: commerce_order_recipients
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'recipient_name_raw';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `recipient_name_raw` VARCHAR(255) NULL DEFAULT NULL COMMENT \'Unmasked recipient full name for active orders\' AFTER `recipient_name_encrypted`', 
    'SELECT "recipient_name_raw already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'phone_raw';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `phone_raw` VARCHAR(50) NULL DEFAULT NULL COMMENT \'Unmasked recipient phone number for active orders\' AFTER `phone_encrypted`', 
    'SELECT "phone_raw already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'address_raw';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `address_raw` TEXT NULL DEFAULT NULL COMMENT \'Unmasked full delivery address for active orders\' AFTER `address_full_encrypted`', 
    'SELECT "address_raw already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 2. Table: commerce_customer_profiles
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'recipient_name_raw';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `recipient_name_raw` VARCHAR(255) NULL DEFAULT NULL COMMENT \'Unmasked customer full recipient name\' AFTER `customer_display_name`', 
    'SELECT "recipient_name_raw already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'phone_raw';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `phone_raw` VARCHAR(50) NULL DEFAULT NULL COMMENT \'Unmasked customer phone number\' AFTER `phone_masked`', 
    'SELECT "phone_raw already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'address_raw';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `address_raw` TEXT NULL DEFAULT NULL COMMENT \'Unmasked customer primary delivery address\' AFTER `province`', 
    'SELECT "address_raw already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

