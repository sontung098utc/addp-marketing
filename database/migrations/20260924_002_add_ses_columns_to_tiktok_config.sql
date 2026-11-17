-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20260924_002_add_ses_columns_to_tiktok_config.sql
-- Description: Idempotently adds missing SES (Seller Evaluation System) 
--              and Seller Center sync columns to tiktok_config.
-- Target: Fixes production schema drift (SQLSTATE[42S22] Unknown column 'ses_score')
-- Applied: Task 02B-HF1 Hotfix
-- ====================================================================

SET NAMES utf8mb4;

DELIMITER $$

DROP PROCEDURE IF EXISTS `add_config_column_if_not_exists`$$
CREATE PROCEDURE `add_config_column_if_not_exists`(
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

-- Ensure Seller Center sync status columns exist (operational tracking)
CALL add_config_column_if_not_exists('tiktok_config', 'last_synced_seller_center_at', 'timestamp NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'seller_center_data', 'longtext NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'last_total_shop_gmv', 'decimal(15,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'last_total_shop_orders', 'int(11) NULL DEFAULT NULL');

-- Ensure SES score & component metric columns exist
-- Observed business metrics: MUST be NULL DEFAULT NULL until measured (NO synthetic fallback data)
CALL add_config_column_if_not_exists('tiktok_config', 'ses_score', 'decimal(3,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_product_score', 'decimal(3,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_negative_review_rate', 'decimal(5,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_return_refund_rate', 'decimal(5,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_logistics_score', 'decimal(3,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_fast_dispatch_rate', 'decimal(5,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_seller_cancel_rate', 'decimal(5,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_service_score', 'decimal(3,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_aftersales_hours', 'decimal(5,2) NULL DEFAULT NULL');
CALL add_config_column_if_not_exists('tiktok_config', 'ses_chat_response_rate', 'decimal(5,2) NULL DEFAULT NULL');

-- Configuration weights: TikTok Shop official Star Shop rubric weighting (70% Product, 15% Logistics, 15% Service)
CALL add_config_column_if_not_exists('tiktok_config', 'ses_product_weight', "decimal(5,2) NOT NULL DEFAULT '70.00'");
CALL add_config_column_if_not_exists('tiktok_config', 'ses_logistics_weight', "decimal(5,2) NOT NULL DEFAULT '15.00'");
CALL add_config_column_if_not_exists('tiktok_config', 'ses_service_weight', "decimal(5,2) NOT NULL DEFAULT '15.00'");

-- Clean up stored procedure
DROP PROCEDURE IF EXISTS `add_config_column_if_not_exists`;
