-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261009_022_create_commerce_product_costs.sql
-- Description: Creates authoritative Product & SPU Cost Configuration table:
--              1. commerce_product_costs (Unit Economics, COGS, Fees & Break-even ROAS)
-- Target: P0-04 Product-specific Break-even ROI Configuration
-- Safety: Additive only, non-destructive, schema pre-flight validation.
--         If table exists but has incompatible schema, raises explicit error for manual DBA resolution.
-- ====================================================================

SET NAMES utf8mb4;

DROP PROCEDURE IF EXISTS `sp_migrate_022_commerce_product_costs`;

DELIMITER $$
CREATE PROCEDURE `sp_migrate_022_commerce_product_costs`()
BEGIN
    DECLARE tbl_exists INT DEFAULT 0;
    DECLARE col_count INT DEFAULT 0;
    DECLARE uq_count INT DEFAULT 0;

    -- 1. Check if table already exists
    SELECT COUNT(*) INTO tbl_exists 
    FROM information_schema.TABLES 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_product_costs';

    IF tbl_exists = 0 THEN
        -- 2. Create table if not present
        CREATE TABLE IF NOT EXISTS `commerce_product_costs` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop' COMMENT 'E-commerce platform identifier',
            `shop_id` VARCHAR(64) NOT NULL COMMENT 'Shop ID on platform',
            `product_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop product / SPU catalog ID (item_group_id)',
            `product_name` VARCHAR(512) NULL DEFAULT NULL COMMENT 'Reference product title',
            `selling_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Reference retail selling price per unit (VND)',
            `cogs_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Cost of goods sold / manufacturing cost per unit (VND)',
            `variable_cost_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Packaging, handling, shipping buffer per unit (VND)',
            `platform_fee_pct` DECIMAL(5,2) NOT NULL DEFAULT '0.00' COMMENT 'Platform fee percentage (e.g. 5.00 for 5%)',
            `margin_target_pct` DECIMAL(5,2) NULL DEFAULT NULL COMMENT 'Optional desired net profit margin target %',
            `unit_margin` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Unit contribution margin = Selling - COGS - VarCost - PlatformFee',
            `margin_pct` DECIMAL(7,4) NOT NULL DEFAULT '0.0000' COMMENT 'Margin % = unit_margin / selling_price',
            `breakeven_roas` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Break-even ROAS = 1 / (Margin %)',
            `status` VARCHAR(32) NOT NULL DEFAULT 'CONFIGURED' COMMENT 'CONFIGURED, INSUFFICIENT_DATA, NEGATIVE_MARGIN',
            `notes` VARCHAR(500) NULL DEFAULT NULL COMMENT 'User rationale or cost notes',
            `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_shop_product_cost` (`platform`, `shop_id`, `product_id`),
            KEY `idx_shop_product` (`shop_id`, `product_id`),
            KEY `idx_updated_at` (`updated_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Authoritative SPU unit economics and break-even ROAS configuration';
    ELSE
        -- 3. Table exists: verify schema structure
        SELECT COUNT(*) INTO col_count 
        FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = 'commerce_product_costs'
          AND COLUMN_NAME IN (
            'platform', 'shop_id', 'product_id', 'selling_price', 'cogs_amount',
            'variable_cost_amount', 'platform_fee_pct', 'unit_margin', 'margin_pct',
            'breakeven_roas', 'status'
          );

        IF col_count < 11 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ERROR: Table commerce_product_costs exists but has incompatible schema (missing required columns). Manual DBA resolution required.';
        END IF;

        -- Check unique key constraint
        SELECT COUNT(*) INTO uq_count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'commerce_product_costs'
          AND INDEX_NAME = 'uq_shop_product_cost';

        IF uq_count = 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'ERROR: Table commerce_product_costs exists but is missing UNIQUE KEY uq_shop_product_cost. Manual DBA resolution required.';
        END IF;
    END IF;
END$$
DELIMITER ;

CALL `sp_migrate_022_commerce_product_costs`();
DROP PROCEDURE IF EXISTS `sp_migrate_022_commerce_product_costs`;
