-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261009_021_create_commerce_affiliate_orders.sql
-- Description: Creates authoritative TikTok Shop Affiliate Orders table:
--              1. commerce_affiliate_orders (Idempotent API Ingestion & Creator Commission Settlement)
-- Target: P0-01 Affiliate Data Integrity & Official TikTok Shop Affiliate API
-- Safety: Additive only, non-destructive, schema pre-flight validation.
--         If table exists but has incompatible schema, raises explicit error for manual DBA resolution.
-- ====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_migrate_021_commerce_affiliate_orders`;

DELIMITER $$
CREATE PROCEDURE `sp_migrate_021_commerce_affiliate_orders`()
BEGIN
    DECLARE tbl_exists INT DEFAULT 0;
    DECLARE col_count INT DEFAULT 0;
    DECLARE uq_count INT DEFAULT 0;

    -- 1. Check if table already exists
    SELECT COUNT(*) INTO tbl_exists 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_affiliate_orders';

    IF tbl_exists = 0 THEN
        -- 2. Create table if not present
        CREATE TABLE IF NOT EXISTS `commerce_affiliate_orders` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
            `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
            `affiliate_order_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Shop Affiliate Order ID',
            `platform_order_id` VARCHAR(128) NOT NULL COMMENT 'Platform Order ID (linked to commerce_orders)',
            `sku_id` VARCHAR(64) NOT NULL DEFAULT '' COMMENT 'SKU identifier (or empty string for order-level entry)',
            `product_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'TikTok Product ID',
            `product_name` VARCHAR(512) NULL DEFAULT NULL COMMENT 'Product name at purchase',
            `creator_id` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Creator TikTok Open ID / Account ID',
            `creator_username` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Creator TikTok handle',
            `creator_nickname` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Creator display name',
            `creator_type` VARCHAR(64) NOT NULL DEFAULT 'AFFILIATE' COMMENT 'AFFILIATE, MARKETING, OFFICIAL',
            `content_type` VARCHAR(64) NULL DEFAULT NULL COMMENT 'VIDEO, LIVE, SHOWCASE, DIRECT, UNKNOWN',
            `content_id` VARCHAR(128) NULL DEFAULT NULL COMMENT 'TikTok video_id or live_room_id',
            `traffic_source` VARCHAR(64) NOT NULL DEFAULT 'UNKNOWN' COMMENT 'ORGANIC, PAID_ADS, UNKNOWN',
            `order_status` VARCHAR(64) NOT NULL DEFAULT 'PENDING' COMMENT 'AWAITING_PAYMENT, PAID, COMPLETED, CANCELLED',
            `commission_status` VARCHAR(64) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, SETTLED, CANCELLED, INELIGIBLE',
            `order_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Order gross value / Attributed GMV',
            `commission_rate_pct` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Authoritative commission rate percentage (e.g. 10.5000)',
            `estimated_commission` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Estimated commission amount from platform',
            `settled_commission` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Actual settled commission from financial statement',
            `ineligible_commission` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Cancelled / refunded ineligible commission amount',
            `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
            `order_created_at` DATETIME NULL DEFAULT NULL COMMENT 'Order creation time on TikTok Shop',
            `settled_at` DATETIME NULL DEFAULT NULL COMMENT 'Commission settlement finalization time',
            `raw_payload` LONGTEXT NULL DEFAULT NULL COMMENT 'Sanitized raw JSON payload for audit and traceability',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_shop_aff_order_sku` (`platform`, `shop_id`, `affiliate_order_id`, `sku_id`),
            KEY `idx_aff_shop_created` (`shop_id`, `order_created_at`),
            KEY `idx_aff_creator` (`shop_id`, `creator_id`),
            KEY `idx_aff_platform_order` (`shop_id`, `platform_order_id`),
            KEY `idx_aff_traffic_source` (`shop_id`, `traffic_source`),
            KEY `idx_aff_content` (`shop_id`, `content_type`, `content_id`),
            KEY `idx_aff_updated_at` (`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Authoritative TikTok Shop Affiliate Orders and Creator Commission Ingestion';
    ELSE
        -- 3. Table exists: verify schema structure
        SELECT COUNT(*) INTO col_count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'commerce_affiliate_orders'
          AND COLUMN_NAME IN (
            'platform', 'shop_id', 'affiliate_order_id', 'platform_order_id', 'sku_id',
            'product_id', 'creator_id', 'creator_type', 'content_type', 'content_id',
            'traffic_source', 'order_status', 'commission_status', 'order_amount',
            'commission_rate_pct', 'estimated_commission', 'settled_commission', 'raw_payload'
          );

        IF col_count < 18 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ERROR: Table commerce_affiliate_orders exists but has incompatible schema (missing required columns). Manual DBA resolution required.';
        END IF;

        -- Check unique key constraint
        SELECT COUNT(*) INTO uq_count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'commerce_affiliate_orders'
          AND INDEX_NAME = 'uq_shop_aff_order_sku';

        IF uq_count = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ERROR: Table commerce_affiliate_orders exists but is missing UNIQUE KEY uq_shop_aff_order_sku. Manual DBA resolution required.';
        END IF;
    END IF;
END$$
DELIMITER ;

CALL `sp_migrate_021_commerce_affiliate_orders`();
DROP PROCEDURE IF EXISTS `sp_migrate_021_commerce_affiliate_orders`;
