-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261004_011_add_commerce_ads_campaign_api_lineage_columns.sql
-- Description: Adds API lineage, official vs derived metrics, and promotion_type
--              columns to commerce_ads_campaign_daily for Sprint V2-02A.2.
-- Target: Sprint V2-02A.2 Official GMV Max API Ingestion
-- Safety: Additive only, 100% backward compatible with Migration 010.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Add net_cost column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'net_cost';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `net_cost` DECIMAL(15,2) NULL DEFAULT NULL COMMENT \'Net cost after ad credit/rebates from API\' AFTER `spend`', 
    'SELECT "net_cost already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 2. Add promotion_type column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'promotion_type';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `promotion_type` VARCHAR(32) NULL DEFAULT NULL COMMENT \'PRODUCT, LIVE from API promotion_type\' AFTER `campaign_type`', 
    'SELECT "promotion_type already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 3. Add api_roi column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'api_roi';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT \'Official ROI reported directly by TikTok API\' AFTER `roi`', 
    'SELECT "api_roi already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 4. Add derived_roi column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'derived_roi';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT \'Derived gross_revenue / spend for discrepancy audit\' AFTER `api_roi`', 
    'SELECT "derived_roi already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 5. Add api_cost_per_order column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'api_cost_per_order';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `api_cost_per_order` DECIMAL(15,2) NULL DEFAULT NULL COMMENT \'Official CPA reported directly by TikTok API\' AFTER `cost_per_order`', 
    'SELECT "api_cost_per_order already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 6. Add derived_cpa column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'derived_cpa';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `derived_cpa` DECIMAL(15,2) NULL DEFAULT NULL COMMENT \'Derived spend / orders for discrepancy audit\' AFTER `api_cost_per_order`', 
    'SELECT "derived_cpa already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 7. Add api_version column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'api_version';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `api_version` VARCHAR(32) NOT NULL DEFAULT \'v1.3\' COMMENT \'TikTok API version used for ingestion\' AFTER `source_endpoint`', 
    'SELECT "api_version already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

-- 8. Add observed_at column if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'commerce_ads_campaign_daily' AND COLUMN_NAME = 'observed_at';
SET @stmt = IF(@col_exists = 0, 
    'ALTER TABLE `commerce_ads_campaign_daily` ADD COLUMN `observed_at` DATETIME NULL DEFAULT NULL COMMENT \'Observation timestamp when API payload was captured\' AFTER `api_version`', 
    'SELECT "observed_at already exists"');
PREPARE exec_stmt FROM @stmt; EXECUTE exec_stmt; DEALLOCATE PREPARE exec_stmt;

SET FOREIGN_KEY_CHECKS = 1;
