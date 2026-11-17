-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261002_009_create_commerce_customer_foundation.sql
-- Description: Creates 2 normalized tables for Customer 360 Foundation:
--              1. commerce_order_recipients (Masked & encrypted recipient normalization)
--              2. commerce_customer_profiles (Aggregated customer purchase frequency & lifetime metrics)
-- Target: Sprint V2-01 Customer 360 Foundation
-- Safety: Forward-only, strictly zero alterations to legacy tables or migrations 004-008
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Table: commerce_order_recipients
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_order_recipients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Unique order ID issued by platform',
    `recipient_name_encrypted` TEXT NULL DEFAULT NULL COMMENT 'Application-level AES-256 encrypted recipient name if available',
    `phone_hash` CHAR(64) NULL DEFAULT NULL COMMENT 'HMAC-SHA256 of normalized phone for searching without plaintext exposure',
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
    KEY `idx_province_district` (`province`, `district`),
    KEY `idx_synced_at` (`synced_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Table: commerce_customer_profiles
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_customer_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `customer_identifier_hash` CHAR(64) NOT NULL COMMENT 'Deterministic hash of buyer UID or normalized phone hash',
    `customer_display_name` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Masked display name (e.g. N*** T***)',
    `phone_masked` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Masked phone number',
    `province` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Primary delivery province',
    `total_orders_count` INT NOT NULL DEFAULT 0,
    `successful_orders_count` INT NOT NULL DEFAULT 0,
    `cancelled_orders_count` INT NOT NULL DEFAULT 0,
    `items_purchased_count` INT NOT NULL DEFAULT 0,
    `order_gross_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `realized_purchase_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `first_order_at` TIMESTAMP NULL DEFAULT NULL,
    `last_order_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shop_customer_hash` (`platform`, `shop_id`, `customer_identifier_hash`),
    KEY `idx_orders_count` (`total_orders_count`),
    KEY `idx_realized_spent` (`realized_purchase_value`),
    KEY `idx_last_order` (`last_order_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
