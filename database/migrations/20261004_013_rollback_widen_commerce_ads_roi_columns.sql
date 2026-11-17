-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE ROLLBACK
-- Migration: 20261004_013_rollback_widen_commerce_ads_roi_columns.sql
-- Description: Reverts ROI columns back from DECIMAL(15,4) to DECIMAL(7,4).
--
-- CRITICAL WARNING ON NUMERIC OVERFLOW & DATA CORRUPTION:
-- Rollback modifies DECIMAL(15,4) back to DECIMAL(7,4). If any existing rows
-- have ROI >= 1000.0000, MySQL will either trigger an 'Out of range value' error
-- or truncate/clamp the values depending on sql_mode.
-- DO NOT EXECUTE THIS ROLLBACK AUTOMATICALLY WITHOUT VERIFYING THAT NO ROI >= 1000 EXISTS:
--   SELECT COUNT(*) FROM commerce_ads_campaign_daily WHERE api_roi >= 1000 OR derived_roi >= 1000;
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: commerce_ads_campaign_daily
ALTER TABLE `commerce_ads_campaign_daily` 
    MODIFY COLUMN `roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Blended/API ROI',
    MODIFY COLUMN `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    MODIFY COLUMN `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / spend for discrepancy audit';

-- 2. Table: commerce_ads_product_daily
ALTER TABLE `commerce_ads_product_daily`
    MODIFY COLUMN `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    MODIFY COLUMN `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification';

-- 3. Table: commerce_ads_creative_daily
ALTER TABLE `commerce_ads_creative_daily`
    MODIFY COLUMN `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    MODIFY COLUMN `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification';

-- 4. Table: commerce_ads_live_daily
ALTER TABLE `commerce_ads_live_daily`
    MODIFY COLUMN `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    MODIFY COLUMN `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification';
