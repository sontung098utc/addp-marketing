-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261001_005_create_commerce_aftersales_and_events.sql
-- Description: Creates 4 normalized tables for HF1.3 Return, Refund, Failed Delivery & Loss Engine:
--              1. commerce_aftersales (RMA/Return/Refund header)
--              2. commerce_aftersales_items (SKU/Line-item level return details)
--              3. commerce_order_events (Append-only lifecycle transitions with deterministic event_key)
--              4. commerce_loss_ledger (Persistent auditable economic-loss ledger with invariant cap)
-- Target: HF1.3 Phase 1B Return/Refund Engine
-- Safety: Forward-only, zero alterations to existing commerce_orders tables
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Table: commerce_aftersales
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_aftersales` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop identifier on platform',
    `aftersales_id` VARCHAR(64) NOT NULL COMMENT 'Platform RMA identifier (e.g. reverse_order_id or rma_id)',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Associated platform order ID',
    `aftersales_type` VARCHAR(50) NOT NULL COMMENT 'Normalized type: REFUND_ONLY, RETURN_AND_REFUND',
    `platform_aftersales_type` VARCHAR(50) NOT NULL COMMENT 'Raw type string from platform API',
    `aftersales_status` VARCHAR(50) NOT NULL COMMENT 'Normalized status: REQUESTED, APPROVED, RETURNING, RECEIVED, REFUND_PENDING, SUCCESS, CANCELLED, REJECTED',
    `platform_status` VARCHAR(50) NOT NULL COMMENT 'Raw status string from platform API',
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total approved/disbursed refund cash amount',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND' COMMENT 'ISO 4217 currency code',
    `request_created_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When the aftersales case was created on platform (UTC)',
    `platform_updated_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Latest update timestamp on platform (UTC)',
    `refund_completed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when refund was successfully disbursed (UTC)',
    `reason_code` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Standardized machine-readable return/refund reason code',
    `reason_category` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Normalized category: LOGISTICS, QUALITY, BUYER_DECISION, OUT_OF_STOCK',
    `return_role` VARCHAR(32) NULL DEFAULT NULL COMMENT 'Party initiating return: BUYER, PLATFORM, SELLER',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Sync run that ingested or updated this record',
    `raw_observation_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Foreign key to raw sanitized observation audit',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_aftersales` (`platform`, `shop_id`, `aftersales_id`),
    KEY `idx_platform_order_id` (`platform`, `shop_id`, `platform_order_id`),
    KEY `idx_shop_status` (`shop_id`, `aftersales_status`),
    KEY `idx_request_created` (`request_created_at`),
    KEY `idx_refund_completed` (`refund_completed_at`),
    KEY `idx_sync_run` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Normalized RMA and Aftersales Header';

-- --------------------------------------------------------------------
-- 2. Table: commerce_aftersales_items
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_aftersales_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `aftersales_pk` BIGINT UNSIGNED NOT NULL COMMENT 'Foreign key referencing commerce_aftersales.id',
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Flat index reference to platform order',
    `platform_line_item_id` VARCHAR(64) NOT NULL COMMENT 'Line item identifier from original order',
    `product_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop product catalog ID',
    `sku_id` VARCHAR(64) NOT NULL COMMENT 'SKU identifier',
    `requested_quantity` INT NOT NULL DEFAULT 1 COMMENT 'Quantity of SKU requested for return/refund',
    `returned_quantity` INT NOT NULL DEFAULT 0 COMMENT 'Physical quantity received back in warehouse',
    `refunded_quantity` INT NOT NULL DEFAULT 0 COMMENT 'Quantity approved for financial refund',
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Item-level allocated refund cash amount',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `item_status` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Line-item aftersales status if segregated',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_item_deterministic` (`aftersales_pk`, `platform_line_item_id`, `sku_id`),
    KEY `idx_order_item` (`platform`, `shop_id`, `platform_order_id`, `platform_line_item_id`),
    KEY `idx_sku` (`product_id`, `sku_id`),
    CONSTRAINT `fk_aftersales_items_parent` FOREIGN KEY (`aftersales_pk`) 
        REFERENCES `commerce_aftersales` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='SKU-level Line Item Details for Aftersales RMAs';

-- --------------------------------------------------------------------
-- 3. Table: commerce_order_events
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_order_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop identifier on platform',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Associated platform order ID',
    `event_domain` ENUM('ORDER', 'FULFILLMENT', 'AFTERSALES') NOT NULL COMMENT 'Lifecycle domain of the event',
    `event_type` VARCHAR(64) NOT NULL COMMENT 'Granular event: ORDER_CREATED, PAID, DISPATCHED, DELIVERY_FAILED, RTS, REFUND_COMPLETED, etc.',
    `event_key` VARCHAR(128) NOT NULL COMMENT 'Deterministic business event identity key (Correction 2)',
    `previous_status` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Status before transition if known',
    `new_status` VARCHAR(50) NOT NULL COMMENT 'Status after transition',
    `event_timestamp` TIMESTAMP NULL DEFAULT NULL COMMENT 'When the event occurred on the platform (UTC)',
    `observed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When ADDP first ingested/observed this event',
    `source_domain` VARCHAR(64) NOT NULL COMMENT 'API domain: order, return_refund, fulfillment',
    `api_version` VARCHAR(32) NOT NULL DEFAULT '202309' COMMENT 'API version used during observation',
    `endpoint` VARCHAR(128) NOT NULL COMMENT 'Exact endpoint that reported the event',
    `platform_entity_id` VARCHAR(64) NOT NULL COMMENT 'Identifier of underlying platform entity (order_id, rma_id, package_id)',
    `payload_hash` CHAR(64) NOT NULL COMMENT 'SHA-256 provenance hash (Correction 2)',
    `sync_run_id` BIGINT UNSIGNED NOT NULL COMMENT 'Sync run that recorded this observation',
    `raw_observation_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Link to full observation payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Immutable insertion timestamp',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_order_event_identity` (`platform`, `shop_id`, `event_key`),
    KEY `idx_order_timeline` (`platform`, `shop_id`, `platform_order_id`, `event_timestamp`),
    KEY `idx_observed_timeline` (`platform`, `shop_id`, `platform_order_id`, `observed_at`),
    KEY `idx_domain_type` (`shop_id`, `event_domain`, `event_type`),
    KEY `idx_sync_run` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Immutable Append-Only Commerce Lifecycle Event Log';

-- --------------------------------------------------------------------
-- 4. Table: commerce_loss_ledger
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_loss_ledger` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop identifier on platform',
    `platform_order_id` VARCHAR(64) NOT NULL COMMENT 'Associated platform order ID',
    `platform_line_item_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Line item ID if item-level deduction, NULL for order-level',
    `loss_type` VARCHAR(50) NOT NULL COMMENT 'CANCELLATION, FAILED_DELIVERY, REFUND, PARTIAL_REFUND, RETURN_REFUND',
    `loss_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Economic loss amount deducted (VND)',
    `gross_reference_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Order/Item gross reference amount at time of calculation',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND' COMMENT 'ISO 4217 currency code',
    `effective_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When the loss became economically finalized',
    `observed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When ADDP captured the decisive evidence',
    `source_domain` VARCHAR(64) NOT NULL COMMENT 'order, return_refund, fulfillment',
    `source_entity_id` VARCHAR(64) NOT NULL COMMENT 'Underlying entity ID (order_id, rma_id, package_id)',
    `source_event_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Link to commerce_order_events.id if derived from event',
    `classification_rule` VARCHAR(100) NOT NULL COMMENT 'Decision rule name that established the loss',
    `classification_version` VARCHAR(32) NOT NULL DEFAULT '1.0' COMMENT 'Version of classification engine',
    `perspective` ENUM('MATURED_LIFECYCLE', 'POINT_IN_TIME') NOT NULL DEFAULT 'MATURED_LIFECYCLE' COMMENT 'Reporting perspective',
    `calculation_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Unique calculation session identifier',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Sync session identifier',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_loss_ledger_idempotency` (`platform`, `shop_id`, `perspective`, `platform_order_id`, `loss_type`, `source_entity_id`),
    KEY `idx_order_perspective` (`platform`, `shop_id`, `platform_order_id`, `perspective`),
    KEY `idx_loss_type` (`shop_id`, `loss_type`),
    KEY `idx_calculation_run` (`calculation_run_id`),
    KEY `idx_effective_at` (`effective_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Persistent Auditable Economic Loss Ledger with Invariant Cap';

SET FOREIGN_KEY_CHECKS = 1;
