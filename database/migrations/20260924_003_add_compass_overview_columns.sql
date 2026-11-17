-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20260924_003_add_compass_overview_columns.sql
-- Description: Idempotently adds Compass Overview and period tracking
--              columns to tiktok_seller_center_snapshots.
-- Target: Task 02B-HF1.1 TikTok Seller Center Compass Real DOM Extractor
-- Applied: Local / Preflight
-- ====================================================================

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS `add_snapshot_column_if_not_exists`$$
CREATE PROCEDURE `add_snapshot_column_if_not_exists`(
    IN `p_table` VARCHAR(64),
    IN `p_column` VARCHAR(64),
    IN `p_definition` VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table
          AND COLUMN_NAME = p_column
    ) THEN
        SET @sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- Add period tracking columns to preserve accurate date ranges (replaces hardcoded 30-day assumption)
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'period_start', 'date NULL DEFAULT NULL');
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'period_end', 'date NULL DEFAULT NULL');

-- Add Compass Overview optional observed metrics
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'total_revenue', 'decimal(15,2) NULL DEFAULT NULL');
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'items_sold', 'int(11) NULL DEFAULT NULL');
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'sku_orders', 'int(11) NULL DEFAULT NULL');

-- Add extraction metadata columns
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'extraction_profile', "varchar(50) NULL DEFAULT 'seller_center_compass_overview'");
CALL add_snapshot_column_if_not_exists('tiktok_seller_center_snapshots', 'captured_at', 'timestamp NULL DEFAULT NULL');

-- Clean up stored procedure
DROP PROCEDURE IF EXISTS `add_snapshot_column_if_not_exists`;
