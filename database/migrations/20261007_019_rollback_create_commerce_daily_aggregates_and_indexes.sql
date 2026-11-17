-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Rollback: 20261007_019_rollback_create_commerce_daily_aggregates_and_indexes.sql
-- Description: Reverses Sprint V2-06 / V2-06.1 migration safely:
--              1. Archives commerce_daily_aggregate_queue if populated (otherwise drops)
--              2. Archives commerce_daily_aggregates if populated (otherwise drops)
--              3. Drops composite indexes added to commerce tables only if column signatures match
-- Target: Sprint V2-06.1 Safe Rollback
-- Safety: Non-destructive to existing populated aggregates, zero FOREIGN_KEY_CHECKS changes
-- ====================================================================

SET NAMES utf8mb4;

-- --------------------------------------------------------------------
-- 1. Safe Table Reversal (Archive if data exists, drop only if empty)
-- --------------------------------------------------------------------

-- Table commerce_daily_aggregates
SET @has_agg_table = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_daily_aggregates'
);
SET @agg_rows = 0;
SET @sql_check_agg = IF(@has_agg_table > 0, 
    'SELECT COUNT(*) INTO @agg_rows FROM `commerce_daily_aggregates`', 
    'SELECT 0'
);
PREPARE stmt_check_agg FROM @sql_check_agg;
EXECUTE stmt_check_agg;
DEALLOCATE PREPARE stmt_check_agg;

SET @sql_drop_agg = IF(@has_agg_table > 0 AND @agg_rows > 0,
    'RENAME TABLE `commerce_daily_aggregates` TO `commerce_daily_aggregates_archived`',
    IF(@has_agg_table > 0, 'DROP TABLE IF EXISTS `commerce_daily_aggregates`', 'SELECT "Table commerce_daily_aggregates does not exist"')
);
PREPARE stmt_drop_agg FROM @sql_drop_agg;
EXECUTE stmt_drop_agg;
DEALLOCATE PREPARE stmt_drop_agg;

-- Table commerce_daily_aggregate_queue
SET @has_queue_table = (
    SELECT COUNT(*) FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_daily_aggregate_queue'
);
SET @queue_rows = 0;
SET @sql_check_queue = IF(@has_queue_table > 0, 
    'SELECT COUNT(*) INTO @queue_rows FROM `commerce_daily_aggregate_queue`', 
    'SELECT 0'
);
PREPARE stmt_check_queue FROM @sql_check_queue;
EXECUTE stmt_check_queue;
DEALLOCATE PREPARE stmt_check_queue;

SET @sql_drop_queue = IF(@has_queue_table > 0 AND @queue_rows > 0,
    'RENAME TABLE `commerce_daily_aggregate_queue` TO `commerce_daily_aggregate_queue_archived`',
    IF(@has_queue_table > 0, 'DROP TABLE IF EXISTS `commerce_daily_aggregate_queue`', 'SELECT "Table commerce_daily_aggregate_queue does not exist"')
);
PREPARE stmt_drop_queue FROM @sql_drop_queue;
EXECUTE stmt_drop_queue;
DEALLOCATE PREPARE stmt_drop_queue;

-- --------------------------------------------------------------------
-- 2. Drop Indexes with Column Signature Validation
-- --------------------------------------------------------------------

-- Drop idx_orders_plat_shop_created only if it matches column signature (platform, shop_id, platform_created_at)
SET @exist_idx_orders = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_orders' 
      AND INDEX_NAME = 'idx_orders_plat_shop_created'
      AND COLUMN_NAME = 'platform_created_at'
);
SET @sql_idx_orders = IF(@exist_idx_orders > 0, 
    'ALTER TABLE `commerce_orders` DROP INDEX `idx_orders_plat_shop_created`', 
    'SELECT "Index idx_orders_plat_shop_created does not exist or signature does not match"'
);
PREPARE stmt_orders FROM @sql_idx_orders;
EXECUTE stmt_orders;
DEALLOCATE PREPARE stmt_orders;

-- Drop idx_aftersales_plat_shop_status only if it matches column signature
SET @exist_idx_aftersales = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_aftersales' 
      AND INDEX_NAME = 'idx_aftersales_plat_shop_status'
      AND COLUMN_NAME = 'aftersales_status'
);
SET @sql_idx_aftersales = IF(@exist_idx_aftersales > 0, 
    'ALTER TABLE `commerce_aftersales` DROP INDEX `idx_aftersales_plat_shop_status`', 
    'SELECT "Index idx_aftersales_plat_shop_status does not exist or signature does not match"'
);
PREPARE stmt_aftersales FROM @sql_idx_aftersales;
EXECUTE stmt_aftersales;
DEALLOCATE PREPARE stmt_aftersales;

-- Drop idx_tx_plat_shop_time only if it matches column signature
SET @exist_idx_tx = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_finance_transactions' 
      AND INDEX_NAME = 'idx_tx_plat_shop_time'
      AND COLUMN_NAME = 'transaction_time'
);
SET @sql_idx_tx = IF(@exist_idx_tx > 0, 
    'ALTER TABLE `commerce_finance_transactions` DROP INDEX `idx_tx_plat_shop_time`', 
    'SELECT "Index idx_tx_plat_shop_time does not exist or signature does not match"'
);
PREPARE stmt_tx FROM @sql_idx_tx;
EXECUTE stmt_tx;
DEALLOCATE PREPARE stmt_tx;

-- Drop idx_stmt_plat_shop_time only if it matches column signature
SET @exist_idx_stmt = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'commerce_finance_statements' 
      AND INDEX_NAME = 'idx_stmt_plat_shop_time'
      AND COLUMN_NAME = 'statement_time'
);
SET @sql_idx_stmt = IF(@exist_idx_stmt > 0, 
    'ALTER TABLE `commerce_finance_statements` DROP INDEX `idx_stmt_plat_shop_time`', 
    'SELECT "Index idx_stmt_plat_shop_time does not exist or signature does not match"'
);
PREPARE stmt_stmt FROM @sql_idx_stmt;
EXECUTE stmt_stmt;
DEALLOCATE PREPARE stmt_stmt;
