-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261004_012_create_commerce_ads_intelligence_tables.sql
-- Description: Creates normalized fact tables for Sprint V2-02:
--              1. commerce_ads_product_daily (Product / SPU grain)
--              2. commerce_ads_creative_daily (Video / Creative grain)
--              3. commerce_ads_live_daily (LIVE GMV Max / Room grain)
-- Target: Sprint V2-02 GMV Max Advertising Intelligence
-- Safety: Additive only, IF NOT EXISTS guards, zero modification of legacy tables.
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Table: commerce_ads_product_daily
-- Grain: (platform, shop_id, campaign_id, item_group_id, stat_date)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_ads_product_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_ads' COMMENT 'Advertising platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop identifier associated with the ad account',
    `advertiser_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Ads Manager advertiser ID',
    `campaign_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Ads campaign ID',
    `item_group_id` VARCHAR(128) NOT NULL COMMENT 'Product SPU ID from TikTok GMV Max API (matches commerce_order_items.product_id)',
    `stat_date` DATE NOT NULL COMMENT 'Reporting date (YYYY-MM-DD)',
    `cost` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad spend incurred on stat_date (VND)',
    `net_cost` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Net cost after credits/rebates if returned by API',
    `currency` VARCHAR(16) NOT NULL DEFAULT 'VND' COMMENT 'Currency code returned by API',
    `orders` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attributed orders count on stat_date',
    `ads_gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Attributed gross revenue on stat_date (VND)',
    `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification',
    `api_cost_per_order` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Official CPA reported directly by TikTok API',
    `derived_cpa` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Derived cost / orders (CPA)',
    `api_version` VARCHAR(32) NOT NULL DEFAULT 'v1.3' COMMENT 'Marketing API version used',
    `source_type` VARCHAR(64) NOT NULL DEFAULT 'TIKTOK_GMV_MAX_API' COMMENT 'Authoritative source marker',
    `observed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when API fact was fetched',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Reference to commerce_sync_runs',
    `raw_payload_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hash of API item payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_camp_prod_date` (`platform`, `shop_id`, `campaign_id`, `item_group_id`, `stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`),
    KEY `idx_item_date` (`item_group_id`, `stat_date`),
    KEY `idx_camp_date` (`campaign_id`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily product SPU level facts from TikTok GMV Max API';

-- --------------------------------------------------------------------
-- 2. Table: commerce_ads_creative_daily
-- Grain: (platform, shop_id, campaign_id, item_group_id, item_id, stat_date)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_ads_creative_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_ads' COMMENT 'Advertising platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop identifier associated with the ad account',
    `advertiser_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Ads Manager advertiser ID',
    `campaign_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Ads campaign ID',
    `item_group_id` VARCHAR(128) NOT NULL COMMENT 'Product SPU ID',
    `item_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Post/Video ID or -1 for unattributed creative',
    `is_unattributed` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if item_id = -1, 0 otherwise',
    `stat_date` DATE NOT NULL COMMENT 'Reporting date (YYYY-MM-DD)',
    `creative_delivery_status_raw` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Raw status from API including NOT_DELIVERYING typo',
    `creative_delivery_status_normalized` VARCHAR(64) NULL DEFAULT NULL COMMENT 'Normalized status for UI (DELIVERING, NOT_DELIVERING, etc.)',
    `cost` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad spend incurred on stat_date (VND)',
    `net_cost` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Net cost after credits/rebates if returned by API',
    `currency` VARCHAR(16) NOT NULL DEFAULT 'VND' COMMENT 'Currency code returned by API',
    `orders` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attributed orders count on stat_date',
    `ads_gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Attributed gross revenue on stat_date (VND)',
    `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification',
    `api_cost_per_order` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Official CPA reported directly by TikTok API',
    `derived_cpa` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Derived cost / orders (CPA)',
    `api_version` VARCHAR(32) NOT NULL DEFAULT 'v1.3' COMMENT 'Marketing API version used',
    `source_type` VARCHAR(64) NOT NULL DEFAULT 'TIKTOK_GMV_MAX_API' COMMENT 'Authoritative source marker',
    `observed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when API fact was fetched',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Reference to commerce_sync_runs',
    `raw_payload_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hash of API creative payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_camp_item_creative_date` (`platform`, `shop_id`, `campaign_id`, `item_group_id`, `item_id`, `stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`),
    KEY `idx_item_date` (`item_group_id`, `stat_date`),
    KEY `idx_creative_date` (`item_id`, `stat_date`),
    KEY `idx_status_norm` (`creative_delivery_status_normalized`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily video creative level facts from TikTok GMV Max API';

-- --------------------------------------------------------------------
-- 3. Table: commerce_ads_live_daily
-- Grain: (platform, shop_id, campaign_id, room_id, stat_date)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_ads_live_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_ads' COMMENT 'Advertising platform identifier',
    `shop_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Shop identifier associated with the ad account',
    `advertiser_id` VARCHAR(64) NOT NULL COMMENT 'TikTok Ads Manager advertiser ID',
    `campaign_id` VARCHAR(128) NOT NULL COMMENT 'TikTok Ads campaign ID',
    `room_id` VARCHAR(128) NOT NULL COMMENT 'TikTok LIVE room ID from API',
    `stat_date` DATE NOT NULL COMMENT 'Reporting date (YYYY-MM-DD)',
    `cost` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total ad spend incurred on stat_date (VND)',
    `net_cost` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Net cost after credits/rebates if returned by API',
    `currency` VARCHAR(16) NOT NULL DEFAULT 'VND' COMMENT 'Currency code returned by API',
    `orders` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Attributed orders count on stat_date',
    `ads_gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Attributed gross revenue on stat_date (VND)',
    `api_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Official ROI reported directly by TikTok API',
    `derived_roi` DECIMAL(7,4) NULL DEFAULT NULL COMMENT 'Derived gross_revenue / cost for audit verification',
    `api_cost_per_order` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Official CPA reported directly by TikTok API',
    `derived_cpa` DECIMAL(15,2) NULL DEFAULT NULL COMMENT 'Derived cost / orders (CPA)',
    `api_version` VARCHAR(32) NOT NULL DEFAULT 'v1.3' COMMENT 'Marketing API version used',
    `source_type` VARCHAR(64) NOT NULL DEFAULT 'TIKTOK_GMV_MAX_API' COMMENT 'Authoritative source marker',
    `session_mapping_status` VARCHAR(64) NOT NULL DEFAULT 'SESSION_MAPPING_PENDING' COMMENT 'Mapping status to commerce_live_sessions',
    `observed_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'Timestamp when API fact was fetched',
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Reference to commerce_sync_runs',
    `raw_payload_hash` VARCHAR(64) NULL DEFAULT NULL COMMENT 'SHA256 hash of API room payload',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_camp_room_date` (`platform`, `shop_id`, `campaign_id`, `room_id`, `stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`),
    KEY `idx_room_date` (`room_id`, `stat_date`),
    KEY `idx_camp_date` (`campaign_id`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily LIVE room level facts from TikTok GMV Max API';

SET FOREIGN_KEY_CHECKS = 1;
