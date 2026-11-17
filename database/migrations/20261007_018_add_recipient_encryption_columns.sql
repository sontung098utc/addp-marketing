-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261007_018_add_recipient_encryption_columns.sql
-- Description: Adds application-level encrypted columns (phone_encrypted,
--              address_full_encrypted) to commerce_order_recipients for
--              tamper-proof encryption-at-rest of captured recipient facts.
-- Target: Sprint V2-05.2 TikTok Recipient Capture Hotfix
-- Safety: Additive only, zero destructive changes, 100% backward compatible.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add phone_encrypted to commerce_order_recipients if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'phone_encrypted';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `phone_encrypted` TEXT NULL DEFAULT NULL COMMENT \'Application-level AES-256-GCM encrypted raw phone\' AFTER `recipient_name_encrypted`', 
    'SELECT "phone_encrypted already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 2. Add address_full_encrypted to commerce_order_recipients if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'address_full_encrypted';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `address_full_encrypted` TEXT NULL DEFAULT NULL COMMENT \'Application-level AES-256-GCM encrypted full delivery address\' AFTER `phone_encrypted`', 
    'SELECT "address_full_encrypted already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
