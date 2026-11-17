-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261003_010_create_commerce_ads_campaign_tables.sql
-- Description: Creates normalized daily campaign fact table for TikTok Advertising:
--              commerce_ads_campaign_daily (Shop + Campaign + Calendar Date grain)
-- Target: Sprint V2-02A Campaign GMV Max Intelligence
-- Safety: Additive only, IF NOT EXISTS guards, zero modification of legacy tables
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: commerce_ads_campaign_daily
-- Grain: 1 row per shop per platform per campaign per calendar date
CREATE TABLE IF NOT EXISTS `commerce_ads_campaign_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_ads' COMMENT 'Advertising platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop identifier associated with the ad account',
    `advertiser_id` VARCHAR(64) NULL DEFAULT NULL COMMENT 'TikTok Ads Manager advertiser ID',
    `campaign_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Ads campaign ID',
    `campaign_name` VARCHAR(255) NULL DEFAULT NULL COMMENT 'Campaign name at time of observation',
    `campaign_type` VARCHAR(64) NOT NULL DEFAULT 'Product GMV Max' COMMENT 'Product GMV Max, LIVE GMV Max, Auction Shopping, etc.',
    `stat_date` DATE NOT NULL COMMENT 'Reporting date (YYYY-MM-DD)',
    `spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad spend incurred on stat_date (VND)',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'GMV Max Gross Revenue attributed to campaign (VND)',
    `orders` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attributed orders count on stat_date',
    `roi` DECIMAL(7,4) NOT NULL DEFAULT '0.0000' COMMENT 'gross_revenue / spend',
    `cost_per_order` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'spend / orders (CPA)',
    `budget` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Configured daily budget at time of observation',
    `target_roas` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Configured Target ROAS / ROI',
    `operation_status` VARCHAR(32) NULL DEFAULT NULL COMMENT 'ENABLE, DISABLE',
    `impressions` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Ad impressions (strictly NULL if unproven by API)',
    `clicks` INT UNSIGNED NULL DEFAULT NULL COMMENT 'Ad clicks (strictly NULL if unproven by API)',
    `source` VARCHAR(64) NOT NULL DEFAULT 'TIKTOK_ADS_API' COMMENT 'TIKTOK_ADS_API, DAILY_REPORT_BACKFILL, etc.',
    `source_endpoint` VARCHAR(128) NOT NULL DEFAULT '/gmv_max/report/get/' COMMENT 'Authoritative endpoint source',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Reference to commerce_sync_runs if applicable',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hash of normalized row payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_camp_date` (`platform`, `shop_id`, `campaign_id`, `stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`),
    KEY `idx_camp_date` (`campaign_id`, `stat_date`),
    KEY `idx_type_date` (`campaign_type`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily campaign performance facts from TikTok Marketing API';

SET FOREIGN_KEY_CHECKS = 1;
