-- ====================================================================
-- ADDP COMMERCE INTELLIGENCE - COMPLETE CONSOLIDATED PRODUCTION SCHEMA
-- File: database/addp_marketing_complete_schema.sql
-- Database: addp_marketing
-- Target: Clean Installation & Disaster Recovery for marketing.addp.vn
-- Character Set: utf8mb4 / utf8mb4_unicode_ci
-- Engine: InnoDB
-- ====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --------------------------------------------------------------------
-- 1. Configuration & Connector Tables
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tiktok_config` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shop_id` VARCHAR(64) NULL DEFAULT NULL,
    `shop_name` VARCHAR(255) NULL DEFAULT NULL,
    `shop_cipher` VARCHAR(255) NULL DEFAULT NULL,
    `app_key` VARCHAR(128) NULL DEFAULT NULL,
    `app_secret` VARCHAR(128) NULL DEFAULT NULL,
    `access_token` TEXT NULL DEFAULT NULL,
    `refresh_token` TEXT NULL DEFAULT NULL,
    `token_expire_in` INT NULL DEFAULT NULL,
    `refresh_token_expire_in` INT NULL DEFAULT NULL,
    `advertiser_id` VARCHAR(64) NULL DEFAULT NULL,
    `ads_access_token` TEXT NULL DEFAULT NULL,
    `connector_token` VARCHAR(128) NULL DEFAULT NULL,
    `ses_score` DECIMAL(4,2) NOT NULL DEFAULT 4.80,
    `ses_product_score` DECIMAL(4,2) NOT NULL DEFAULT 5.00,
    `ses_product_weight` DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    `ses_negative_review_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.10,
    `ses_return_refund_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.04,
    `ses_logistics_score` DECIMAL(4,2) NOT NULL DEFAULT 5.00,
    `ses_logistics_weight` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    `ses_fast_dispatch_rate` DECIMAL(5,2) NOT NULL DEFAULT 99.17,
    `ses_seller_cancel_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.02,
    `ses_service_score` DECIMAL(4,2) NOT NULL DEFAULT 4.60,
    `ses_service_weight` DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    `ses_aftersales_hours` DECIMAL(5,2) NOT NULL DEFAULT 17.70,
    `ses_chat_response_rate` DECIMAL(5,2) NOT NULL DEFAULT 96.84,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shop_id` (`shop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiktok_campaigns` (
    `id` VARCHAR(64) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` VARCHAR(64) NOT NULL DEFAULT 'PRODUCT_GMV_MAX',
    `budget` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `spend` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `ad_gmv` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `conversions` INT NOT NULL DEFAULT 0,
    `target_roas` DECIMAL(6,2) NOT NULL DEFAULT 6.00,
    `actual_roas` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `status` INT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiktok_video_ads` (
    `id` VARCHAR(64) NOT NULL,
    `campaign_id` VARCHAR(64) NOT NULL,
    `title` VARCHAR(255) NULL DEFAULT NULL,
    `spend` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `ad_gmv` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `conversions` INT NOT NULL DEFAULT 0,
    `roas` DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    `delivery_group` VARCHAR(32) NOT NULL DEFAULT 'explored',
    `delivery_status` VARCHAR(32) NOT NULL DEFAULT 'effective',
    `why_not_spending` TEXT NULL DEFAULT NULL,
    `action_recommendation` VARCHAR(64) NULL DEFAULT 'wait',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_campaign` (`campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tiktok_shop_checklists` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `shop_id` VARCHAR(64) NOT NULL DEFAULT 'VN_DEFAULT',
    `category` VARCHAR(64) NOT NULL,
    `task_code` VARCHAR(64) NOT NULL,
    `task_name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL DEFAULT NULL,
    `priority` VARCHAR(32) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(32) NOT NULL DEFAULT 'todo',
    `notes` TEXT NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_shop_task` (`shop_id`, `task_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 2. Core Orders & Items Tables
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `order_status` VARCHAR(50) NOT NULL,
    `platform_status` VARCHAR(50) NOT NULL,
    `platform_created_at` TIMESTAMP NULL DEFAULT NULL,
    `platform_updated_at` TIMESTAMP NULL DEFAULT NULL,
    `paid_at` TIMESTAMP NULL DEFAULT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `order_gross_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `sub_total` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `shipping_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `seller_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `platform_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `tax_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `shipping_provider` VARCHAR(100) NULL DEFAULT NULL,
    `tracking_number` VARCHAR(100) NULL DEFAULT NULL,
    `delivery_type` VARCHAR(50) NULL DEFAULT NULL,
    `is_split_order` TINYINT(1) NOT NULL DEFAULT 0,
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `raw_observation_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_order` (`platform`, `shop_id`, `platform_order_id`),
    KEY `idx_shop_status` (`shop_id`, `order_status`),
    KEY `idx_platform_created` (`platform_created_at`),
    KEY `idx_platform_updated` (`platform_updated_at`),
    KEY `idx_sync_run` (`sync_run_id`),
    KEY `idx_orders_plat_shop_updated` (`platform`, `shop_id`, `platform_updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_order_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id` BIGINT UNSIGNED NOT NULL,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `platform_line_item_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `sku_id` VARCHAR(64) NOT NULL,
    `sku_name` VARCHAR(255) NULL DEFAULT NULL,
    `sku_image` VARCHAR(512) NULL DEFAULT NULL,
    `seller_sku` VARCHAR(128) NULL DEFAULT NULL,
    `quantity` INT NOT NULL DEFAULT 1,
    `sale_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `original_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `platform_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `seller_discount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `item_tax` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `item_status` VARCHAR(50) NULL DEFAULT NULL,
    `room_id` VARCHAR(64) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_item` (`platform`, `shop_id`, `platform_line_item_id`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_platform_order_id` (`platform_order_id`),
    KEY `idx_product_id` (`product_id`),
    KEY `idx_sku_id` (`sku_id`),
    KEY `idx_room_id` (`room_id`),
    KEY `idx_items_plat_shop_prod` (`platform`, `shop_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 3. Sync Runs & Raw Observations (Status as VARCHAR(64) - Zero Truncation)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_sync_runs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `source_domain` VARCHAR(64) NOT NULL DEFAULT 'order',
    `sync_type` VARCHAR(64) NOT NULL DEFAULT 'INITIAL_BACKFILL',
    `status` VARCHAR(64) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, RUNNING, COMPLETED, PARTIAL, SKIPPED_NOT_AVAILABLE, FAILED, INTERRUPTED, CANCELLED',
    `window_start_time` TIMESTAMP NULL DEFAULT NULL,
    `window_end_time` TIMESTAMP NULL DEFAULT NULL,
    `start_date` DATE NULL DEFAULT NULL,
    `end_date` DATE NULL DEFAULT NULL,
    `current_page_token` VARCHAR(1024) NULL DEFAULT NULL,
    `last_page_token` VARCHAR(1024) NULL DEFAULT NULL,
    `pages_processed` INT NOT NULL DEFAULT 0,
    `orders_ingested` INT NOT NULL DEFAULT 0,
    `items_ingested` INT NOT NULL DEFAULT 0,
    `orders_updated` INT NOT NULL DEFAULT 0,
    `records_read` INT NOT NULL DEFAULT 0,
    `records_written` INT NOT NULL DEFAULT 0,
    `latest_available_date` DATE NULL DEFAULT NULL,
    `api_endpoint` VARCHAR(128) NULL DEFAULT NULL,
    `error_code` VARCHAR(64) NULL DEFAULT NULL,
    `error_message` TEXT NULL DEFAULT NULL,
    `started_at` TIMESTAMP NULL DEFAULT NULL,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_shop_domain` (`shop_id`, `source_domain`),
    KEY `idx_sync_type` (`sync_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_raw_observations` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `source_domain` VARCHAR(64) NOT NULL DEFAULT 'order',
    `api_version` VARCHAR(32) NOT NULL DEFAULT '202309',
    `endpoint` VARCHAR(128) NOT NULL DEFAULT '/order/202309/orders/search',
    `entity_type` VARCHAR(32) NOT NULL DEFAULT 'order',
    `platform_entity_id` VARCHAR(64) NOT NULL,
    `sanitized_payload` JSON NOT NULL,
    `payload_hash` CHAR(64) NOT NULL,
    `observed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `platform_updated_at` TIMESTAMP NULL DEFAULT NULL,
    `sync_run_id` BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_entity_hash` (`platform`, `shop_id`, `platform_entity_id`, `payload_hash`),
    KEY `idx_platform_entity` (`platform`, `shop_id`, `platform_entity_id`),
    KEY `idx_sync_run` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 4. RMA, Lifecycle Events & Loss Ledger Tables
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_aftersales` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `aftersales_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `aftersales_type` VARCHAR(50) NOT NULL,
    `platform_aftersales_type` VARCHAR(50) NOT NULL,
    `aftersales_status` VARCHAR(50) NOT NULL,
    `platform_status` VARCHAR(50) NOT NULL,
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `request_created_at` TIMESTAMP NULL DEFAULT NULL,
    `platform_updated_at` TIMESTAMP NULL DEFAULT NULL,
    `refund_completed_at` TIMESTAMP NULL DEFAULT NULL,
    `reason_code` VARCHAR(64) NULL DEFAULT NULL,
    `reason_category` VARCHAR(64) NULL DEFAULT NULL,
    `return_role` VARCHAR(32) NULL DEFAULT NULL,
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `raw_observation_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_aftersales` (`platform`, `shop_id`, `aftersales_id`),
    KEY `idx_platform_order_id` (`platform`, `shop_id`, `platform_order_id`),
    KEY `idx_shop_status` (`shop_id`, `aftersales_status`),
    KEY `idx_request_created` (`request_created_at`),
    KEY `idx_refund_completed` (`refund_completed_at`),
    KEY `idx_sync_run` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_aftersales_items` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `aftersales_pk` BIGINT UNSIGNED NOT NULL,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `platform_line_item_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `sku_id` VARCHAR(64) NOT NULL,
    `sku_name` VARCHAR(255) NULL DEFAULT NULL,
    `return_quantity` INT NOT NULL DEFAULT 1,
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_aftersales_pk` (`aftersales_pk`),
    KEY `idx_platform_order_id` (`platform`, `shop_id`, `platform_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_order_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `event_domain` ENUM('ORDER', 'FULFILLMENT', 'AFTERSALES') NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `event_key` VARCHAR(128) NOT NULL,
    `previous_status` VARCHAR(50) NULL DEFAULT NULL,
    `new_status` VARCHAR(50) NOT NULL,
    `event_timestamp` TIMESTAMP NULL DEFAULT NULL,
    `observed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `source_domain` VARCHAR(64) NOT NULL,
    `api_version` VARCHAR(32) NOT NULL DEFAULT '202309',
    `endpoint` VARCHAR(128) NOT NULL,
    `platform_entity_id` VARCHAR(64) NOT NULL,
    `payload_hash` CHAR(64) NOT NULL,
    `sync_run_id` BIGINT UNSIGNED NOT NULL,
    `raw_observation_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_order_event_identity` (`platform`, `shop_id`, `event_key`),
    KEY `idx_order_timeline` (`platform`, `shop_id`, `platform_order_id`, `event_timestamp`),
    KEY `idx_observed_timeline` (`platform`, `shop_id`, `platform_order_id`, `observed_at`),
    KEY `idx_domain_type` (`shop_id`, `event_domain`, `event_type`),
    KEY `idx_sync_run` (`sync_run_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_loss_ledger` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `related_aftersales_id` VARCHAR(64) NULL DEFAULT NULL,
    `loss_type` VARCHAR(50) NOT NULL,
    `perspective` ENUM('MATURED_LIFECYCLE', 'POINT_IN_TIME') NOT NULL DEFAULT 'MATURED_LIFECYCLE',
    `loss_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `effective_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `calculation_provenance` JSON NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_order_loss_perspective` (`platform`, `shop_id`, `platform_order_id`, `loss_type`, `perspective`),
    KEY `idx_shop_perspective` (`shop_id`, `perspective`),
    KEY `idx_effective_at` (`effective_at`),
    KEY `idx_loss_plat_shop_persp_eff` (`platform`, `shop_id`, `perspective`, `effective_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 5. Finance Statements & Transactions
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_finance_statements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `statement_id` VARCHAR(64) NOT NULL,
    `statement_time` TIMESTAMP NULL DEFAULT NULL,
    `settlement_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `payment_id` VARCHAR(64) NULL DEFAULT NULL,
    `statement_status` VARCHAR(50) NULL DEFAULT NULL,
    `sync_run_id` BIGINT UNSIGNED NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_statement` (`platform`, `shop_id`, `statement_id`),
    KEY `idx_statement_time` (`statement_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_finance_transactions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `statement_id` VARCHAR(64) NOT NULL,
    `transaction_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NULL DEFAULT NULL,
    `transaction_type` VARCHAR(64) NOT NULL,
    `transaction_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `fee_category` VARCHAR(64) NULL DEFAULT NULL,
    `transaction_time` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_trans` (`platform`, `shop_id`, `statement_id`, `transaction_id`),
    KEY `idx_order_id` (`platform_order_id`),
    KEY `idx_trans_type` (`transaction_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 6. Advertising Intelligence & GMV Max Tables
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_ads_campaigns` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `campaign_id` VARCHAR(64) NOT NULL,
    `campaign_name` VARCHAR(255) NOT NULL,
    `campaign_type` VARCHAR(64) NOT NULL,
    `promotion_type` VARCHAR(32) NOT NULL DEFAULT 'PRODUCT',
    `budget` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_camp` (`platform`, `shop_id`, `campaign_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_ads_campaign_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `campaign_id` VARCHAR(64) NOT NULL,
    `campaign_name` VARCHAR(255) NOT NULL,
    `campaign_type` VARCHAR(64) NOT NULL,
    `promotion_type` VARCHAR(32) NOT NULL DEFAULT 'PRODUCT',
    `stat_date` DATE NOT NULL,
    `spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `orders` INT NOT NULL DEFAULT 0,
    `target_roas` DECIMAL(6,2) NULL DEFAULT NULL,
    `roas` DECIMAL(6,2) NOT NULL DEFAULT '0.00',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_camp_date` (`platform`, `shop_id`, `campaign_id`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_ads_creative_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `campaign_id` VARCHAR(64) NOT NULL,
    `video_id` VARCHAR(64) NOT NULL,
    `stat_date` DATE NOT NULL,
    `spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `orders` INT NOT NULL DEFAULT 0,
    `roas` DECIMAL(6,2) NOT NULL DEFAULT '0.00',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_video_date` (`platform`, `shop_id`, `campaign_id`, `video_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_ads_product_daily` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `campaign_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `stat_date` DATE NOT NULL,
    `spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `orders` INT NOT NULL DEFAULT 0,
    `roas` DECIMAL(6,2) NOT NULL DEFAULT '0.00',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_prod_date` (`platform`, `shop_id`, `campaign_id`, `product_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 7. Customer 360 & Recipients (Unmasked CRM Columns Included)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_order_recipients` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `phone_hash` CHAR(64) NULL DEFAULT NULL,
    `customer_identifier_hash` CHAR(64) NULL DEFAULT NULL,
    `identity_method` VARCHAR(32) NOT NULL DEFAULT 'PHONE_HMAC',
    `recipient_name_encrypted` TEXT NULL DEFAULT NULL,
    `recipient_name_raw` VARCHAR(255) NULL DEFAULT NULL,
    `recipient_name_masked` VARCHAR(255) NULL DEFAULT NULL,
    `phone_encrypted` TEXT NULL DEFAULT NULL,
    `phone_raw` VARCHAR(50) NULL DEFAULT NULL,
    `phone_masked` VARCHAR(50) NULL DEFAULT NULL,
    `address_full_encrypted` TEXT NULL DEFAULT NULL,
    `address_raw` TEXT NULL DEFAULT NULL,
    `address_masked` TEXT NULL DEFAULT NULL,
    `city` VARCHAR(100) NULL DEFAULT NULL,
    `district` VARCHAR(100) NULL DEFAULT NULL,
    `ward` VARCHAR(100) NULL DEFAULT NULL,
    `province` VARCHAR(100) NULL DEFAULT NULL,
    `postal_code` VARCHAR(20) NULL DEFAULT NULL,
    `is_masked_by_platform` TINYINT(1) NOT NULL DEFAULT 1,
    `encryption_key_version` VARCHAR(16) NOT NULL DEFAULT 'v1',
    `synced_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_order_recipient` (`platform`, `shop_id`, `platform_order_id`),
    KEY `idx_cust_hash` (`customer_identifier_hash`),
    KEY `idx_phone_hash` (`phone_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_customer_profiles` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `customer_identifier_hash` CHAR(64) NOT NULL,
    `identity_method` VARCHAR(32) NULL DEFAULT 'PHONE_HMAC',
    `customer_display_name` VARCHAR(255) NULL DEFAULT NULL,
    `recipient_name_raw` VARCHAR(255) NULL DEFAULT NULL,
    `phone_masked` VARCHAR(50) NULL DEFAULT NULL,
    `phone_raw` VARCHAR(50) NULL DEFAULT NULL,
    `city` VARCHAR(100) NULL DEFAULT NULL,
    `district` VARCHAR(100) NULL DEFAULT NULL,
    `province` VARCHAR(100) NULL DEFAULT NULL,
    `address_raw` TEXT NULL DEFAULT NULL,
    `postal_code` VARCHAR(20) NULL DEFAULT NULL,
    `first_order_at` TIMESTAMP NULL DEFAULT NULL,
    `last_order_at` TIMESTAMP NULL DEFAULT NULL,
    `latest_order_status` VARCHAR(50) NULL DEFAULT NULL,
    `total_orders_count` INT NOT NULL DEFAULT 0,
    `successful_orders_count` INT NOT NULL DEFAULT 0,
    `valid_orders_count` INT NOT NULL DEFAULT 0,
    `cancelled_orders_count` INT NOT NULL DEFAULT 0,
    `return_refund_count` INT NOT NULL DEFAULT 0,
    `order_gross_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `realized_purchase_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `refund_amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `lifetime_gross_spend` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `lifetime_net_spend` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `average_order_value` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `is_repeat_buyer` TINYINT(1) NOT NULL DEFAULT 0,
    `customer_tier` VARCHAR(32) NOT NULL DEFAULT 'NEW',
    `notes` TEXT NULL DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_platform_shop_customer` (`platform`, `shop_id`, `customer_identifier_hash`),
    KEY `idx_shop_tier` (`shop_id`, `customer_tier`),
    KEY `idx_shop_repeat` (`shop_id`, `is_repeat_buyer`),
    KEY `idx_shop_spend` (`shop_id`, `order_gross_amount`),
    KEY `idx_last_order` (`last_order_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 8. Product Costs & Break-even ROI Tables
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_product_catalog` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `product_name` VARCHAR(255) NOT NULL,
    `main_image_url` VARCHAR(512) NULL DEFAULT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVATE',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_prod` (`platform`, `shop_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_product_costs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `product_id` VARCHAR(64) NOT NULL,
    `sku_id` VARCHAR(64) NOT NULL DEFAULT 'GLOBAL',
    `cost_price` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `packaging_fee` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `other_cost` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `target_roi` DECIMAL(6,2) NOT NULL DEFAULT '1.50',
    `currency` VARCHAR(10) NOT NULL DEFAULT 'VND',
    `updated_by` VARCHAR(64) NOT NULL DEFAULT 'system',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_prod_sku` (`platform`, `shop_id`, `product_id`, `sku_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_affiliate_orders` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `platform_order_id` VARCHAR(64) NOT NULL,
    `creator_id` VARCHAR(64) NULL DEFAULT NULL,
    `creator_username` VARCHAR(128) NULL DEFAULT NULL,
    `commission_rate` DECIMAL(5,2) NOT NULL DEFAULT '0.00',
    `commission_amount` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_aff_order` (`platform`, `shop_id`, `platform_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------------------
-- 9. Durable Webhook Inbox & Async Sync Jobs
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `commerce_webhook_events` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `event_id` VARCHAR(128) NOT NULL,
    `event_type` VARCHAR(64) NOT NULL,
    `payload_hash` CHAR(64) NOT NULL,
    `raw_payload` LONGTEXT NOT NULL,
    `status` VARCHAR(64) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, PROCESSING, PROCESSED, FAILED, IGNORED',
    `error_message` TEXT NULL DEFAULT NULL,
    `attempt_count` INT NOT NULL DEFAULT 0,
    `event_timestamp` TIMESTAMP NULL DEFAULT NULL,
    `received_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `processed_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_event` (`platform`, `shop_id`, `event_id`),
    KEY `idx_status_received` (`status`, `received_at`),
    KEY `idx_shop_type` (`shop_id`, `event_type`),
    KEY `idx_payload_hash` (`payload_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_sync_jobs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `requested_start_date` DATE NOT NULL,
    `requested_end_date` DATE NOT NULL,
    `status` VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    `current_domain` VARCHAR(32) NULL DEFAULT NULL,
    `progress_percent` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    `checkpoint_data` LONGTEXT NULL DEFAULT NULL,
    `started_at` DATETIME NULL DEFAULT NULL,
    `heartbeat_at` DATETIME NULL DEFAULT NULL,
    `completed_at` DATETIME NULL DEFAULT NULL,
    `created_by` VARCHAR(64) NOT NULL DEFAULT 'system',
    `error_code` VARCHAR(64) NULL DEFAULT NULL,
    `error_message` TEXT NULL DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_shop_status` (`shop_id`, `status`),
    KEY `idx_status_heartbeat` (`status`, `heartbeat_at`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `commerce_daily_aggregates` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `platform` VARCHAR(32) NOT NULL DEFAULT 'tiktok_shop',
    `shop_id` VARCHAR(64) NOT NULL,
    `stat_date` DATE NOT NULL,
    `total_orders` INT NOT NULL DEFAULT 0,
    `valid_orders` INT NOT NULL DEFAULT 0,
    `cancelled_orders` INT NOT NULL DEFAULT 0,
    `order_gross_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `realized_order_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `total_loss_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `cancellation_loss_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `refund_loss_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `failed_delivery_loss_value` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `ads_spend` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `ads_gross_revenue` DECIMAL(15,2) NOT NULL DEFAULT '0.00',
    `ads_orders` INT NOT NULL DEFAULT 0,
    `blended_roas` DECIMAL(6,2) NULL DEFAULT NULL,
    `realized_ads_roi` DECIMAL(6,2) NULL DEFAULT NULL,
    `is_finalized` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_plat_shop_stat_date` (`platform`, `shop_id`, `stat_date`),
    KEY `idx_stat_date` (`stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
