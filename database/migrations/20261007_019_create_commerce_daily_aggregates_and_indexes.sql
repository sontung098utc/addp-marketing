-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261007_019_create_commerce_daily_aggregates_and_indexes.sql
-- Description: Creates daily aggregate reporting tables and composite performance
--              indexes for DB-first reporting and background sync (Sprint V2-06 / V2-06.1):
--              1. Composite index idx_orders_plat_shop_created on commerce_orders
--              2. Composite index idx_aftersales_plat_shop_status on commerce_aftersales
--              3. Composite index idx_tx_plat_shop_time on commerce_finance_transactions
--              4. Composite index idx_stmt_plat_shop_time on commerce_finance_statements
--              5. Table commerce_daily_aggregates (Daily versioned headline KPIs, default NOT_SYNCED)
--              6. Table commerce_daily_aggregate_queue (Asynchronous rebuild queue with dirty flag)
-- Target: Sprint V2-06.1 DB-First Reporting, Daily Aggregation & Background Sync
-- Safety: Additive only, IF NOT EXISTS guards, zero global FOREIGN_KEY_CHECKS alteration
-- ====================================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------------------
-- 1. Phase A Composite Indexes for Tenant-Isolated Range Queries
-- --------------------------------------------------------------------
-- LOCKING NOTE: In MariaDB / InnoDB, creating secondary indexes on InnoDB tables
-- is supported via Online DDL (ALGORITHM=INPLACE, LOCK=NONE), which avoids exclusive
-- table write locks. If large tables are concurrently syncing, execute during off-peak
-- or ensure lock_wait_timeout is set appropriately.

-- Composite index on commerce_orders for tenant & created-at range queries
SET @exist_idx_orders = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_orders' 
      AND INDEX_NAME = 'idx_orders_plat_shop_created'
);
SET @sql_idx_orders = IF(@exist_idx_orders = 0, 
    'ALTER TABLE `commerce_orders` ADD INDEX `idx_orders_plat_shop_created` (`platform`, `shop_id`, `platform_created_at`)', 
    'SELECT "Index idx_orders_plat_shop_created already exists"'
);
PREPARE stmt_orders FROM @sql_idx_orders;
EXECUTE stmt_orders;
DEALLOCATE PREPARE stmt_orders;

-- Composite index on commerce_aftersales for tenant, status & order lookup
SET @exist_idx_aftersales = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_aftersales' 
      AND INDEX_NAME = 'idx_aftersales_plat_shop_status'
);
SET @sql_idx_aftersales = IF(@exist_idx_aftersales = 0, 
    'ALTER TABLE `commerce_aftersales` ADD INDEX `idx_aftersales_plat_shop_status` (`platform`, `shop_id`, `aftersales_status`, `platform_order_id`)', 
    'SELECT "Index idx_aftersales_plat_shop_status already exists"'
);
PREPARE stmt_aftersales FROM @sql_idx_aftersales;
EXECUTE stmt_aftersales;
DEALLOCATE PREPARE stmt_aftersales;

-- Composite index on commerce_finance_transactions for tenant & transaction_time range
SET @exist_idx_tx = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_finance_transactions' 
      AND INDEX_NAME = 'idx_tx_plat_shop_time'
);
SET @sql_idx_tx = IF(@exist_idx_tx = 0, 
    'ALTER TABLE `commerce_finance_transactions` ADD INDEX `idx_tx_plat_shop_time` (`platform`, `shop_id`, `transaction_time`)', 
    'SELECT "Index idx_tx_plat_shop_time already exists"'
);
PREPARE stmt_tx FROM @sql_idx_tx;
EXECUTE stmt_tx;
DEALLOCATE PREPARE stmt_tx;

-- Composite index on commerce_finance_statements for tenant & statement_time range
SET @exist_idx_stmt = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_finance_statements' 
      AND INDEX_NAME = 'idx_stmt_plat_shop_time'
);
SET @sql_idx_stmt = IF(@exist_idx_stmt = 0, 
    'ALTER TABLE `commerce_finance_statements` ADD INDEX `idx_stmt_plat_shop_time` (`platform`, `shop_id`, `statement_time`)', 
    'SELECT "Index idx_stmt_plat_shop_time already exists"'
);
PREPARE stmt_stmt FROM @sql_idx_stmt;
EXECUTE stmt_stmt;
DEALLOCATE PREPARE stmt_stmt;

-- --------------------------------------------------------------------
-- 2. Phase B Table: commerce_daily_aggregates
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_daily_aggregates` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'Source commerce platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Platform merchant shop identifier',
    `metric_date` DATE NOT NULL COMMENT 'Authoritative order-cohort or stat date YYYY-MM-DD',
    
    -- Order Cohort & Gross Value
    `order_count` INT NOT NULL DEFAULT 0 COMMENT 'Total distinct orders created on this date',
    `order_gross_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total gross amount for orders created on this date',
    
    -- Loss Ledger Breakdown (Matured Lifecycle)
    `cancelled_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Orders with cancellation loss',
    `cancellation_loss_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Economic loss from pre-fulfillment cancellations',
    `refund_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Orders with post-delivery refunds',
    `refund_loss_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Economic loss from approved refunds',
    `failed_delivery_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Orders with logistics failed delivery / RTS',
    `failed_delivery_loss_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Economic loss from failed deliveries',
    `total_loss_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total economic loss (cancellation + refund + failed delivery)',
    `realized_order_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Matured realized value (order_gross_value - total_loss_value)',
    
    -- Advertising Attribution
    `ads_spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad spend on this stat date',
    `ads_attributed_gross` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad attributed gross revenue on this stat date',
    `ads_orders` INT NOT NULL DEFAULT 0 COMMENT 'Total ad attributed orders on this stat date',
    `ads_clicks` INT NOT NULL DEFAULT 0 COMMENT 'Total ad clicks on this stat date',
    `ads_impressions` INT NOT NULL DEFAULT 0 COMMENT 'Total ad impressions on this stat date',
    
    -- Finance Statements & Settlements
    `statement_count` INT NOT NULL DEFAULT 0 COMMENT 'Number of settlement statements closed on this date',
    `total_settled_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total settled cash disbursed for statements on this date',
    `settled_orders_count` INT NOT NULL DEFAULT 0 COMMENT 'Number of distinct orders with transaction settlement on this date',
    `platform_commission` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'TikTok Shop commission deducted',
    `affiliate_commission` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Creator affiliate commission deducted',
    `payment_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Payment processing fee deducted',
    `shipping_fee_subsidy` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Shipping subsidy received',
    `actual_shipping_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Actual shipping fee charged',
    `adjustment_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Post-settlement adjustments',
    
    -- Provenance, Freshness & State (Defaults strictly to NOT_SYNCED until verified)
    `orders_freshness_status` VARCHAR(32) NOT NULL DEFAULT 'NOT_SYNCED' COMMENT 'Orders data freshness',
    `rma_freshness_status` VARCHAR(32) NOT NULL DEFAULT 'NOT_SYNCED' COMMENT 'RMA data freshness',
    `ads_freshness_status` VARCHAR(32) NOT NULL DEFAULT 'NOT_SYNCED' COMMENT 'Ads data freshness',
    `finance_freshness_status` VARCHAR(32) NOT NULL DEFAULT 'NOT_SYNCED' COMMENT 'Finance data freshness',
    `calculation_version` VARCHAR(32) NOT NULL DEFAULT '2.0' COMMENT 'Version of aggregation calculation engine',
    `status` VARCHAR(32) NOT NULL DEFAULT 'READY' COMMENT 'Aggregate state: READY, DIRTY, REBUILDING',
    `calculated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp when aggregate was last calculated',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_metric_date` (`platform`, `shop_id`, `metric_date`),
    KEY `idx_shop_metric_date` (`shop_id`, `metric_date`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily Versioned Headline KPI Aggregates for DB-First Reporting';

-- --------------------------------------------------------------------
-- 3. Table: commerce_daily_aggregate_queue (Sprint V2-06.1 Redesign)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_daily_aggregate_queue` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'Source platform',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop identifier',
    `metric_date` DATE NOT NULL COMMENT 'Date requiring rebuild YYYY-MM-DD',
    `reason` VARCHAR(64) NOT NULL DEFAULT 'ORDER_SYNC' COMMENT 'ORDER_SYNC, RMA_EVENT, LOSS_RECALC, MANUAL_REBUILD',
    `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, PROCESSING, COMPLETED, FAILED',
    `dirty_while_processing` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Set to 1 if new event arrives during active rebuild to prevent lost updates',
    `retry_count` INT NOT NULL DEFAULT 0 COMMENT 'Number of failed execution attempts',
    `max_retries` INT NOT NULL DEFAULT 3 COMMENT 'Maximum allowed retry attempts before permanent failure',
    `error_message` TEXT NULL DEFAULT NULL COMMENT 'Detailed message of last failure',
    `worker_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Identifier of worker currently executing this rebuild',
    `rebuild_requested_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp of most recent rebuild request',
    `processing_started_at` DATETIME NULL DEFAULT NULL COMMENT 'Timestamp when worker claimed this item',
    `last_processed_at` DATETIME NULL DEFAULT NULL COMMENT 'Timestamp when execution was completed',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_metric_date` (`platform`, `shop_id`, `metric_date`),
    KEY `idx_status_priority` (`status`, `rebuild_requested_at`),
    KEY `idx_processing_timeout` (`status`, `processing_started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Asynchronous Daily Aggregate Rebuild Queue';

-- Upgrade guards if commerce_daily_aggregate_queue was already created in an earlier run:
SET @exist_uq_old = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_daily_aggregate_queue' 
      AND INDEX_NAME = 'uq_shop_date_pending'
);
SET @sql_uq_old = IF(@exist_uq_old > 0,
    'ALTER TABLE `commerce_daily_aggregate_queue` DROP INDEX `uq_shop_date_pending`',
    'SELECT "Old index uq_shop_date_pending does not exist"'
);
PREPARE stmt_uq_old FROM @sql_uq_old;
EXECUTE stmt_uq_old;
DEALLOCATE PREPARE stmt_uq_old;

SET @exist_uq_new = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_daily_aggregate_queue' 
      AND INDEX_NAME = 'uq_plat_shop_metric_date'
);
SET @sql_uq_new = IF(@exist_uq_new = 0,
    'ALTER TABLE `commerce_daily_aggregate_queue` ADD UNIQUE INDEX `uq_plat_shop_metric_date` (`platform`, `shop_id`, `metric_date`)',
    'SELECT "Index uq_plat_shop_metric_date already exists"'
);
PREPARE stmt_uq_new FROM @sql_uq_new;
EXECUTE stmt_uq_new;
DEALLOCATE PREPARE stmt_uq_new;
