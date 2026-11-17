-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261010_023_create_commerce_webhook_events_and_indexes.sql
-- Description: Creates persistent webhook event inbox and composite performance indexes:
--              1. Table commerce_webhook_events (Durable inbox, deduplication, retry tracking)
--              2. Composite index idx_loss_plat_shop_persp_eff on commerce_loss_ledger
--              3. Composite index idx_items_plat_shop_prod on commerce_order_items
--              4. Composite index idx_orders_plat_shop_updated on commerce_orders
-- Target: P0 Webhook Database-First Architecture
-- Safety: Additive only, IF NOT EXISTS guards, table existence preflight (F14 fix)
-- ====================================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------------------
-- 1. Table: commerce_webhook_events (Durable Webhook Inbox)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_webhook_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
    `event_id` VARCHAR(128) NOT NULL COMMENT 'Authoritative event identity or deterministic hash',
    `event_type` VARCHAR(64) NOT NULL COMMENT 'Event type string: ORDER_STATUS_CHANGE, RETURN_STATUS_CHANGE, etc.',
    `payload_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 hash of raw payload for idempotency',
    `raw_payload` LONGTEXT NOT NULL COMMENT 'Original sanitized JSON payload from webhook',
    `status` ENUM('PENDING', 'PROCESSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'PENDING' COMMENT 'Processing status',
    `error_message` TEXT NULL DEFAULT NULL COMMENT 'Error message if failed',
    `attempt_count` INT NOT NULL DEFAULT 0 COMMENT 'Number of processing attempts',
    `event_timestamp` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when event occurred on platform',
    `received_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when received by server',
    `processed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when successfully processed',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_event` (`platform`, `shop_id`, `event_id`),
    KEY `idx_status_received` (`status`, `received_at`),
    KEY `idx_shop_type` (`shop_id`, `event_type`),
    KEY `idx_payload_hash` (`payload_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Durable Webhook Event Inbox & Audit Ledger';

-- --------------------------------------------------------------------
-- 2. Performance Composite Indexes for Range Queries (Safe Preflight)
-- --------------------------------------------------------------------

-- Composite index on commerce_loss_ledger for tenant, perspective & effective_at range
SET @exist_tbl_loss = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_loss_ledger'
);
SET @exist_idx_loss = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_loss_ledger' 
      AND INDEX_NAME = 'idx_loss_plat_shop_persp_eff'
);
SET @sql_idx_loss = IF(@exist_tbl_loss > 0 AND @exist_idx_loss = 0, 
    'ALTER TABLE `commerce_loss_ledger` ADD INDEX `idx_loss_plat_shop_persp_eff` (`platform`, `shop_id`, `perspective`, `effective_at`)', 
    'SELECT 1'
);
PREPARE stmt_loss FROM @sql_idx_loss;
EXECUTE stmt_loss;
DEALLOCATE PREPARE stmt_loss;

-- Composite index on commerce_order_items for tenant & product_id lookups (Break-even ROAS)
SET @exist_tbl_items = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_order_items'
);
SET @exist_idx_items = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_order_items' 
      AND INDEX_NAME = 'idx_items_plat_shop_prod'
);
SET @sql_idx_items = IF(@exist_tbl_items > 0 AND @exist_idx_items = 0, 
    'ALTER TABLE `commerce_order_items` ADD INDEX `idx_items_plat_shop_prod` (`platform`, `shop_id`, `product_id`)', 
    'SELECT 1'
);
PREPARE stmt_items FROM @sql_idx_items;
EXECUTE stmt_items;
DEALLOCATE PREPARE stmt_items;

-- Composite index on commerce_orders for tenant & platform_updated_at (Incremental delta scans)
SET @exist_tbl_orders = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_orders'
);
SET @exist_idx_orders_upd = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_orders' 
      AND INDEX_NAME = 'idx_orders_plat_shop_updated'
);
SET @sql_idx_orders_upd = IF(@exist_tbl_orders > 0 AND @exist_idx_orders_upd = 0, 
    'ALTER TABLE `commerce_orders` ADD INDEX `idx_orders_plat_shop_updated` (`platform`, `shop_id`, `platform_updated_at`)', 
    'SELECT 1'
);
PREPARE stmt_orders_upd FROM @sql_idx_orders_upd;
EXECUTE stmt_orders_upd;
DEALLOCATE PREPARE stmt_orders_upd;
