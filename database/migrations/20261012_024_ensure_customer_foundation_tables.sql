-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261012_024_ensure_customer_foundation_tables.sql
-- Description: Unified idempotent creation and verification of Customer 360 foundation tables:
--              1. commerce_order_recipients (Masked & encrypted recipient normalization)
--              2. commerce_customer_profiles (Aggregated customer purchase frequency & lifetime metrics)
-- Target: Sprint V2-05 Unified Business UI + Customer 360 Activation
-- Safety: 100% idempotent, forward-only, zero destructive changes. Safe to run multiple times.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Table: commerce_order_recipients (Create if not exists)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_order_recipients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Unique order ID issued by platform',
    `recipient_name_encrypted` TEXT NULL DEFAULT NULL COMMENT 'Application-level AES-256 encrypted recipient name if available',
    `phone_encrypted` TEXT NULL DEFAULT NULL COMMENT 'Application-level AES-256-GCM encrypted raw phone',
    `address_full_encrypted` TEXT NULL DEFAULT NULL COMMENT 'Application-level AES-256-GCM encrypted full delivery address',
    `phone_hash` CHAR(64) NULL DEFAULT NULL COMMENT 'HMAC-SHA256 of normalized phone for searching without plaintext exposure',
    `customer_identifier_hash` CHAR(64) NULL DEFAULT NULL COMMENT 'Resolved customer identity hash link',
    `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT 'BUYER_UID, RECIPIENT_ID, PHONE_HMAC, UNMATCHED',
    `phone_masked` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Pre-masked phone for UI display (e.g. 09****1234)',
    `address_masked` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Pre-masked address line for UI display',
    `province` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Administrative Province / City',
    `district` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Administrative District',
    `ward` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Administrative Ward / Commune',
    `postal_code` VARCHAR(20) NULL DEFAULT NULL COMMENT 'Postal code',
    `is_masked_by_platform` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 if platform API provided masked data',
    `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_order_recip` (`platform`, `shop_id`, `platform_order_id`),
    KEY `idx_phone_hash` (`phone_hash`),
    KEY `idx_recip_customer_hash` (`customer_identifier_hash`),
    KEY `idx_province_district` (`province`, `district`),
    KEY `idx_synced_at` (`synced_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 1b. Ensure additive columns on commerce_order_recipients (if created earlier by Migration 009)
-- --------------------------------------------------------------------
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'customer_identifier_hash';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `customer_identifier_hash` CHAR(64) NULL DEFAULT NULL COMMENT \'Resolved customer identity hash link\' AFTER `phone_hash`', 
    'SELECT "customer_identifier_hash already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @idx_exists = 0;
SELECT COUNT(*) INTO @idx_exists FROM information_schema.STATISTICS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND INDEX_NAME = 'idx_recip_customer_hash';
SET @stmt = IF(@idx_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD INDEX `idx_recip_customer_hash` (`customer_identifier_hash`)', 
    'SELECT "idx_recip_customer_hash already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'identity_method';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT \'BUYER_UID, RECIPIENT_ID, PHONE_HMAC, UNMATCHED\' AFTER `customer_identifier_hash`', 
    'SELECT "identity_method already exists in commerce_order_recipients"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'phone_encrypted';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `phone_encrypted` TEXT NULL DEFAULT NULL COMMENT \'Application-level AES-256-GCM encrypted raw phone\' AFTER `recipient_name_encrypted`', 
    'SELECT "phone_encrypted already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_recipients' AND COLUMN_NAME = 'address_full_encrypted';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_order_recipients` ADD COLUMN `address_full_encrypted` TEXT NULL DEFAULT NULL COMMENT \'Application-level AES-256-GCM encrypted full delivery address\' AFTER `phone_encrypted`', 
    'SELECT "address_full_encrypted already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- --------------------------------------------------------------------
-- 2. Table: commerce_customer_profiles (Create if not exists)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_customer_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `customer_identifier_hash` CHAR(64) NOT NULL COMMENT 'Deterministic hash of buyer UID or normalized phone hash',
    `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Primary identity resolution method',
    `customer_display_name` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Masked display name (e.g. N*** T***)',
    `phone_masked` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Masked phone number',
    `province` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Primary delivery province',
    `total_orders_count` INT NOT NULL DEFAULT 0,
    `successful_orders_count` INT NOT NULL DEFAULT 0,
    `cancelled_orders_count` INT NOT NULL DEFAULT 0,
    `return_refund_count` INT NOT NULL DEFAULT 0 COMMENT 'Total orders with returns or refunds',
    `items_purchased_count` INT NOT NULL DEFAULT 0,
    `order_gross_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `realized_purchase_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `first_order_at` TIMESTAMP NULL DEFAULT NULL,
    `last_order_at` TIMESTAMP NULL DEFAULT NULL,
    `latest_order_status` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Status of latest known order',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shop_customer_hash` (`platform`, `shop_id`, `customer_identifier_hash`),
    KEY `idx_orders_count` (`total_orders_count`),
    KEY `idx_realized_spent` (`realized_purchase_value`),
    KEY `idx_last_order` (`last_order_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2b. Ensure additive columns on commerce_customer_profiles (if created earlier by Migration 009)
-- --------------------------------------------------------------------
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'identity_method';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT \'Primary identity resolution method\' AFTER `customer_identifier_hash`', 
    'SELECT "identity_method already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'return_refund_count';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `return_refund_count` INT NOT NULL DEFAULT 0 COMMENT \'Total orders with returns or refunds\' AFTER `cancelled_orders_count`', 
    'SELECT "return_refund_count already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_customer_profiles' AND COLUMN_NAME = 'latest_order_status';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_customer_profiles` ADD COLUMN `latest_order_status` VARCHAR(50) NULL DEFAULT NULL COMMENT \'Status of latest known order\' AFTER `last_order_at`', 
    'SELECT "latest_order_status already exists in commerce_customer_profiles"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
