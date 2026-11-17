-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20260925_004_create_commerce_core_tables.sql
-- Description: Creates 4 normalized tables for Core Orders Engine V2:
--              1. commerce_orders (Order Header normalization)
--              2. commerce_order_items (Line Items normalization)
--              3. commerce_sync_runs (Sync sessions & 3-token checkpoints)
--              4. commerce_raw_observations (Sanitized audit provenance)
-- Target: HF1.2 Phase 1B Core Orders Engine
-- Safety: Forward-only, zero alteration to legacy tables (tiktok_orders, snapshots)
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Table: commerce_orders
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Unique order ID issued by platform',
    `order_status` VARCHAR(50) NOT NULL COMMENT 'Normalized status: UNPAID, AWAITING_SHIPMENT, IN_TRANSIT, DELIVERED, COMPLETED, CANCELLED',
    `platform_status` VARCHAR(50) NOT NULL COMMENT 'Raw status string from platform',
    `platform_created_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Order placement timestamp (UTC)',
    `platform_updated_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Order latest status update timestamp (UTC)',
    `paid_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Payment clearance timestamp',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND' COMMENT 'Transaction currency ISO 4217',
    `order_gross_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total buyer payable amount (payment.total_amount)',
    `sub_total` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Order merchandise subtotal before discounts',
    `shipping_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Shipping fee paid by buyer',
    `seller_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Voucher/discount funded by seller',
    `platform_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Subsidy discount funded by platform',
    `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Tax amount if itemized',
    `shipping_provider` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Carrier name (J&T Express, Ninja Van, etc.)',
    `tracking_number` VARCHAR(100) NULL DEFAULT NULL COMMENT 'Tracking number of shipment package',
    `delivery_type` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Delivery method: TIKTOK_SHIPPING or SELLER_SHIPPING',
    `is_split_order` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether order was split into multiple packages',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'ID of sync session that ingested/updated this order',
    `raw_observation_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'ID linking to latest sanitized raw observation',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_order` (`platform`, `shop_id`, `platform_order_id`),
    KEY `idx_shop_status` (`shop_id`, `order_status`),
    KEY `idx_platform_created` (`platform_created_at`),
    KEY `idx_platform_updated` (`platform_updated_at`),
    KEY `idx_sync_run` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Table: commerce_order_items
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL COMMENT 'Foreign key to commerce_orders.id',
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Platform order ID for fast flat queries',
    `platform_line_item_id` VARCHAR(64) NOT NULL COMMENT 'Unique line item identifier from API (line_items[].id)',
    `product_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop product catalog ID',
    `product_name` VARCHAR(255) NOT NULL COMMENT 'Product title at time of order',
    `sku_id` VARCHAR(64) NOT NULL COMMENT 'SKU classification ID',
    `sku_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'SKU variant specification name',
    `sku_image` VARCHAR(512) NULL DEFAULT NULL COMMENT 'SKU image URL',
    `quantity` INT NOT NULL DEFAULT 1 COMMENT 'Ordered quantity',
    `sale_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Effective unit sale price',
    `original_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Original list price per unit',
    `seller_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Seller discount allocated to this item',
    `platform_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Platform subsidy allocated to this item',
    `room_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Live room ID if order placed during livestream',
    `line_item_status` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Line-item level status if segregated',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_item` (`platform`, `shop_id`, `platform_line_item_id`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_product_sku` (`product_id`, `sku_id`),
    KEY `idx_room_id` (`room_id`),
    CONSTRAINT `fk_order_items_parent` FOREIGN KEY (`order_id`) REFERENCES `commerce_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Table: commerce_sync_runs
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_sync_runs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `sync_type` ENUM('INITIAL_BACKFILL', 'INCREMENTAL_DELTA', 'MANUAL_RANGE') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'INTERRUPTED') NOT NULL DEFAULT 'PENDING',
    `window_start_time` TIMESTAMP NULL DEFAULT NULL COMMENT 'Window query start timestamp',
    `window_end_time` TIMESTAMP NULL DEFAULT NULL COMMENT 'Window query end timestamp',
    `current_page_token` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Cursor token currently being processed in loop',
    `last_page_token` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Committed checkpoint token (resume_page_token)',
    `pages_processed` INT NOT NULL DEFAULT 0,
    `orders_ingested` INT NOT NULL DEFAULT 0,
    `items_ingested` INT NOT NULL DEFAULT 0,
    `orders_updated` INT NOT NULL DEFAULT 0,
    `error_code` VARCHAR(64) NULL DEFAULT NULL,
    `error_message` TEXT NULL DEFAULT NULL,
    `started_at` TIMESTAMP NULL DEFAULT NULL,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_sync_type` (`sync_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. Table: commerce_raw_observations
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_raw_observations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `source_domain` VARCHAR(64) NOT NULL DEFAULT 'order',
    `api_version` VARCHAR(32) NOT NULL DEFAULT '202309',
    `endpoint` VARCHAR(128) NOT NULL DEFAULT '/order/202309/orders/search',
    `entity_type` VARCHAR(32) NOT NULL DEFAULT 'order',
    `platform_entity_id` VARCHAR(64) NOT NULL COMMENT 'Platform order ID',
    `sanitized_payload` JSON NOT NULL COMMENT 'Raw order payload with 100% PII stripped',
    `payload_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hash of sanitized_payload for deduplication',
    `observed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `platform_updated_at` TIMESTAMP NULL DEFAULT NULL,
    `sync_run_id` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_entity_hash` (`platform`, `shop_id`, `platform_entity_id`, `payload_hash`),
    KEY `idx_observed_at` (`observed_at`),
    KEY `idx_sync_run_id` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
