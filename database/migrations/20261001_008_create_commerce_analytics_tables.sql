-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - DATABASE MIGRATION
-- Migration: 20261001_008_create_commerce_analytics_tables.sql
-- Description: Creates specialized analytics tables for HF1.5 with clear grains:
--              1. commerce_shop_analytics_daily (Shop daily overview performance)
--              2. commerce_live_sessions (Livestream session-level sales & traffic metrics)
--              3. commerce_video_analytics (Video-level sales, views & engagement metrics)
--              4. commerce_product_analytics (Product/SKU level sales, traffic & conversion)
--              5. commerce_analytics_sync_runs (Audit log of analytics ingestion runs)
-- Target: HF1.5 Shop Analytics, Livestream & Video Performance Engine
-- Safety: Additive only, IF NOT EXISTS guards, zero impact on existing tables
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: commerce_shop_analytics_daily
-- Grain: 1 row per shop per calendar date
CREATE TABLE IF NOT EXISTS `commerce_shop_analytics_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `stat_date` DATE NOT NULL COMMENT 'Aggregation date (YYYY-MM-DD)',
    `page_views` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total shop page views',
    `unique_visitors` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Unique visitor count',
    `total_orders` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total placed orders',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Total GMV/revenue reported by analytics',
    `conversion_rate` DECIMAL(7,4) NOT NULL DEFAULT '0.0000' COMMENT 'Order conversion rate (CVR)',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_daily` (`platform`, `shop_id`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Daily shop overview analytics from TikTok Shop Analytics API';

-- 2. Table: commerce_live_sessions
-- Grain: 1 row per livestream room/session
CREATE TABLE IF NOT EXISTS `commerce_live_sessions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `session_id` VARCHAR(128) NOT NULL COMMENT 'TikTok live session ID / room ID',
    `title` VARCHAR(512) NULL DEFAULT NULL COMMENT 'Live session title',
    `account_type` VARCHAR(64) NOT NULL DEFAULT 'OFFICIAL_ACCOUNTS' COMMENT 'OFFICIAL_ACCOUNTS, MARKETING_ACCOUNTS, AFFILIATE_ACCOUNTS',
    `creator_id` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Streamer creator open ID',
    `creator_username` VARCHAR(128) NULL DEFAULT NULL COMMENT 'Streamer handle/nickname',
    `start_time` DATETIME NOT NULL COMMENT 'Session start time',
    `end_time` DATETIME NULL DEFAULT NULL COMMENT 'Session end time',
    `duration_seconds` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total live duration in seconds',
    `gmv` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Direct GMV generated in live',
    `orders_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Direct SKU orders placed in live',
    `units_sold` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total units sold in live',
    `customer_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Number of unique paying customers',
    `total_views` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total viewer views',
    `impressions` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total live stream impressions',
    `clicks` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Product/showcase clicks',
    `peak_concurrent_users` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Peak concurrent viewers (PCU)',
    `comments_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total user comments during live',
    `shares_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total user shares during live',
    `follows_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total new followers gained in live',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_live_session` (`platform`, `shop_id`, `session_id`),
    KEY `idx_live_start` (`start_time`),
    KEY `idx_live_shop_start` (`shop_id`, `start_time`),
    KEY `idx_creator` (`creator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Livestream performance sessions from TikTok Shop Analytics API';

-- 3. Table: commerce_video_analytics
-- Grain: 1 row per video per aggregation date
CREATE TABLE IF NOT EXISTS `commerce_video_analytics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `video_id` VARCHAR(128) NOT NULL COMMENT 'TikTok video identifier',
    `stat_date` DATE NOT NULL COMMENT 'Aggregation date',
    `title` VARCHAR(512) NULL DEFAULT NULL COMMENT 'Video title',
    `duration_seconds` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Video length in seconds',
    `video_post_time` DATETIME NULL DEFAULT NULL COMMENT 'Publication time',
    `creator_type` VARCHAR(64) NOT NULL DEFAULT 'OFFICIAL' COMMENT 'OFFICIAL, MARKETING, AFFILIATE',
    `creator_name` VARCHAR(128) NULL DEFAULT NULL,
    `video_views` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Total video play views',
    `units_sold` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Product units sold attributed to video',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Direct GMV from video',
    `attributed_gmv` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Attributed GMV',
    `ctr` DECIMAL(7,4) NOT NULL DEFAULT '0.0000' COMMENT 'Product card click-through rate',
    `comments_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `shares_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `likes_count` INT UNSIGNED NOT NULL DEFAULT 0,
    `gpm` DECIMAL(15,2) NOT NULL DEFAULT '0.00' COMMENT 'GMV per thousand views',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_video_date` (`platform`, `shop_id`, `video_id`, `stat_date`),
    KEY `idx_video_date` (`stat_date`),
    KEY `idx_video_post_time` (`video_post_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Video performance and engagement analytics from TikTok Shop Analytics API';

-- 4. Table: commerce_product_analytics
-- Grain: 1 row per product per SKU per date
CREATE TABLE IF NOT EXISTS `commerce_product_analytics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(128) NOT NULL COMMENT 'TikTok product identifier',
    `sku_id` VARCHAR(128) NOT NULL DEFAULT '' COMMENT 'SKU identifier (or empty string for product aggregate)',
    `stat_date` DATE NOT NULL COMMENT 'Aggregation date',
    `product_name` VARCHAR(512) NULL DEFAULT NULL,
    `units_sold` INT UNSIGNED NOT NULL DEFAULT 0,
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `page_views` INT UNSIGNED NOT NULL DEFAULT 0,
    `unique_visitors` INT UNSIGNED NOT NULL DEFAULT 0,
    `cvr` DECIMAL(7,4) NOT NULL DEFAULT '0.0000' COMMENT 'Product page conversion rate',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `raw_data_hash` VARCHAR(64) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uniq_shop_product_sku_date` (`platform`, `shop_id`, `product_id`, `sku_id`, `stat_date`),
    KEY `idx_prod_date` (`stat_date`),
    KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Product and SKU performance analytics from TikTok Shop Analytics API';

-- 5. Table: commerce_analytics_sync_runs
-- Audit run log for analytics ingestion batches
CREATE TABLE IF NOT EXISTS `commerce_analytics_sync_runs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `analytics_domain` VARCHAR(64) NOT NULL COMMENT 'SHOP_DAILY, LIVE_SESSIONS, VIDEO_PERFORMANCE, PRODUCT_PERFORMANCE',
    `sync_type` VARCHAR(64) NOT NULL DEFAULT 'MANUAL_RANGE',
    `status` VARCHAR(64) NOT NULL DEFAULT 'IN_PROGRESS' COMMENT 'IN_PROGRESS, COMPLETED, FAILED, INTERRUPTED',
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `records_ingested` INT UNSIGNED NOT NULL DEFAULT 0,
    `error_message` TEXT NULL DEFAULT NULL,
    `started_at` DATETIME NOT NULL,
    `completed_at` DATETIME NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_shop_domain` (`shop_id`, `analytics_domain`),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Audit log for analytics synchronization runs';

SET FOREIGN_KEY_CHECKS = 1;
