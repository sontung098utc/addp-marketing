-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE RECOVERY & RECREATION
-- Migration: 20261015_027_recreate_clean_customer_profiles.sql
-- Description: Recreates clean commerce_customer_profiles table with complete
--              schema (Customer 360, Unmasked CRM, Identity Tracking).
-- Target: Repair corrupted tablespace page 574 after emergency drop.
-- Safety: 100% idempotent, forward-compatible, clean InnoDB tablespace.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `commerce_customer_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
    `customer_identifier_hash` CHAR(64) NOT NULL COMMENT 'Deterministic SHA-256 hash representing customer identity',
    `identity_method` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Primary identity resolution method: EXACT_RECIPIENT, PHONE_MATCH, etc.',
    `customer_display_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Display name or anonymized label',
    `recipient_name_raw` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Unmasked customer full recipient name',
    `phone_masked` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Masked phone number',
    `phone_raw` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Unmasked customer phone number',
    `city` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Shipping city',
    `district` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Shipping district',
    `province` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Shipping province/state',
    `address_raw` TEXT NULL DEFAULT NULL COMMENT 'Unmasked customer primary delivery address',
    `postal_code` VARCHAR(20) NULL DEFAULT NULL COMMENT 'Postal code',
    `first_order_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp of customer first order',
    `last_order_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp of customer latest order',
    `latest_order_status` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Status of latest known order',
    `total_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Total lifetime orders placed',
    `valid_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Total completed/valid orders',
    `cancelled_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Total cancelled orders',
    `return_refund_count` INT NOT NULL DEFAULT 0 COMMENT 'Total orders with returns or refunds',
    `lifetime_gross_spend` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Total lifetime gross spend',
    `lifetime_net_spend` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Total lifetime net spend after cancellations and refunds',
    `average_order_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT 'Average order value (AOV)',
    `is_repeat_buyer` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if valid_orders_count >= 2',
    `customer_tier` VARCHAR(32) NOT NULL DEFAULT 'NEW' COMMENT 'NEW, RETURNING, VIP, AT_RISK, CHURNED',
    `notes` TEXT NULL DEFAULT NULL COMMENT 'Operator CRM notes',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_customer` (`platform`, `shop_id`, `customer_identifier_hash`),
    KEY `idx_shop_tier` (`shop_id`, `customer_tier`),
    KEY `idx_shop_repeat` (`shop_id`, `is_repeat_buyer`),
    KEY `idx_shop_spend` (`shop_id`, `lifetime_gross_spend`),
    KEY `idx_last_order` (`last_order_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Aggregated Customer 360 Profiles';

SET FOREIGN_KEY_CHECKS = 1;
