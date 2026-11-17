-- Migration: 20261019_028_add_video_analytics_media_columns.sql
-- Description: Add cover_url and video_url to commerce_video_analytics for TikTok Shop Short Video Analytics
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `commerce_video_analytics` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(64) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `video_id` VARCHAR(128) NOT NULL COMMENT 'TikTok video identifier',
    `stat_date` DATE NOT NULL COMMENT 'Aggregation date',
    `title` VARCHAR(512) NULL DEFAULT NULL COMMENT 'Video title',
    `cover_url` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Video thumbnail/cover URL from TikTok CDN',
    `video_url` VARCHAR(1024) NULL DEFAULT NULL COMMENT 'Direct URL to watch video on TikTok',
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
    UNIQUE KEY `uniq_shop_video_stat` (`platform`, `shop_id`, `video_id`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`),
    KEY `idx_shop_date` (`shop_id`, `stat_date`),
    KEY `idx_video_id` (`video_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Video performance metrics from TikTok Shop Analytics API';

-- Add media columns if existing table lacks them
ALTER TABLE `commerce_video_analytics` ADD COLUMN IF NOT EXISTS `cover_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `title`;
ALTER TABLE `commerce_video_analytics` ADD COLUMN IF NOT EXISTS `video_url` VARCHAR(1024) NULL DEFAULT NULL AFTER `cover_url`;
