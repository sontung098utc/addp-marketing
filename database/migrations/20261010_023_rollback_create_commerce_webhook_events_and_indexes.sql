-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Migration: 20261010_023_rollback_create_commerce_webhook_events_and_indexes.sql
-- Description: Rollback script for migration 20261010_023:
--              1. Drops secondary indexes safely
--              2. Does NOT drop production tables (preserves audit records)
-- Target: P0 Webhook Database-First Architecture
-- Safety: Non-destructive, checks index existence before dropping
-- ====================================================================

SET NAMES utf8mb4;

-- Drop composite index on commerce_orders
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
SET @sql_drop_orders_upd = IF(@exist_tbl_orders > 0 AND @exist_idx_orders_upd > 0, 
    'ALTER TABLE `commerce_orders` DROP INDEX `idx_orders_plat_shop_updated`', 
    'SELECT "Index idx_orders_plat_shop_updated does not exist or table missing"'
);
PREPARE stmt_drop_orders FROM @sql_drop_orders_upd;
EXECUTE stmt_drop_orders;
DEALLOCATE PREPARE stmt_drop_orders;

-- Drop composite index on commerce_order_items
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
SET @sql_drop_items = IF(@exist_tbl_items > 0 AND @exist_idx_items > 0, 
    'ALTER TABLE `commerce_order_items` DROP INDEX `idx_items_plat_shop_prod`', 
    'SELECT "Index idx_items_plat_shop_prod does not exist or table missing"'
);
PREPARE stmt_drop_items FROM @sql_drop_items;
EXECUTE stmt_drop_items;
DEALLOCATE PREPARE stmt_drop_items;

-- Drop composite index on commerce_loss_ledger
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
SET @sql_drop_loss = IF(@exist_tbl_loss > 0 AND @exist_idx_loss > 0, 
    'ALTER TABLE `commerce_loss_ledger` DROP INDEX `idx_loss_plat_shop_persp_eff`', 
    'SELECT "Index idx_loss_plat_shop_persp_eff does not exist or table missing"'
);
PREPARE stmt_drop_loss FROM @sql_drop_loss;
EXECUTE stmt_drop_loss;
DEALLOCATE PREPARE stmt_drop_loss;

-- Note on table commerce_webhook_events:
-- In accordance with Production Safety rules, DROP TABLE is prohibited in rollback scripts.
-- To deactivate, cease routing webhooks to the endpoint.
