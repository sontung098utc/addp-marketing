-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION ROLLBACK
-- Rollback for: 20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql
-- Target: Sprint V2-02A.2 Official GMV Max API Ingestion
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop additive columns safely if they exist
SET @drop_stmt = 'ALTER TABLE `commerce_ads_campaign_daily` ';
SET @drops = '';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `net_cost`, ', '') INTO @d1 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'net_cost';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `promotion_type`, ', '') INTO @d2 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'promotion_type';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `api_roi`, ', '') INTO @d3 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'api_roi';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `derived_roi`, ', '') INTO @d4 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'derived_roi';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `api_cost_per_order`, ', '') INTO @d5 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'api_cost_per_order';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `derived_cpa`, ', '') INTO @d6 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'derived_cpa';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `api_version`, ', '') INTO @d7 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'api_version';

SELECT IF(COUNT(*) > 0, 'DROP COLUMN `observed_at`, ', '') INTO @d8 FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'observed_at';

SET @all_drops = CONCAT(@d1, @d2, @d3, @d4, @d5, @d6, @d7, @d8);

SET @final_stmt = IF(LENGTH(@all_drops) > 2, 
    CONCAT(@drop_stmt, SUBSTRING(@all_drops, 1, LENGTH(@all_drops) - 2)), 
    'SELECT "No columns to drop"');

PREPARE exec_stmt FROM @final_stmt;
EXECUTE exec_stmt;
DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
